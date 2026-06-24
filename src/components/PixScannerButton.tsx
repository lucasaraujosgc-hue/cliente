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
        const loadingTask = pdfjsLib.getDocument(fileUrl);
        const pdf = await loadingTask.promise;
        let foundCode = null;

        for (let i = 1; i <= Math.min(pdf.numPages, 3); i++) {
          if (!mounted) break;
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d", { willReadFrequently: true });
          if (!context) continue;
          
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          
          await page.render({
            canvasContext: context,
            viewport: viewport
          }).promise;
          
          const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          
          if (code && code.data.startsWith("000201") && code.data.includes("BR.GOV.BCB.PIX")) {
            foundCode = code.data;
            break;
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
