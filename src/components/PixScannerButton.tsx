import React, { useState, useEffect } from 'react';
import { Copy, Check } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import jsQR from 'jsqr';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

interface PixScannerButtonProps {
  docId: number;
  fileUrl: string;
}

// ─── helpers ────────────────────────────────────────────────────────────────

async function renderPage(
  page: pdfjsLib.PDFPageProxy,
  scale: number
): Promise<{ canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D }> {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  // @ts-ignore
  await page.render({ canvasContext: ctx, viewport }).promise;
  return { canvas, ctx };
}

/**
 * Validates that a decoded string is a real PIX payload (EMV/BR Code format).
 *
 * Rules (mandatory per BACEN spec):
 *  - Starts with 000201 (EMV header)
 *  - Contains br.gov.bcb.pix (Pix identifier, case-insensitive)
 *  - Ends with 6304 + exactly 4 hex chars (CRC-16)
 */
function isPixPayload(data: string): boolean {
  return (
    data.startsWith('000201') &&
    /br\.gov\.bcb\.pix/i.test(data) &&
    /6304[A-Fa-f0-9]{4}$/.test(data)
  );
}

/**
 * Try jsQR on the full canvas, then on targeted crop regions.
 *
 * WHY THE CROP STRATEGY MATTERS:
 *   jsQR's finder-pattern detector degrades when the QR code occupies
 *   a small fraction of the total image area. Cropping closer to the QR
 *   forces the code to fill more of the canvas, dramatically improving
 *   detection reliability.
 *
 * CROP ORDER (chosen by empirical PDF layout analysis):
 *
 *   1. Full page       — catches any position at no extra cost
 *   2. Top-left  35%w × 55%h  — boletos bancários (Inter, Sicoob, Bradesco)
 *                                QR sits at ~6-31% x, 23-41% y of the page.
 *                                A half-width crop works for zxing but jsQR
 *                                needs the QR to fill ≥ ~30% of the crop width.
 *   3. Bottom-right half       — documentos fiscais (DAS Simples Nacional, DARF)
 *   4. Bottom-right 35%w×35%h — FGTS Digital / GFD (small QR, bottom-right corner)
 *   5. Bottom-left half        — fallback
 *   6. Top-right half          — fallback
 */
function tryDecodeCanvas(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number
): string | null {
  const decode = (sx: number, sy: number, sw: number, sh: number) => {
    const data = ctx.getImageData(sx, sy, sw, sh);
    const result = jsQR(data.data, data.width, data.height);
    return result && isPixPayload(result.data) ? result.data : null;
  };

  // 1. Full page
  const full = decode(0, 0, w, h);
  if (full) return full;

  // 2. Top-left 35% × 55% — Inter / Sicoob boletos
  //    QR at ~6-31% x, 23-41% y → needs narrow crop so QR fills the frame
  const tl35 = decode(0, 0, Math.floor(w * 0.35), Math.floor(h * 0.55));
  if (tl35) return tl35;

  // 3. Bottom-right half — DAS Simples Nacional, DARF
  const hw = Math.floor(w / 2);
  const hh = Math.floor(h / 2);
  const br = decode(hw, hh, hw, hh);
  if (br) return br;

  // 4. Bottom-right 35% × 35% — FGTS Digital (very small QR)
  const brs = decode(
    Math.floor(w * 0.65), Math.floor(h * 0.65),
    Math.floor(w * 0.35), Math.floor(h * 0.35)
  );
  if (brs) return brs;

  // 5-6. Remaining quadrants (fallback)
  const bl = decode(0, hh, hw, hh);
  if (bl) return bl;
  const tr = decode(hw, 0, hw, hh);
  if (tr) return tr;

  return null;
}

/**
 * Extract PIX payload from the PDF text layer (copia-e-cola).
 *
 * FIX: The original regex used \S+ which stops at whitespace.
 * FGTS Digital payloads contain spaces (e.g. "CAIXA ECONOMICA FEDERAL"),
 * so we now use two strategies:
 *
 *   1. Strip ALL whitespace first (fastest, handles most PDFs)
 *   2. Match with spaces allowed, then normalize (handles FGTS Digital)
 *
 * The items are joined with a space separator to preserve token boundaries
 * when the PDF text extractor splits words across items.
 */
function extractPixFromText(text: string): string | null {
  // Strategy 1: fully stripped (DAS, DARF, most tax docs)
  const flat = text.replace(/\s+/g, '');
  const m1 = flat.match(/000201.+?6304[A-Fa-f0-9]{4}/);
  if (m1 && isPixPayload(m1[0])) return m1[0];

  // Strategy 2: allow spaces inside match (FGTS Digital / GFD)
  const m2 = text.match(/000201[\s\S]+?6304[A-Fa-f0-9]{4}/);
  if (m2) {
    // Try collapsed-space version first (preserves "CAIXA ECONOMICA FEDERAL")
    const spaced = m2[0].replace(/\s+/g, ' ').trim();
    if (isPixPayload(spaced)) return spaced;

    // Then fully stripped (some PDFs inject extra newlines mid-payload)
    const stripped = m2[0].replace(/\s+/g, '');
    if (isPixPayload(stripped)) return stripped;
  }

  return null;
}

// ─── scanner ────────────────────────────────────────────────────────────────

/**
 * Scale sequence: 3 → good resolution for most QRs; 4 → helps with small
 * QRs (FGTS); 2 → lower memory fallback.
 *
 * Note: jsQR needs the QR to span enough pixels to be detected. Scales 2-4
 * give 400-900px for a QR that covers ~150pt, which is in the reliable range.
 */
const SCALES = [3, 4, 2] as const;

/**
 * Scans page 1 for a PIX payload using two strategies:
 *  1. QR image scan (multiple scales + focused crop regions)
 *  2. Text layer fallback (FGTS Digital prints the payload as text)
 */
async function scanPdfForPix(fileUrl: string): Promise<string | null> {
  const pdf = await pdfjsLib.getDocument({ url: fileUrl }).promise;
  const page = await pdf.getPage(1);

  // ── 1. QR image scan ─────────────────────────────────────────────────────
  for (const scale of SCALES) {
    const { canvas, ctx } = await renderPage(page, scale);
    const found = tryDecodeCanvas(ctx, canvas.width, canvas.height);
    canvas.width = 0;  // free GPU memory
    canvas.height = 0;
    if (found) return found;
  }

  // ── 2. Text layer fallback ────────────────────────────────────────────────
  const textContent = await page.getTextContent();
  // Join with space to preserve word boundaries across PDF text items
  const raw = (textContent.items as any[]).map((i) => i.str).join(' ');
  return extractPixFromText(raw);
}

// ─── component ──────────────────────────────────────────────────────────────

export function PixScannerButton({ docId, fileUrl }: PixScannerButtonProps) {
  const [pixCode, setPixCode] = useState<string | null>(null);
  const [ready, setReady]     = useState(false);
  const [copied, setCopied]   = useState(false);

  useEffect(() => {
    let alive = true;
    const cacheKey = `pix-${docId}`;

    // Cache hit: skip scanning
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
