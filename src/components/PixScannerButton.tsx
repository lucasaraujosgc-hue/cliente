import React, { useState, useEffect } from 'react';
import { Copy, Check } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { readBarcodes, type ReaderOptions } from 'zxing-wasm/reader';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

interface PixScannerButtonProps {
  docId: number;
  fileUrl: string;
}

// ─── zxing options ──────────────────────────────────────────────────────────

/**
 * Only QR Codes carry PIX payloads.
 * tryHarder: true → enables multi-scale + rotation attempts inside zxing-wasm,
 * which is essential for small QRs (FGTS) and slightly skewed ones (Inter boleto).
 * maxNumberOfSymbols: 1 → stop after the first valid QR to save time.
 */
const ZXING_OPTIONS: ReaderOptions = {
  formats: ['QRCode'],
  tryHarder: true,
  maxNumberOfSymbols: 1,
};

// ─── helpers ────────────────────────────────────────────────────────────────

/**
 * Render a PDF page to an off-screen canvas at the given scale.
 * Returns the ImageData so it can be passed directly to zxing-wasm.
 */
async function renderPageToImageData(
  page: pdfjsLib.PDFPageProxy,
  scale: number
): Promise<ImageData> {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  // @ts-ignore – typings vary across pdfjs versions
  await page.render({ canvasContext: ctx, viewport }).promise;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  // Free GPU memory immediately
  canvas.width = 0;
  canvas.height = 0;
  return imageData;
}

/**
 * Crop a rectangular region out of an ImageData (RGBA, row-major).
 */
function cropImageData(
  src: ImageData,
  sx: number, sy: number,
  sw: number, sh: number
): ImageData {
  const dst = new ImageData(sw, sh);
  for (let row = 0; row < sh; row++) {
    const srcOff = ((sy + row) * src.width + sx) * 4;
    const dstOff = row * sw * 4;
    dst.data.set(src.data.subarray(srcOff, srcOff + sw * 4), dstOff);
  }
  return dst;
}

/**
 * Validates that a decoded string is a real PIX payload (BACEN EMV spec).
 *
 * Mandatory fields:
 *  000201        → EMV payload format indicator
 *  br.gov.bcb.pix → Pix merchant account template (case-insensitive)
 *  6304[4 hex]   → CRC-16/CCITT-FALSE checksum
 */
function isPixPayload(data: string): boolean {
  return (
    data.startsWith('000201') &&
    /br\.gov\.bcb\.pix/i.test(data) &&
    /6304[A-Fa-f0-9]{4}$/.test(data)
  );
}

/**
 * Run zxing-wasm on one ImageData region. Returns the PIX payload or null.
 */
async function decodeRegion(imageData: ImageData): Promise<string | null> {
  const results = await readBarcodes(imageData, ZXING_OPTIONS);
  for (const r of results) {
    if (isPixPayload(r.text)) return r.text;
  }
  return null;
}

/**
 * Scan a rendered page for a PIX QR Code using zxing-wasm.
 *
 * Strategy: full page first, then focused crops.
 * zxing's tryHarder already does multi-scale internally, but targeted crops
 * help when the QR occupies a small fraction of the page — each crop forces
 * a better pixels-per-module ratio for the decoder.
 *
 * Crop layout (confirmed with real PDFs):
 *
 *  ┌──────────────────────────────────┐
 *  │ [TL 35%×55%]  ←  Inter boleto   │  QR at ~9-29% x, 25-39% y
 *  │               ←  Sicoob boleto  │
 *  │                                  │
 *  │                  [BR 35%×35%] ← │  FGTS/GFD: QR at ~44-56% x, 82-91% y
 *  └──────────────────────────────────┘
 *
 * DAS Simples Nacional QR is large and central-bottom → full page catches it.
 */
async function scanPageForPix(imageData: ImageData): Promise<string | null> {
  const w = imageData.width;
  const h = imageData.height;

  // 1. Full page (DAS Simples Nacional, any large/central QR)
  const full = await decodeRegion(imageData);
  if (full) return full;

  // 2. Top-left 35% × 55% — Inter / Sicoob boletos
  const tl = cropImageData(imageData, 0, 0, Math.floor(w * 0.35), Math.floor(h * 0.55));
  const tlResult = await decodeRegion(tl);
  if (tlResult) return tlResult;

  // 3. Bottom-right 35% × 35% — FGTS Digital / GFD (small QR)
  const brX = Math.floor(w * 0.65);
  const brY = Math.floor(h * 0.65);
  const br = cropImageData(imageData, brX, brY, w - brX, h - brY);
  const brResult = await decodeRegion(br);
  if (brResult) return brResult;

  // 4. Bottom-right half — DAS fallback and other tax docs
  const hw = Math.floor(w / 2);
  const hh = Math.floor(h / 2);
  const brHalf = cropImageData(imageData, hw, hh, hw, hh);
  const brHalfResult = await decodeRegion(brHalf);
  if (brHalfResult) return brHalfResult;

  return null;
}

/**
 * Extract a PIX payload from the PDF text layer (copia-e-cola string).
 *
 * FGTS Digital prints the full EMV string as selectable text at 4pt — useful
 * when the QR image is too small or rendered at low DPI.
 *
 * The text layer items are joined WITHOUT any separator so whitespace internal
 * to the payload (e.g. "CAIXA ECONOMICA FEDERAL") can be preserved or stripped
 * as needed by each strategy.
 *
 * Two strategies:
 *  1. Strip ALL whitespace → always correct for "CAIXA ECONOMICA FEDERAL"
 *     because the EMV CRC is the same whether the space is present or not
 *     (the CRC covers bytes, and the space is just a display artifact that
 *      does not affect the Pix URL in field 26).
 *  2. Match with spaces allowed → catches edge cases where stripping breaks
 *     something (e.g. unusual encoding).
 */
function extractPixFromText(items: string[]): string | null {
  const raw = items.join('');  // no separator → no spurious spaces

  // Strategy 1: fully stripped (fastest, handles FGTS, DAS, DARF)
  const flat = raw.replace(/\s+/g, '');
  const m1 = flat.match(/000201.+?6304[A-Fa-f0-9]{4}/);
  if (m1 && isPixPayload(m1[0])) return m1[0];

  // Strategy 2: spaces allowed inside match (unusual PDFs)
  const m2 = raw.match(/000201[\s\S]+?6304[A-Fa-f0-9]{4}/);
  if (m2) {
    const stripped = m2[0].replace(/\s+/g, '');
    if (isPixPayload(stripped)) return stripped;
  }

  return null;
}

// ─── scanner ────────────────────────────────────────────────────────────────

/**
 * Scan page 1 of the PDF for a PIX payload.
 *
 * Scale sequence for QR image scan:
 *  3 → reliable for most QR sizes (450px for a 150pt QR)
 *  4 → catches very small QRs (FGTS GFD QR is only ~90pt)
 *  2 → lower-memory fallback if scale=3/4 both fail
 *
 * Text layer is tried last as it only applies to FGTS Digital.
 */
const SCALES = [3, 4, 2] as const;

async function scanPdfForPix(fileUrl: string): Promise<string | null> {
  const pdf = await pdfjsLib.getDocument({ url: fileUrl }).promise;
  const page = await pdf.getPage(1);

  // ── 1. QR image scan ─────────────────────────────────────────────────────
  for (const scale of SCALES) {
    const imageData = await renderPageToImageData(page, scale);
    const found = await scanPageForPix(imageData);
    if (found) return found;
  }

  // ── 2. Text layer fallback (FGTS Digital / GFD) ──────────────────────────
  const textContent = await page.getTextContent();
  const items = (textContent.items as any[]).map((i) => i.str);
  return extractPixFromText(items);
}

// ─── component ──────────────────────────────────────────────────────────────

export function PixScannerButton({ docId, fileUrl }: PixScannerButtonProps) {
  const [pixCode, setPixCode] = useState<string | null>(null);
  const [ready, setReady]     = useState(false);
  const [copied, setCopied]   = useState(false);

  useEffect(() => {
    let alive = true;
    const cacheKey = `pix-v2-${docId}`; // v2 prefix evita cache corrompido da versão anterior

    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      setPixCode(cached);
      setReady(true);
      return;
    }

    scanPdfForPix(fileUrl)
      .then((code) => {
        if (!alive) return;
        if (code) localStorage.setItem(cacheKey, code);
        setPixCode(code);
        setReady(true);
      })
      .catch(() => {
        if (alive) setReady(true);
      });

    return () => { alive = false; };
  }, [docId, fileUrl]);

  if (!ready || !pixCode) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(pixCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className={`h-10 px-3 border text-xs font-bold rounded-xl transition-all flex items-center justify-center min-w-[100px] ${
        copied
          ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/30 dark:border-emerald-800/50 dark:text-emerald-400'
          : 'bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 border-indigo-100 dark:border-indigo-800/50 text-indigo-700 dark:text-indigo-300'
      }`}
    >
      {copied ? (
        <span className="font-bold flex items-center gap-1">
          <Check className="w-3.5 h-3.5" /> Pix Copiado!
        </span>
      ) : (
        <span className="flex items-center gap-1 font-bold">
          <Copy className="w-3 h-3 text-indigo-400" /> Copiar QrCode Pix
        </span>
      )}
    </button>
  );
}
