import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from 'canvas';
import jsQR from 'jsqr';

export async function extractPixCodeFromPdf(buffer: Buffer): Promise<string | null> {
  try {
    const data = new Uint8Array(buffer);
    const loadingTask = getDocument({ data, disableFontFace: true, disableRange: true });
    const pdfDocument = await loadingTask.promise;
    
    // Check up to first 3 pages
    const numPages = Math.min(3, pdfDocument.numPages);
    
    for (let i = 1; i <= numPages; i++) {
        const page = await pdfDocument.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 });
        
        const canvas = createCanvas(viewport.width, viewport.height);
        const ctx = canvas.getContext('2d');
        
        await page.render({
            canvasContext: ctx as any,
            viewport: viewport
        }).promise;
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        // Ensure data is properly structured for jsQR
        const code = jsQR(new Uint8ClampedArray(imageData.data.buffer), imageData.width, imageData.height);
        
        if (code && code.data && code.data.startsWith('000201')) {
            return code.data;
        }
    }
  } catch (err) {
      console.error("Error reading PDF for QR Code:", err);
  }
  return null;
}
