import path from "path";
import jsQR from "jsqr";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

const standardFontDataUrl = `${path
  .join(process.cwd(), "node_modules", "pdfjs-dist", "standard_fonts")
  .replace(/\\/g, "/")}/`;

const pixRegex =
  /000201[\s\S]+?(?:BR\.GOV\.BCB\.PIX|br\.gov\.bcb\.pix)[\s\S]+?6304[A-Fa-f0-9]{4}/i;

type CanvasModule = typeof import("@napi-rs/canvas");

let canvasModulePromise: Promise<CanvasModule | null> | null = null;

function normalizePixPayload(value: string | null | undefined): string | null {
  if (!value) return null;

  const cleaned = value.replace(/\s+/g, "").trim();
  if (!cleaned.startsWith("000201")) return null;

  const upper = cleaned.toUpperCase();
  if (!upper.includes("BR.GOV.BCB.PIX") && !upper.includes("FGTS")) {
    return null;
  }

  const crcMatches = [...cleaned.matchAll(/6304[A-Fa-f0-9]{4}/gi)];
  if (crcMatches.length === 0) return null;

  const lastMatch = crcMatches[crcMatches.length - 1];
  return cleaned.substring(0, lastMatch.index! + lastMatch[0].length);
}

function extractPixFromText(text: string): string | null {
  const textMatch = text.match(pixRegex);
  if (textMatch) {
    return normalizePixPayload(textMatch[0]);
  }

  const cleaned = text.replace(/\s+/g, "");
  const cleanedMatch = cleaned.match(pixRegex);
  if (cleanedMatch) {
    return normalizePixPayload(cleanedMatch[0]);
  }

  const start = cleaned.indexOf("000201");
  if (start === -1) return null;

  return normalizePixPayload(cleaned.substring(start));
}

function toRgbaData(imgData: any): Uint8ClampedArray | null {
  const width = Number(imgData?.width || 0);
  const height = Number(imgData?.height || 0);
  const source = imgData?.data;

  if (!width || !height || !source) return null;

  const data =
    source instanceof Uint8ClampedArray
      ? source
      : source instanceof Uint8Array
        ? new Uint8ClampedArray(source)
        : new Uint8ClampedArray(source);

  const pixelCount = width * height;
  if (data.length === pixelCount * 4) return data;

  const rgbaData = new Uint8ClampedArray(pixelCount * 4);
  if (data.length === pixelCount * 3) {
    for (let sourceIndex = 0, targetIndex = 0; sourceIndex < data.length; sourceIndex += 3, targetIndex += 4) {
      rgbaData[targetIndex] = data[sourceIndex];
      rgbaData[targetIndex + 1] = data[sourceIndex + 1];
      rgbaData[targetIndex + 2] = data[sourceIndex + 2];
      rgbaData[targetIndex + 3] = 255;
    }
    return rgbaData;
  }

  if (data.length === pixelCount) {
    for (let sourceIndex = 0, targetIndex = 0; sourceIndex < data.length; sourceIndex++, targetIndex += 4) {
      rgbaData[targetIndex] = data[sourceIndex];
      rgbaData[targetIndex + 1] = data[sourceIndex];
      rgbaData[targetIndex + 2] = data[sourceIndex];
      rgbaData[targetIndex + 3] = 255;
    }
    return rgbaData;
  }

  return null;
}

function scaleNearest(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  scale: number,
): { data: Uint8ClampedArray; width: number; height: number } {
  if (scale <= 1) return { data, width, height };

  const scaledWidth = width * scale;
  const scaledHeight = height * scale;
  const scaled = new Uint8ClampedArray(scaledWidth * scaledHeight * 4);

  for (let y = 0; y < scaledHeight; y++) {
    const sourceY = Math.floor(y / scale);
    for (let x = 0; x < scaledWidth; x++) {
      const sourceX = Math.floor(x / scale);
      const sourceIndex = (sourceY * width + sourceX) * 4;
      const targetIndex = (y * scaledWidth + x) * 4;
      scaled[targetIndex] = data[sourceIndex];
      scaled[targetIndex + 1] = data[sourceIndex + 1];
      scaled[targetIndex + 2] = data[sourceIndex + 2];
      scaled[targetIndex + 3] = data[sourceIndex + 3];
    }
  }

  return { data: scaled, width: scaledWidth, height: scaledHeight };
}

function decodePixFromRgba(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): string | null {
  const scales = width < 180 || height < 180 ? [1, 2, 4] : [1];

  for (const scale of scales) {
    const candidate = scaleNearest(data, width, height, scale);
    const code = jsQR(candidate.data, candidate.width, candidate.height, {
      inversionAttempts: "attemptBoth",
    });
    const pixCode = normalizePixPayload(code?.data);
    if (pixCode) return pixCode;
  }

  return null;
}

async function getCanvasModule(): Promise<CanvasModule | null> {
  if (!canvasModulePromise) {
    canvasModulePromise = import("@napi-rs/canvas").catch((err) => {
      console.warn(
        "PDF QR render fallback indisponivel: @napi-rs/canvas nao carregou.",
        err,
      );
      return null;
    });
  }

  return canvasModulePromise;
}

async function getPdfImageObject(page: any, objId: string): Promise<any> {
  if (page.objs?.has?.(objId)) {
    return page.objs.get(objId);
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(null), 1000);
    page.objs.get(objId, (data: any) => {
      clearTimeout(timeout);
      resolve(data);
    });
  });
}

async function extractPixFromEmbeddedImages(page: any): Promise<string | null> {
  const ops = await page.getOperatorList();

  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    let imgData: any = null;

    if (
      fn === pdfjsLib.OPS.paintInlineImageXObject ||
      fn === pdfjsLib.OPS.paintInlineImageXObjectGroup
    ) {
      imgData = ops.argsArray[i]?.[0];
    }

    if (
      fn === pdfjsLib.OPS.paintImageXObject ||
      fn === pdfjsLib.OPS.paintImageXObjectRepeat
    ) {
      const objId = ops.argsArray[i]?.[0];
      if (!objId) continue;

      try {
        imgData = await getPdfImageObject(page, objId);
      } catch {
        imgData = null;
      }
    }

    if (!imgData?.width || !imgData?.height) continue;

    const rgbaData = toRgbaData(imgData);
    if (!rgbaData) continue;

    const pixCode = decodePixFromRgba(rgbaData, imgData.width, imgData.height);
    if (pixCode) return pixCode;
  }

  return null;
}

async function extractPixFromRenderedCrops(page: any): Promise<string | null> {
  const canvasModule = await getCanvasModule();
  if (!canvasModule) return null;

  const crops = [
    { scale: 4.0, x1: 0.02, y1: 0.08, x2: 0.4, y2: 0.45 },
    { scale: 4.0, x1: 0.03, y1: 0.13, x2: 0.25, y2: 0.38 },
    { scale: 4.0, x1: 0.05, y1: 0.21, x2: 0.32, y2: 0.43 },
    { scale: 4.0, x1: 0.82, y1: 0.86, x2: 0.93, y2: 0.94 },
    { scale: 3.0, x1: 0.35, y1: 0.75, x2: 0.65, y2: 0.98 },
    { scale: 2.5, x1: 0, y1: 0, x2: 1, y2: 1 },
    { scale: 1.5, x1: 0, y1: 0, x2: 1, y2: 1 },
  ];

  for (const crop of crops) {
    const viewport = page.getViewport({ scale: crop.scale });
    const cropX = viewport.width * crop.x1;
    const cropY = viewport.height * crop.y1;
    const cropW = Math.max(1, Math.round(viewport.width * (crop.x2 - crop.x1)));
    const cropH = Math.max(1, Math.round(viewport.height * (crop.y2 - crop.y1)));

    const canvas = canvasModule.createCanvas(cropW, cropH);
    const context = canvas.getContext("2d");

    await page.render({
      canvasContext: context,
      viewport,
      transform: [1, 0, 0, 1, -cropX, -cropY],
    } as any).promise;

    const imageData = context.getImageData(0, 0, cropW, cropH);
    const pixCode = decodePixFromRgba(
      new Uint8ClampedArray(imageData.data),
      imageData.width,
      imageData.height,
    );

    if (pixCode) return pixCode;
  }

  return null;
}

export async function extractPixCodeFromPdf(buffer: Buffer): Promise<string | null> {
  let pdfDocument: any = null;

  try {
    const data = new Uint8Array(buffer);
    const loadingTask = pdfjsLib.getDocument({
      data,
      disableFontFace: true,
      disableRange: true,
      standardFontDataUrl,

      useWasm: false,
    });

    pdfDocument = await loadingTask.promise;
    const numPages = Math.min(3, pdfDocument.numPages);

    for (let i = 1; i <= numPages; i++) {
      const page = await pdfDocument.getPage(i);

      const textContent = await page.getTextContent();
      const fullText = textContent.items.map((item: any) => item.str).join(" ");
      const textPix = extractPixFromText(fullText);
      if (textPix) return textPix;

      const embeddedImagePix = await extractPixFromEmbeddedImages(page);
      if (embeddedImagePix) return embeddedImagePix;

      const renderedPix = await extractPixFromRenderedCrops(page);
      if (renderedPix) return renderedPix;

      page.cleanup?.();
    }
  } catch (err) {
    console.error("Error reading PDF for QR Code:", err);
  } finally {
    await pdfDocument?.destroy?.();
  }

  return null;
}
