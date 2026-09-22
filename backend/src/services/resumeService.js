import { AppError } from '../utils/errors.js';

let pdfModulePromise;

// pdf-parse pulls in pdfjs-dist, whose legacy build references browser globals
// (DOMMatrix, ImageData, Path2D) while the module is evaluated. Serverless
// bundles such as Vercel's do not ship @napi-rs/canvas, and the module then
// throws `ReferenceError: DOMMatrix is not defined` before any code runs.
// Providing minimal shims first keeps the import safe; text extraction does not
// use canvas rendering, so empty placeholder classes are sufficient.
function installPdfGlobals() {
  if (typeof globalThis.DOMMatrix === 'undefined') globalThis.DOMMatrix = class DOMMatrix {};
  if (typeof globalThis.ImageData === 'undefined') globalThis.ImageData = class ImageData {};
  if (typeof globalThis.Path2D === 'undefined') globalThis.Path2D = class Path2D {};
}

async function loadPdfParse() {
  if (!pdfModulePromise) {
    installPdfGlobals();
    pdfModulePromise = import('pdf-parse');
  }
  return pdfModulePromise;
}

export async function extractResumeText(buffer) {
  let parser;
  try {
    const { PDFParse } = await loadPdfParse();
    parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    const text = typeof result === 'string' ? result : result?.text ?? '';
    if (!text.trim()) {
      throw new AppError('No readable text found in this PDF', 422, 'resume_unreadable');
    }
    return text.trim();
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError('Resume could not be read or parsed', 422, 'resume_unreadable');
  } finally {
    parser?.destroy?.();
  }
}