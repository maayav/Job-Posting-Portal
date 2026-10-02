import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getDocumentProxy: vi.fn(), extractText: vi.fn() }));
vi.mock('unpdf', () => mocks);
import { extractResumeText, MAX_RESUME_TEXT_CHARS } from '../src/services/resumeService.js';

describe('resume parsing resource bounds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDocumentProxy.mockResolvedValue({ numPages: 1 });
  });
  it('rejects excessive PDF pages before extracting their text', async () => {
    mocks.getDocumentProxy.mockResolvedValue({ numPages: 31 });
    await expect(extractResumeText(Buffer.from('mock-pdf'))).rejects.toMatchObject({ code: 'resume_too_long' });
    expect(mocks.extractText).not.toHaveBeenCalled();
  });
  it('rejects excessive text before storage or AI processing', async () => {
    mocks.extractText.mockResolvedValue({ text: 'x'.repeat(MAX_RESUME_TEXT_CHARS + 1) });
    await expect(extractResumeText(Buffer.from('mock-pdf'))).rejects.toMatchObject({ code: 'resume_too_long' });
  });
  it('preserves readable evidence within the bounds', async () => {
    mocks.extractText.mockResolvedValue({ text: 'Resume skills and experience. '.repeat(8) });
    expect(await extractResumeText(Buffer.from('mock-pdf'))).toContain('skills and experience');
  });
});
