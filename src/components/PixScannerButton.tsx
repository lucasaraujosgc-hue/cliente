import React, { useState, useEffect } from 'react';
import { Copy, Check, QrCode } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import jsQR from 'jsqr';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

interface PixScannerButtonProps {
  docId: number;
  fileUrl: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extrai o código PIX de um texto corrido.
 *
 * FIX FGTS: o PDF da CAIXA coloca o código completo numa única linha de texto,
 * mas o pdfjs pode fragmentar os items.  Ao fazer join("") sem separador dois
 * fragmentos consecutivos colam errado; já com join(" ") o regex falha porque
 * o código não tem espaços.  Solução: tentamos AMBAS as versões do texto
 * (sem separador E com separador removido depois) e também buscamos o trecho
 * ANTES de qualquer "Payload Location" / "PIX Copia e Cola" que aparece depois
 * do código no PDF da CAIXA — isso evita que o regex pare cedo por causa da
 * URL curta que vem na sequência.
 */
function extractPixFromText(rawItems: string[]): string | null {
  // Versão 1: join sem separador (mais comum para PDFs bem estruturados)
  const joined = rawItems.join("");

  // Versão 2: join com espaço e depois remove todos os espaços do match
  // (útil quando os items são fragmentados)
  const joinedSpace = rawItems.join(" ");

  for (const source of [joined, joinedSpace]) {
    // Pegamos tudo desde 000201 até o CRC 6304XXXX.
    // Usamos um greedy no meio para não parar cedo, mas limitamos a 2000 chars
    // para não capturar lixo demais.
    const match = source.match(/000201.{20,2000}?6304[A-Fa-f0-9]{4}/);
    if (match) {
      // Remove espaços internos que possam ter sido introduzidos pelo join
      const cleaned = match[0].replace(/\s+/g, "");
      // Sanity: deve conter a chave pix/bcb ou pelo menos ser longo o suficiente
      if (cleaned.length >= 50) {
        return cleaned;
      }
    }
  }

  return null;
}

/**
 * Tenta decodificar o QR Code de uma região da página do PDF.
 * Retorna o payload se for um PIX válido, ou null.
 */
async function tryDecodeQRFromRegion(
  page: any,
  scale: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): Promise<string | null> {
  const viewport = page.getViewport({ scale });
  const cropX = Math.floor(viewport.width * x1);
  const cropY = Math.floor(viewport.height * y1);
  const cropW = Math.ceil(viewport.width * (x2 - x1));
  const cropH = Math.ceil(viewport.height * (y2 - y1));

  if (cropW < 30 || cropH < 30) return null;

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;

  canvas.width = cropW;
  canvas.height = cropH;

  try {
    // @ts-ignore
    await page.render({
      canvasContext: context,
      viewport,
      transform: [1, 0, 0, 1, -cropX, -cropY],
    }).promise;
  } catch {
    return null;
  }

  const imageData = context.getImageData(0, 0, cropW, cropH);

  for (const inv of ["attemptBoth", "dontInvert", "invertFirst"] as const) {
    try {
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: inv,
      });
      if (code?.data && code.data.startsWith("000201")) {
        // Aceita qualquer PIX (com ou sem o domínio bcb explícito)
        return code.data;
      }
    } catch {
      // ignora e tenta próxima estratégia
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Regiões de QR Code a escanear
// Ordem de prioridade: regiões menores/específicas primeiro → página inteira por último.
//
// FIX INTER: O boleto do Inter coloca o QR no canto SUPERIOR ESQUERDO
// (aprox. 2%–28% horizontal, 5%–35% vertical).  Adicionamos essa região
// como primeira candidata para não depender só das regiões de rodapé.
// ─────────────────────────────────────────────────────────────────────────────
const QR_REGIONS = [
  // ── Canto superior esquerdo (boleto Inter, Sicredi, alguns bancos digitais)
  { scale: 4.0, x1: 0.01, y1: 0.04, x2: 0.30, y2: 0.38 },
  { scale: 3.5, x1: 0.01, y1: 0.04, x2: 0.25, y2: 0.32 },

  // ── Canto superior direito
  { scale: 4.0, x1: 0.70, y1: 0.04, x2: 0.99, y2: 0.38 },

  // ── Rodapé esquerdo (FGTS Digital / CAIXA, GNRe)
  { scale: 3.5, x1: 0.01, y1: 0.78, x2: 0.32, y2: 0.99 },

  // ── Rodapé direito
  { scale: 3.5, x1: 0.68, y1: 0.78, x2: 0.99, y2: 0.99 },

  // ── Centro (alguns boletos centralizam o QR)
  { scale: 3.0, x1: 0.30, y1: 0.30, x2: 0.70, y2: 0.70 },

  // ── Página inteira como último recurso (escala menor para não estourar memória)
  { scale: 2.0, x1: 0.00, y1: 0.00, x2: 1.00, y2: 1.00 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────────────────────────────────────

export function PixScannerButton({ docId, fileUrl }: PixScannerButtonProps) {
  const [pixCode, setPixCode] = useState<string | null>(null);
  const [scanned, setScanned] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let mounted = true;

    const preScan = async () => {
      try {
        const loadingTask = pdfjsLib.getDocument({ url: fileUrl });
        const pdf = await loadingTask.promise;
        let foundCode: string | null = null;

        // ── Passo 1: busca no texto extraído pelo pdfjs ──────────────────────
        for (let i = 1; i <= Math.min(pdf.numPages, 3) && !foundCode; i++) {
          if (!mounted) break;
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const items = textContent.items.map((item: any) => item.str as string);
          foundCode = extractPixFromText(items);
        }

        // ── Passo 2: varredura de regiões para encontrar o QR Code ────────────
        if (!foundCode) {
          outer: for (let i = 1; i <= Math.min(pdf.numPages, 3); i++) {
            if (!mounted) break;
            const page = await pdf.getPage(i);

            for (const r of QR_REGIONS) {
              if (!mounted) break outer;
              const result = await tryDecodeQRFromRegion(
                page,
                r.scale,
                r.x1,
                r.y1,
                r.x2,
                r.y2
              );
              if (result) {
                foundCode = result;
                break outer;
              }
            }
          }
        }

        if (mounted) {
          setScanned(true);
          if (foundCode) {
            const clean = foundCode.replace(/\s+/g, "").trim();
            if (clean.startsWith("000201") && clean.length >= 50) {
              setPixCode(clean);
            }
          }
        }
      } catch {
        if (mounted) setScanned(true);
      }
    };

    preScan();
    return () => {
      mounted = false;
    };
  }, [fileUrl]);

  const handleCopyClick = () => {
    if (!pixCode) return;
    navigator.clipboard.writeText(pixCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Não renderiza nada se ainda está escaneando ou se não encontrou código
  if (!scanned || !pixCode) return null;

  return (
    <button
      onClick={handleCopyClick}
      className={`h-10 px-3 border text-xs font-bold rounded-xl transition-all flex items-center justify-center min-w-[100px] ${
        copied
          ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/30 dark:border-emerald-800/50 dark:text-emerald-400"
          : "bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 border-indigo-100 dark:border-indigo-800/50 text-indigo-700 dark:text-indigo-300"
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
