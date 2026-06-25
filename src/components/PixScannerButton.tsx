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
        let foundCode = null;

        // 1. Try to find the PIX code in the PDF text (Copia e Cola)
        for (let i = 1; i <= Math.min(pdf.numPages, 3); i++) {
          if (!mounted) break;
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const textItems = textContent.items.map((item: any) => item.str);
          const fullText = textItems.join("");
          // Regex to match PIX code: starts with 000201, contains PIX domain, ends with 6304 + 4 hex chars. Use greedy to get the last 6304
          const pixRegex = /000201[\s\S]*(?:BR\.GOV\.BCB\.PIX|br\.gov\.bcb\.pix)[\s\S]*6304[A-Fa-f0-9]{4}/i;
          const match = fullText.match(pixRegex);
          if (match) {
            foundCode = match[0].replace(/\s+/g, "");
            break;
          }
          // Also check by joining with spaces or removing spaces just in case
          const textNoSpaces = textItems.join("").replace(/\s+/g, "");
          const matchNoSpaces = textNoSpaces.match(pixRegex);
          if (matchNoSpaces) {
            foundCode = matchNoSpaces[0];
            break;
          }
        }

        // 2. Fallback to image scanning if not found in text
        if (!foundCode) {
          for (let i = 1; i <= Math.min(pdf.numPages, 3); i++) {
            if (!mounted) break;
            const page = await pdf.getPage(i);
            
            const crops = [
              { scale: 4.0, x1: 0.04, y1: 0.21, x2: 0.33, y2: 0.43 }, // Inter (with quiet zone)
              { scale: 4.0, x1: 0.80, y1: 0.84, x2: 0.95, y2: 0.96 }, // DAS (with quiet zone)
              { scale: 1.5, x1: 0, y1: 0, x2: 1, y2: 1 }, // Fallback full page
            ];
            
            for (const crop of crops) {
              const viewport = page.getViewport({ scale: crop.scale });
              const cropX = viewport.width * crop.x1;
              const cropY = viewport.height * crop.y1;
              const cropW = viewport.width * (crop.x2 - crop.x1);
              const cropH = viewport.height * (crop.y2 - crop.y1);
              
              const canvas = document.createElement("canvas");
              const context = canvas.getContext("2d", { willReadFrequently: true });
              if (!context) continue;
              
              canvas.width = cropW;
              canvas.height = cropH;
              
              // @ts-ignore
              await page.render({
                canvasContext: context,
                viewport: viewport,
                transform: [1, 0, 0, 1, -cropX, -cropY]
              }).promise;
              
              const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
              const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "attemptBoth" });
              
              if (code && code.data.startsWith("000201") && code.data.toLowerCase().includes("br.gov.bcb.pix") && code.data.toLowerCase().includes("5802br") && /6304[A-Fa-f0-9]{4}$/.test(code.data)) {
                foundCode = code.data;
                break; // Found it
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
      } catch (e) {
        if (mounted) setScanned(true);
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
