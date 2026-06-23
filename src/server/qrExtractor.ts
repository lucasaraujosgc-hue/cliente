import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

export async function extractPixCodeFromPdf(buffer: Buffer): Promise<string | null> {
  try {
    const data = new Uint8Array(buffer);
    const loadingTask = pdfjsLib.getDocument({ data, disableFontFace: true, disableRange: true });
    const pdfDocument = await loadingTask.promise;
    
    // Check up to first 3 pages
    const numPages = Math.min(3, pdfDocument.numPages);
    
    for (let i = 1; i <= numPages; i++) {
        const page = await pdfDocument.getPage(i);
        
        // 1. First try simple text extraction (for "Pix Copia e Cola" text often found next to the QR Code)
        const textContent = await page.getTextContent();
        const fullText = textContent.items.map((item: any) => item.str).join('');
        
        // Match PIX Code pattern (starts with 000201 and has normal PIX length)
        // Pix BR Code regex (simple check)
        const pixRegex = /000201[A-Za-z0-9]{30,}/;
        const match = fullText.match(pixRegex);
        if (match) {
            return match[0];
        }
        
    }
  } catch (err) {
      console.error("Error reading PDF for QR Code:", err);
  }
  return null;
}
