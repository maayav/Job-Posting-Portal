import { describe, expect, it, vi } from 'vitest';
import { buildDemoResumePdf, isDemoSubmission } from '../src/services/demoResumeService.js';
import { isResumeBlobRef } from '../src/services/storageService.js';

describe('demo resume generation', () => {
  it('builds a viewable PDF from stored demo resume text', () => {
    const buffer = buildDemoResumePdf('VORTEX / FICTIONAL DEMO RESUME\nAisha Verma\nFrontend Developer\nBuilt a React dashboard.');
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buffer.toString('latin1')).toContain('(Aisha Verma)');
  });

  it('writes a valid cross-reference table and parses without PDF recovery', async () => {
    const resume = 'VORTEX / FICTIONAL DEMO RESUME\nAisha Verma\nFrontend Developer\nBuilt and tested a React dashboard.';
    const buffer = buildDemoResumePdf(resume);
    const pdf = buffer.toString('latin1');
    const startxref = pdf.match(/startxref\s+(\d+)\s+%%EOF\s*$/);
    expect(startxref).not.toBeNull();
    const table = pdf.slice(Number(startxref[1]));
    const header = table.match(/^xref\s+0\s+(\d+)\s*\n/);
    expect(header).not.toBeNull();
    const entries = table.slice(header[0].length).split(/\r?\n/).slice(0, Number(header[1]));
    expect(entries[0]).toMatch(/^0000000000 65535 f\s*$/);
    entries.slice(1).forEach((entry, index) => {
      expect(entry).toMatch(/^\d{10} 00000 n\s*$/);
      expect(pdf.slice(Number(entry.slice(0, 10)))).toMatch(new RegExp(`^${index + 1} 0 obj`));
    });

    const { extractText, getDocumentProxy } = await import('unpdf');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    let document;
    try {
      document = await getDocumentProxy(new Uint8Array(buffer));
      const { text } = await extractText(document, { mergePages: true });
      expect(text.replace(/\s+/g, ' ').trim()).toBe(resume.replace(/\s+/g, ' '));
      const messages = [...warn.mock.calls, ...log.mock.calls].map((call) => call.join(' ')).join('\n');
      expect(messages).not.toMatch(/indexing all pdf objects/i);
    } finally {
      await document?.destroy?.();
      warn.mockRestore();
      log.mockRestore();
    }
  });

  it('escapes PDF delimiters and drops non-ASCII characters', () => {
    const buffer = buildDemoResumePdf('Candidate (demo) \\ path \u2014 dash');
    const text = buffer.toString('latin1');
    expect(text).toContain('\\(demo\\)');
    expect(text).toContain('\\\\ path');
    expect(text).not.toContain('\u2014');
  });

  it('returns null for empty input and caps very long documents', () => {
    expect(buildDemoResumePdf('')).toBeNull();
    const buffer = buildDemoResumePdf(Array.from({ length: 400 }, (_, index) => `Line ${index} with some words`).join('\n'));
    expect((buffer.toString('latin1').match(/BT \/F1/g) || [])).toHaveLength(44);
  });

  it('identifies only seed-generated demo records for self-healing', () => {
    expect(isDemoSubmission({ demo_key: 'x' })).toBe(true);
    expect(isDemoSubmission({ resume_file_ref: 'demo-review/a.pdf' })).toBe(true);
    expect(isDemoSubmission({ resume_file_ref: 'abc.pdf' }, { applicantEmail: 'demo.student1@vortex.dev' })).toBe(false);
    expect(isDemoSubmission({ resume_file_ref: 'abc.pdf' }, { applicantEmail: 'real@example.com' })).toBe(false);
    expect(isDemoSubmission(null)).toBe(false);
  });

  it('recognizes the durable blob reference prefix', () => {
    expect(isResumeBlobRef('db:abc')).toBe(true);
    expect(isResumeBlobRef('abc.pdf')).toBe(false);
    expect(isResumeBlobRef(undefined)).toBe(false);
  });
});
