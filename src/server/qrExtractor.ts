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
        const cleanText = fullText.replace(/\s+/g, '');
        
        // Regex to match PIX code: starts with 000201, contains PIX domain, ends with 6304 + 4 hex chars
        const pixRegex = /000201[\s\S]+?(?:BR\.GOV\.BCB\.PIX|br\.gov\.bcb\.pix)[\s\S]+5802BR[\s\S]+6304[A-Fa-f0-9]{4}/i;
        
        // 1. Try with spaces
        const textMatch = fullText.match(pixRegex);
        if (textMatch) {
            return textMatch[0].replace(/\s+/g, "");
        }

        // 2. Try without spaces
        const match = cleanText.match(pixRegex);
        if (match) {
            return match[0];
        }

        // 3. Fallback manual search
        const start = cleanText.indexOf("000201");
        if (start !== -1) {
            const payload = cleanText.substring(start);
            if (payload.toUpperCase().includes("BR.GOV.BCB.PIX") || payload.toUpperCase().includes("FGTS")) {
                const crcRegex = /6304[A-Fa-f0-9]{4}/gi;
                let lastMatch = null;
                let crcMatch;
                while ((crcMatch = crcRegex.exec(payload)) !== null) {
                    lastMatch = crcMatch;
                }
                if (lastMatch) {
                   return payload.substring(0, lastMatch.index + lastMatch[0].length);
                }
            }
        }
        
    }
  } catch (err) {
      console.error("Error reading PDF for QR Code:", err);
  }
  return null;
}
