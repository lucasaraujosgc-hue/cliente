import React, { useState, useEffect } from 'react';
import { Copy, Check } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import jsQR from 'jsqr';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

interface PixScannerButtonProps {
  docId: number;
  fileUrl: string;
}

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

        // 1. Busca texto "copia e cola" nas primeiras páginas
        for (let i = 1; i <= Math.min(pdf.numPages, 3); i++) {
          if (!mounted) break;
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();

          // Junta TUDO antes de rodar o regex — evita match parcial
          const fullText = textContent.items.map((item: any) => item.str).join('');

          // Regex mais amplo: captura qualquer payload que comece com 000201 e termine em 6304 + 4 hex
          const pixRegex = /000201[A-Za-z0-9./:_\-*%+?=&#@!\s]+6304[A-Fa-f0-9]{4}/;
          const match = fullText.replace(/\s+/g, '').match(pixRegex);
          if (match) {
            foundCode = match[0];
            break;
          }
        }

        // 2. Fallback: varredura por QR code nas imagens
        if (!foundCode) {
          for (let i = 1; i <= Math.min(pdf.numPages, 3); i++) {
            if (!mounted) break;
            const page = await pdf.getPage(i);

            const crops = [
              // Inter — QR fica no canto superior esquerdo
              { scale: 4.0, x1: 0.03, y1: 0.10, x2: 0.24, y2: 0.38 },
              // DAS / DARF — QR fica no canto inferior direito
              { scale: 4.0, x1: 0.82, y1: 0.86, x2: 0.93, y2: 0.94 },
              // Página inteira como último recurso
              { scale: 1.5, x1: 0, y1: 0, x2: 1, y2: 1 },
            ];

            for (const crop of crops) {
              const viewport = page.getViewport({ scale: crop.scale });
              const cropX = viewport.width * crop.x1;
              const cropY = viewport.height * crop.y1;
              const cropW = viewport.width * (crop.x2 - crop.x1);
              const cropH = viewport.height * (crop.y2 - crop.y1);

              const canvas = document.createElement('canvas');
              const context = canvas.getContext('2d', { willReadFrequently: true });
              if (!context) continue;

              canvas.width = cropW;
              canvas.height = cropH;

              // @ts-ignore
              await page.render({
                canvasContext: context,
                viewport,
                transform: [1, 0, 0, 1, -cropX, -cropY],
              }).promise;

              const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
              const code = jsQR(imageData.data, imageData.width, imageData.height);

              if (
                code?.data.startsWith('000201') &&
                /6304[A-Fa-f0-9]{4}$/.test(code.data)
              ) {
                foundCode = code.data;
                break;
              }
            }
            if (foundCode) break;
          }
        }

        if (mounted) {
          setScanned(true);
          if (foundCode) setPixCode(foundCode);
        }
      } catch {
        if (mounted) setScanned(true);
      }
    };

    preScan();
    return () => { mounted = false; };
  }, [fileUrl]);

  const handleCopyClick = () => {
    if (!pixCode) return;
    navigator.clipboard.writeText(pixCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!scanned || !pixCode) return null;

  return (
    <button
      onClick={handleCopyClick}
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
