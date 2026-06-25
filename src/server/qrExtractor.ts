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
        const pixRegex = /000201[\s\S]+?(?:BR\.GOV\.BCB\.PIX|br\.gov\.bcb\.pix)[\s\S]+6304[A-Fa-f0-9]{4}/i;
        
        // Find the LAST occurrence of 6304 + 4 hex chars to ensure we capture the full CRC
        const crcRegex = /6304[A-Fa-f0-9]{4}/gi;
        
        // Check without spaces
        const match = cleanText.match(pixRegex);
        if (match) {
            let lastMatch = null;
            let crcMatch;
            const matchedText = match[0];
            while ((crcMatch = crcRegex.exec(matchedText)) !== null) {
                lastMatch = crcMatch;
            }
            if (lastMatch) {
               return matchedText.substring(0, lastMatch.index + lastMatch[0].length);
            }
            return matchedText;
        }

        // Also check with spaces
        const textMatch = fullText.match(pixRegex);
        if (textMatch) {
            let lastMatch = null;
            let crcMatch;
            const matchedText = textMatch[0];
            while ((crcMatch = crcRegex.exec(matchedText)) !== null) {
                lastMatch = crcMatch;
            }
            if (lastMatch) {
               return matchedText.substring(0, lastMatch.index + lastMatch[0].length).replace(/\s+/g, "");
            }
            return matchedText.replace(/\s+/g, "");
        }
        
    }
  } catch (err) {
      console.error("Error reading PDF for QR Code:", err);
  }
  return null;
}
