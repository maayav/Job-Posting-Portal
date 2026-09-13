import { PDFParse } from 'pdf-parse';
import { AppError } from '../utils/errors.js';

export async function extractResumeText(buffer) {
  let parser;
  try {
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