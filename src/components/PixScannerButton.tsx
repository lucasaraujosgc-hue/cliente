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

/**
 * Render one PDF page to a canvas at the given scale.
 * Caller is responsible for freeing memory (canvas.width = 0).
 */
async function renderPage(
  page: pdfjsLib.PDFPageProxy,
  scale: number
): Promise<{ canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D }> {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  // @ts-ignore – render() typings vary across pdfjs versions
  await page.render({ canvasContext: ctx, viewport }).promise;
  return { canvas, ctx };
}

/**
 * Validates that a decoded string is a real PIX payload:
 *  - starts with 000201 (EMV header)
 *  - contains br.gov.bcb.pix domain
 *  - contains 5802BR (country code field)
 *  - ends with 6304 + 4 hex chars (CRC-16)
 */
function isPixPayload(data: string): boolean {
  return (
    data.startsWith('000201') &&
    /br\.gov\.bcb\.pix/i.test(data) &&
    data.includes('5802BR') &&
    /6304[A-Fa-f0-9]{4}$/.test(data)
  );
}

/**
 * Try jsQR on the full canvas, then on quadrant crops.
 * Quadrant order: BR → BL → TR → TL (QR is usually bottom-right).
 */
function tryDecodeCanvas(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number
): string | null {
  const full = ctx.getImageData(0, 0, w, h);
  const hit = jsQR(full.data, full.width, full.height);
  if (hit && isPixPayload(hit.data)) return hit.data;

  const hw = Math.floor(w / 2);
  const hh = Math.floor(h / 2);
  const regions: [number, number, number, number][] = [
    [hw, hh, hw, hh], // bottom-right
    [0,  hh, hw, hh], // bottom-left
    [hw, 0,  hw, hh], // top-right
    [0,  0,  hw, hh], // top-left
  ];

  for (const [sx, sy, sw, sh] of regions) {
    const crop = ctx.getImageData(sx, sy, sw, sh);
    const result = jsQR(crop.data, crop.width, crop.height);
    if (result && isPixPayload(result.data)) return result.data;
  }

  return null;
}

/**
 * Extract PIX payload from the PDF text layer (copia-e-cola).
 * Strips whitespace first, then matches 000201…6304XXXX.
 */
function extractPixFromText(text: string): string | null {
  const flat = text.replace(/\s+/g, '');
  // Anchor: starts at 000201, ends at 6304 + 4 hex chars
  const m = flat.match(/000201\S+6304[A-Fa-f0-9]{4}/);
  if (!m) return null;
  return isPixPayload(m[0]) ? m[0] : null;
}

// ─── scanner ────────────────────────────────────────────────────────────────

// Scales ordered for best QR detection vs. cost:
// 3 → sharp enough for most codes; 4 → catches small QRs; 2 → fallback if memory is tight
const SCALES = [3, 4, 2] as const;

/**
 * Scans only page 1 (virtually all tax PDFs are single-page).
 * Strategy: QR image scan first (3 scales + quadrant crops), then text layer.
 */
async function scanPdfForPix(fileUrl: string): Promise<string | null> {
  const pdf = await pdfjsLib.getDocument({ url: fileUrl }).promise;
  const page = await pdf.getPage(1);

  // ── 1. QR image scan (priority) ──────────────────────────────────────────
  for (const scale of SCALES) {
    const { canvas, ctx } = await renderPage(page, scale);
    const found = tryDecodeCanvas(ctx, canvas.width, canvas.height);

    // Free GPU/memory immediately after each attempt
    canvas.width = 0;
    canvas.height = 0;

    if (found) return found;
  }

  // ── 2. Text layer fallback (GFD FGTS Digital, some DARFs) ────────────────
  const textContent = await page.getTextContent();
  const raw = (textContent.items as any[]).map((i) => i.str).join('');
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

    // ── Cache hit: skip scanning entirely ──
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

  // Hidden while scanning or when no PIX was found
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