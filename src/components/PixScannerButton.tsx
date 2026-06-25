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
    let mounted = true;
    
    const preScan = async () => {
      try {
        const loadingTask = pdfjsLib.getDocument({ url: fileUrl });
        const pdf = await loadingTask.promise;
        let foundCode = null;

        // 1. Try to find the PIX code in the PDF text
        for (let i = 1; i <= Math.min(pdf.numPages, 3); i++) {
          if (!mounted) break;
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const textItems = textContent.items.map((item: any) => item.str);
          const fullText = textItems.join("");
          
          // Try multiple PIX regex patterns
          const pixRegexes = [
            /000201[\s\S]*?(?:BR\.GOV\.BCB\.PIX|br\.gov\.bcb\.pix)[\s\S]*?6304[A-Fa-f0-9]{4}/i,
            /00020126580014BR\.GOV\.BCB\.PIX[\s\S]*?6304[A-Fa-f0-9]{4}/,
            /000201[\s\S]*?PIX[\s\S]*?6304[A-Fa-f0-9]{4}/i,
            /000201[0-9A-Za-z\/+=]*?6304[A-Fa-f0-9]{4}/
          ];
          
          for (const regex of pixRegexes) {
            const match = fullText.match(regex);
            if (match) {
              foundCode = match[0].replace(/\s+/g, "");
              break;
            }
          }
          
          if (foundCode) break;
          
          // Check for hidden PIX code (might be in a non-visible text layer)
          const hiddenPixPattern = /(?:COPIA|COLA|PIX)?\s*(000201[0-9A-Za-z\/+=]*?6304[A-Fa-f0-9]{4})/i;
          const hiddenMatch = fullText.match(hiddenPixPattern);
          if (hiddenMatch && hiddenMatch[1]) {
            foundCode = hiddenMatch[1];
            break;
          }
        }

        // 2. Try to find QR Code in the PDF by scanning images
        if (!foundCode) {
          // Check the bottom of the page where PIX QR codes usually are
          const qrCandidates = [
            { scale: 3.0, x1: 0.02, y1: 0.80, x2: 0.30, y2: 0.98 }, // Bottom-left area
            { scale: 3.0, x1: 0.70, y1: 0.80, x2: 0.98, y2: 0.98 }, // Bottom-right area
            { scale: 2.5, x1: 0.80, y1: 0.84, x2: 0.95, y2: 0.96 }, // Standard PIX area
            { scale: 2.0, x1: 0, y1: 0, x2: 1, y2: 1 }, // Full page
          ];

          for (let i = 1; i <= Math.min(pdf.numPages, 3); i++) {
            if (!mounted || foundCode) break;
            const page = await pdf.getPage(i);
            
            for (const crop of qrCandidates) {
              if (foundCode) break;
              
              const viewport = page.getViewport({ scale: crop.scale });
              const cropX = viewport.width * crop.x1;
              const cropY = viewport.height * crop.y1;
              const cropW = viewport.width * (crop.x2 - crop.x1);
              const cropH = viewport.height * (crop.y2 - crop.y1);
              
              // Skip if crop area is too small or invalid
              if (cropW < 20 || cropH < 20) continue;
              
              const canvas = document.createElement("canvas");
              const context = canvas.getContext("2d", { willReadFrequently: true });
              if (!context) continue;
              
              canvas.width = cropW;
              canvas.height = cropH;
              
              try {
                // @ts-ignore
                await page.render({
                  canvasContext: context,
                  viewport: viewport,
                  transform: [1, 0, 0, 1, -cropX, -cropY]
                }).promise;
              } catch (renderError) {
                continue;
              }
              
              const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
              
              // Try multiple QR decoding attempts
              for (const inversionAttempt of ["attemptBoth", "dontInvert", "invertFirst", "attemptBoth"] as const) {
                try {
                  const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: inversionAttempt });
                  
                  if (code && code.data && code.data.startsWith("000201")) {
                    // Validate it's a proper PIX code
                    const validPix = /000201.*(?:BR\.GOV\.BCB\.PIX|br\.gov\.bcb\.pix).*6304[A-Fa-f0-9]{4}/i;
                    if (validPix.test(code.data)) {
                      foundCode = code.data;
                      break;
                    }
                  }
                } catch (qrError) {
                  continue;
                }
              }
            }
          }
        }

        // 3. Try to extract PIX from raw PDF text if QR fails
        if (!foundCode) {
          for (let i = 1; i <= Math.min(pdf.numPages, 3); i++) {
            if (!mounted) break;
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const textItems = textContent.items.map((item: any) => item.str);
            const fullText = textItems.join("");
            
            // Look for PIX in text that might be around the "PIX Copia e Cola" label
            const pixTextRegex = /PIX\s*Copia\s*e\s*Cola\s*[:.]?\s*([\s\S]*?)(?:\n|$)/i;
            const match = fullText.match(pixTextRegex);
            if (match && match[1]) {
              // Try to find PIX code in the captured text
              const pixCodeMatch = match[1].match(/000201[0-9A-Za-z\/+=]*?6304[A-Fa-f0-9]{4}/);
              if (pixCodeMatch) {
                foundCode = pixCodeMatch[0];
                break;
              }
            }
          }
        }

        if (mounted) {
          setScanned(true);
          if (foundCode) {
            // Validate and clean the PIX code
            const cleanedCode = foundCode.replace(/\s+/g, "").trim();
            if (cleanedCode.startsWith("000201") && cleanedCode.length > 20) {
              setPixCode(cleanedCode);
            }
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
