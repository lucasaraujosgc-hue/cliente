import React, { useState, useEffect } from 'react';
import { Copy, Check, QrCode } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import jsQR from 'jsqr';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

interface PixScannerButtonProps {
  docId: number;
  fileUrl: string;
}

export function PixScannerButton({ docId, fileUrl }: PixScannerButtonProps) {
  const [pixCode, setPixCode] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Automatically try to scan in background when component mounts to hide button if no PIX
    let mounted = true;
    
    const preScan = async () => {
      try {
        const loadingTask = pdfjsLib.getDocument({ url: fileUrl });
        const pdf = await loadingTask.promise;

        let foundCode: string | null = null;

        for (let i = 1; i <= Math.min(pdf.numPages, 3); i++) {
          if (!mounted) break;

          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();

          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(" ");

          const normalized = textContent.items
            .map((item: any) => item.str)
            .join("")
            .replace(/\s+/g, "");

          const isFGTSDigital =
            pageText.includes("GFD - Guia do FGTS Digital") ||
            pageText.includes("FGTS Digital");

          if (isFGTSDigital) {
            const start = normalized.indexOf("000201");

            if (start !== -1) {
              const payload = normalized.substring(start);

              // Find the LAST occurrence of 6304 + 4 hex chars
              const crcRegex = /6304[A-Fa-f0-9]{4}/gi;
              let lastMatch = null;
              let match;
              while ((match = crcRegex.exec(payload)) !== null) {
                lastMatch = match;
              }

              if (lastMatch) {
                const end =
                  lastMatch.index + lastMatch[0].length;

                foundCode = payload.substring(0, end);

                console.log(
                  "[FGTS DIGITAL] PIX encontrado:",
                  foundCode
                );

                break;
              }
            }
          }
          
          if (!foundCode) {
            const pixRegex = /000201[\s\S]+?(?:BR\.GOV\.BCB\.PIX|br\.gov\.bcb\.pix)[\s\S]+5802BR[\s\S]+6304[A-Fa-f0-9]{4}/i;
            const fullMatch = pageText.match(pixRegex);
            if (fullMatch) {
              foundCode = fullMatch[0].replace(/\s+/g, "");
              break;
            }
            const normalizedMatch = normalized.match(pixRegex);
            if (normalizedMatch) {
              foundCode = normalizedMatch[0];
              break;
            }
          }
        }

        if (!foundCode) {
          for (let i = 1; i <= Math.min(pdf.numPages, 3); i++) {
            if (!mounted) break;

            const page = await pdf.getPage(i);

            const crops = [
              { scale: 4.0, x1: 0.03, y1: 0.13, x2: 0.25, y2: 0.38 }, // Banco Inter precise area (x: 3-25%, y: 13-38%)
              { scale: 4.0, x1: 0.05, y1: 0.21, x2: 0.32, y2: 0.43 }, // Inter 1
              { scale: 4.0, x1: 0.06, y1: 0.23, x2: 0.31, y2: 0.41 }, // Inter 2
              { scale: 4.0, x1: 0.82, y1: 0.86, x2: 0.93, y2: 0.94 }, // DAS
              { scale: 3.0, x1: 0.35, y1: 0.75, x2: 0.65, y2: 0.98 }, // FGTS
              { scale: 4.0, x1: 0, y1: 0, x2: 1, y2: 1 }, // Fallback full page very high res
              { scale: 2.5, x1: 0, y1: 0, x2: 1, y2: 1 }, // Fallback full page high res
              { scale: 1.5, x1: 0, y1: 0, x2: 1, y2: 1 } // Fallback full page low res
            ];

            for (const crop of crops) {
              const viewport = page.getViewport({
                scale: crop.scale
              });

              const cropX = viewport.width * crop.x1;
              const cropY = viewport.height * crop.y1;
              const cropW =
                viewport.width * (crop.x2 - crop.x1);
              const cropH =
                viewport.height * (crop.y2 - crop.y1);

              const canvas =
                document.createElement("canvas");

              const context = canvas.getContext("2d", {
                willReadFrequently: true
              });

              if (!context) continue;

              canvas.width = cropW;
              canvas.height = cropH;

              await page.render({
                canvasContext: context,
                viewport,
                transform: [
                  1,
                  0,
                  0,
                  1,
                  -cropX,
                  -cropY
                ]
              } as any).promise;

              const imageData = context.getImageData(
                0,
                0,
                canvas.width,
                canvas.height
              );

              const code = jsQR(
                imageData.data,
                imageData.width,
                imageData.height,
                {
                  inversionAttempts: "attemptBoth"
                }
              );

              if (code && code.data) {
                const qrText = code.data.trim();
                if (
                  qrText.startsWith("000201") &&
                  qrText.toUpperCase().includes("BR.GOV.BCB.PIX") &&
                  qrText.toUpperCase().includes("5802BR") &&
                  /6304[A-Fa-f0-9]{4}$/i.test(qrText)
                ) {
                  foundCode = qrText;
                  break;
                }
              }
            }

            if (foundCode) break;
          }
        }

        if (mounted) {
          setScanned(true);

          if (foundCode) {
            setPixCode(foundCode);
          }
        }
      } catch (err) {
        console.error(err);

        if (mounted) {
          setScanned(true);
        }
      }
    };
    
    preScan();
    return () => { mounted = false; };
  }, [fileUrl]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyClick = () => {
    if (pixCode) {
      copyToClipboard(pixCode);
    }
  };

  // hide if scanned and no pix code found, or if scanning isn't done yet hide to avoid flicker of wrong state
  if (!scanned || (scanned && !pixCode)) {
    return null; 
  }

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