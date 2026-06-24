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
 * Validates that a decoded string is a real PIX payload (EMV format).
 *
 * Rules:
 *  - Starts with 000201 (EMV header)
 *  - Contains br.gov.bcb.pix (identifies as Pix)
 *  - Ends with 6304 + 4 hex chars (mandatory CRC-16 from BACEN)
 *
 * Note: we accept ANY characters between start and end (including spaces)
 * because some payloads like FGTS contain "CAIXA ECONOMICA FEDERAL".
 */
function isPixPayload(data: string): boolean {
  return (
    data.startsWith('000201') &&
    /br\.gov\.bcb\.pix/i.test(data) &&
    /6304[A-Fa-f0-9]{4}$/.test(data)
  );
}

/**
 * Try jsQR on the full canvas first, then on quadrant crops.
 *
 * Quadrant order: TL → BR → BL → TR
 *  - TL first: boletos Inter/Sicoob place QR in the top-left corner
 *  - BR second: tax docs (DAS, FGTS) place it in the bottom-right
 *
 * Full-page scan already catches any position; crops improve effective
 * resolution for small QR codes.
 *
 * FIX (Inter): Added higher-resolution crops (2/3 of each dimension)
 * to better detect small QR codes embedded in boleto layouts.
 */
function tryDecodeCanvas(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number
): string | null {
  // Full page
  const full = ctx.getImageData(0, 0, w, h);
  const hit = jsQR(full.data, full.width, full.height);
  if (hit && isPixPayload(hit.data)) return hit.data;

  const hw = Math.floor(w / 2);
  const hh = Math.floor(h / 2);

  // Standard quadrant crops (half-width, half-height)
  const quadrants: [number, number, number, number][] = [
    [0,  0,  hw, hh], // top-left    → boletos (Inter, Sicoob)
    [hw, hh, hw, hh], // bottom-right → fiscais (DAS, FGTS, DARF)
    [0,  hh, hw, hh], // bottom-left
    [hw, 0,  hw, hh], // top-right
  ];

  for (const [sx, sy, sw, sh] of quadrants) {
    const crop = ctx.getImageData(sx, sy, sw, sh);
    const result = jsQR(crop.data, crop.width, crop.height);
    if (result && isPixPayload(result.data)) return result.data;
  }

  // FIX (Inter boleto): larger crops covering 2/3 of each axis —
  // the Inter QR sits in the upper-left third of the page; standard
  // half-crops can miss it when the QR is positioned near the edge.
  const tw = Math.floor(w * 2 / 3);
  const th = Math.floor(h * 2 / 3);

  const largerRegions: [number, number, number, number][] = [
    [0,  0,  tw, th], // top-left 2/3
    [w - tw, h - th, tw, th], // bottom-right 2/3
  ];

  for (const [sx, sy, sw, sh] of largerRegions) {
    const crop = ctx.getImageData(sx, sy, sw, sh);
    const result = jsQR(crop.data, crop.width, crop.height);
    if (result && isPixPayload(result.data)) return result.data;
  }

  return null;
}

/**
 * Extract PIX payload from the PDF text layer (copia-e-cola).
 *
 * FIX (FGTS): The previous regex used \S+ which stops at whitespace.
 * FGTS payloads contain spaces (e.g. "CAIXA ECONOMICA FEDERAL"),
 * so we now match any character (including spaces) between the
 * 000201 anchor and the 6304XXXX CRC tail.
 *
 * We deliberately allow spaces in the middle but still require
 * the payload to start right at 000201 and end at 6304+4hex.
 */
function extractPixFromText(text: string): string | null {
  // Strategy 1: strip all whitespace and match (catches most cases)
  const flat = text.replace(/\s+/g, '');
  const m1 = flat.match(/000201.+?6304[A-Fa-f0-9]{4}/);
  if (m1 && isPixPayload(m1[0])) return m1[0];

  // Strategy 2: match with spaces allowed — for FGTS-style payloads
  // where "CAIXA ECONOMICA FEDERAL" etc. appear in the text layer
  // without the surrounding whitespace stripped.
  const m2 = text.match(/000201[\s\S]+?6304[A-Fa-f0-9]{4}/);
  if (m2) {
    // Collapse internal whitespace so the final payload is a clean string
    const candidate = m2[0].replace(/\s+/g, ' ').trim();
    if (isPixPayload(candidate)) return candidate;

    // Also try fully stripped version of this match
    const stripped = m2[0].replace(/\s+/g, '');
    if (isPixPayload(stripped)) return stripped;
  }

  return null;
}

// ─── scanner ────────────────────────────────────────────────────────────────

// Scales ordered for best QR detection vs. cost:
// 3 → sharp enough for most codes; 4 → catches small QRs; 2 → fallback
const SCALES = [3, 4, 2] as const;

/**
 * Scans only page 1 (virtually all tax PDFs are single-page).
 *
 * Strategy order:
 *  1. QR image scan (3 scales + quadrant crops + 2/3 crops for Inter)
 *  2. Text layer (GFD FGTS Digital, some DARFs) — fixed to allow spaces
 */
async function scanPdfForPix(fileUrl: string): Promise<string | null> {
  const pdf = await pdfjsLib.getDocument({ url: fileUrl }).promise;
  const page = await pdf.getPage(1);

  // ── 1. QR image scan ─────────────────────────────────────────────────────
  for (const scale of SCALES) {
    const { canvas, ctx } = await renderPage(page, scale);
    const found = tryDecodeCanvas(ctx, canvas.width, canvas.height);
    canvas.width = 0;
    canvas.height = 0;
    if (found) return found;
  }

  // ── 2. Text layer fallback ────────────────────────────────────────────────
  const textContent = await page.getTextContent();
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
