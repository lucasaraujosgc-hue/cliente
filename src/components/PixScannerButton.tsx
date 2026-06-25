import React, { useState, useEffect } from 'react';
import { Copy, Check } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import jsQR from 'jsqr';

pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

// ─── types ───────────────────────────────────────────────────────────────────

interface PixScannerButtonProps {
  docId: number;
  fileUrl: string;
}

// Relative crop region [x0, y0, x1, y1] in 0..1 page fractions
type CropRect = [number, number, number, number];

// ─── constants ───────────────────────────────────────────────────────────────

/**
 * Render scale for the focused QR crop pass.
 * Scale 4 = ~160px per 40pt QR module row → well above jsQR's practical minimum.
 * DAS QR is only 65pt on page, so scale 4 gives ~260px native → reliable decode.
 */
const SCALE_QR = 4;

/**
 * Known QR code positions mapped from PDF analysis (pymupdf).
 *
 * Each entry is a [x0, y0, x1, y1] crop in page-fraction coordinates,
 * with +2% padding on each side.
 *
 * ┌──────────────────────────────────────────────┐
 * │ INTER boleto: QR at top-left                 │
 * │  raw (0.061, 0.229 → 0.313, 0.407)           │
 * │                                              │
 * │                                              │
 * │              FGTS: QR at center-bottom       │
 * │              raw (0.425, 0.815 → 0.576, 0.922)│
 * │                                 DAS: bottom-right│
 * │                         raw (0.824, 0.860 → 0.933, 0.937)│
 * └──────────────────────────────────────────────┘
 */
const KNOWN_QR_CROPS: CropRect[] = [
  // INTER boleto — top-left
  [0.041, 0.209, 0.333, 0.427],
  // FGTS Digital — center-bottom
  [0.405, 0.795, 0.596, 0.942],
  // DAS Simples Nacional — bottom-right
  [0.804, 0.840, 0.953, 0.957],
];

// ─── helpers ─────────────────────────────────────────────────────────────────

/**
 * Validate that a string is a real Pix EMV payload (BACEN spec):
 *   000201      → format indicator
 *   br.gov.bcb.pix → merchant account template
 *   6304[4hex]  → CRC-16/CCITT-FALSE at the very end
 */
function isPixPayload(s: string): boolean {
  return (
    s.startsWith('000201') &&
    /br\.gov\.bcb\.pix/i.test(s) &&
    /6304[A-Fa-f0-9]{4}$/.test(s)
  );
}

/**
 * Render one PDF page to an off-screen canvas at the given scale.
 * Returns the canvas so we can both extract full ImageData and crop regions.
 */
async function renderPageToCanvas(
  page: pdfjsLib.PDFPageProxy,
  scale: number,
): Promise<HTMLCanvasElement> {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  // @ts-ignore – typings vary across pdfjs versions
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
}

/**
 * Crop a sub-region from a canvas using page-fraction coordinates.
 * Returns a fresh ImageData ready for jsQR.
 */
function cropToImageData(
  canvas: HTMLCanvasElement,
  [fx0, fy0, fx1, fy1]: CropRect,
): ImageData {
  const W = canvas.width;
  const H = canvas.height;
  const sx = Math.floor(fx0 * W);
  const sy = Math.floor(fy0 * H);
  const sw = Math.max(1, Math.floor((fx1 - fx0) * W));
  const sh = Math.max(1, Math.floor((fy1 - fy0) * H));
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  return ctx.getImageData(sx, sy, sw, sh);
}

/**
 * Run jsQR on a single ImageData region. Returns payload or null.
 * inversionAttempts: 'attemptBoth' handles inverted (dark-on-white) QRs.
 */
function decodeImageData(imageData: ImageData): string | null {
  const result = jsQR(
    imageData.data,
    imageData.width,
    imageData.height,
    { inversionAttempts: 'attemptBoth' },
  );
  const text = result?.data ?? null;
  return text && isPixPayload(text) ? text : null;
}

// ─── QR image scan ───────────────────────────────────────────────────────────

/**
 * Scan the page for a Pix QR code using image decoding.
 *
 * Pass 1 — Targeted crops at SCALE_QR (4×):
 *   Crops each of the three known QR positions (Inter, FGTS, DAS).
 *   A small crop forces more pixels-per-module, which is critical for
 *   the DAS QR (only 65×65 pt on the page).
 *
 * Pass 2 — Full page at scale 3:
 *   Catches any QR not in the known positions (new document types).
 *
 * Pass 3 — Full page at scale 4:
 *   Last-resort high-DPI sweep for stubborn small QRs.
 */
async function scanQRFromPage(page: pdfjsLib.PDFPageProxy): Promise<string | null> {
  // ── Pass 1: targeted crops ────────────────────────────────────────────────
  const canvas4 = await renderPageToCanvas(page, SCALE_QR);

  for (const crop of KNOWN_QR_CROPS) {
    const region = cropToImageData(canvas4, crop);
    const found = decodeImageData(region);
    if (found) {
      canvas4.width = 0; // free GPU memory
      return found;
    }
  }

  // ── Pass 2: full page scale 3 ─────────────────────────────────────────────
  const canvas3 = await renderPageToCanvas(page, 3);
  const full3 = canvas3.getContext('2d', { willReadFrequently: true })!
    .getImageData(0, 0, canvas3.width, canvas3.height);
  const found3 = decodeImageData(full3);
  canvas3.width = 0;
  if (found3) {
    canvas4.width = 0;
    return found3;
  }

  // ── Pass 3: full page scale 4 ─────────────────────────────────────────────
  const full4 = canvas4.getContext('2d', { willReadFrequently: true })!
    .getImageData(0, 0, canvas4.width, canvas4.height);
  canvas4.width = 0;
  return decodeImageData(full4);
}

// ─── text layer extraction ───────────────────────────────────────────────────

/**
 * Extract the Pix EMV payload from the PDF text layer.
 *
 * Only FGTS Digital (Caixa) prints the full copia-e-cola string as selectable
 * text at 4pt. The payload lives in a single text span — confirmed by analysis:
 *
 *   '00020101021226900014br.gov.bcb.pix2568pix-qrcode.caixa.gov.br/...63043C5F'
 *   (185 chars, ending with 6304 + 4-hex CRC)
 *
 * Strategy:
 *   1. Join all spans WITHOUT separator (pdfjs never inserts spaces mid-payload).
 *   2. Strip all whitespace (handles "CAIXA ECONOMICA FEDERAL" mid-payload).
 *   3. Use GREEDY regex .+ so it always reaches the LAST 6304xxxx in the string
 *      — not a partial match in the middle.
 */
function extractPixFromTextLayer(items: string[]): string | null {
  const joined = items.join('');
  const flat = joined.replace(/\s+/g, '');

  // Greedy match → captures everything from 000201 to the final 6304+CRC
  const match = flat.match(/000201.+6304[A-Fa-f0-9]{4}/);
  if (match && isPixPayload(match[0])) return match[0];

  return null;
}

// ─── main scanner ─────────────────────────────────────────────────────────────

/**
 * Scan page 1 of the given PDF URL for a Pix payload.
 *
 * Order of attempts:
 *   1. Text layer  — fastest, zero image decoding (FGTS only)
 *   2. QR image scan — targeted crops + full-page fallbacks (Inter, DAS, others)
 *
 * Text layer is tried first because it is O(n) string ops vs rendering a
 * 2382×3368 canvas, and for FGTS it is 100% reliable.
 */
async function scanPdfForPix(fileUrl: string): Promise<string | null> {
  const pdf = await pdfjsLib.getDocument({ url: fileUrl }).promise;
  const page = await pdf.getPage(1);

  // ── 1. Text layer (FGTS / GFD) ───────────────────────────────────────────
  const textContent = await page.getTextContent();
  const items = (textContent.items as Array<{ str: string }>).map((i) => i.str);
  const fromText = extractPixFromTextLayer(items);
  if (fromText) return fromText;

  // ── 2. QR image scan (Inter, DAS, any other) ─────────────────────────────
  return scanQRFromPage(page);
}

// ─── component ───────────────────────────────────────────────────────────────

export function PixScannerButton({ docId, fileUrl }: PixScannerButtonProps) {
  const [pixCode, setPixCode] = useState<string | null>(null);
  const [ready, setReady]     = useState(false);
  const [copied, setCopied]   = useState(false);

  useEffect(() => {
    let alive = true;
    const cacheKey = `pix-v3-${docId}`;

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
