import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import UploadPage from '../pages/UploadPage';
import { api } from '../api/client';

vi.mock('../api/client', () => ({
  api: { get: vi.fn(), post: vi.fn() },
  errorMessage: (error) => error?.response?.data?.message ?? error?.message ?? 'error',
}));
vi.mock('../components/NavBar', () => ({ default: () => null }));
vi.mock('../components/UploadForm', () => ({ default: () => null }));

const submission = {
  id: 'submission-1',
  target_role: 'AI Engineer',
  extraction_status: 'completed',
  extracted_skills: [{ name: 'Python', confidence: 'high', sources: ['resume'], evidence: [] }],
};

async function openReview() {
  localStorage.setItem('analysis_submission_id', submission.id);
  render(
    <MemoryRouter initialEntries={['/analysis/new']}>
      <Routes>
        <Route path="/analysis/new" element={<UploadPage />} />
        <Route path="/dashboard" element={<h1>Analysis dashboard</h1>} />
      </Routes>
    </MemoryRouter>,
  );
  return screen.findByRole('button', { name: /analyze & score for AI Engineer/i });
}

function cooldownError(seconds = 3) {
  return {
    response: {
      status: 429,
      data: { error: 'analysis_cooldown', retryAfterSeconds: seconds, report_id: 'recent-report' },
    },
  };
}

describe('UploadPage analysis responses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    api.get.mockImplementation((url) => {
      if (url === `/profile/${submission.id}`) return Promise.resolve({ data: submission });
      if (url === `/analyze/submission/${submission.id}/status`) {
        return Promise.resolve({ data: { stage: 'planning' } });
      }
      return Promise.reject(new Error(`Unexpected API request: ${url}`));
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('opens an immediately completed report without waiting for a polling interval', async () => {
    api.post.mockResolvedValue({ data: { report_id: 'completed-report', status: 'completed' } });

    fireEvent.click(await openReview());

    expect(await screen.findByRole('heading', { name: 'Analysis dashboard' })).toBeTruthy();
    expect(api.post).toHaveBeenCalledExactlyOnceWith('/analyze', { submission_id: submission.id });
    expect(localStorage.getItem('report_id')).toBe('completed-report');
    expect(localStorage.getItem('analysis_report_id')).toBeNull();
    expect(localStorage.getItem('analysis_submission_id')).toBeNull();
    expect(api.get).not.toHaveBeenCalledWith('/analyze/completed-report/status');
  });

  it('returns an immediately failed analysis to review so the saved resume can be retried', async () => {
    api.post.mockResolvedValue({
      data: { report_id: 'failed-report', status: 'failed', errorCode: 'provider_unavailable' },
    });

    fireEvent.click(await openReview());

    expect(await screen.findByText('Analysis failed: provider_unavailable.')).toBeTruthy();
    expect(screen.getByRole('button', { name: /analyze & score for AI Engineer/i }).disabled).toBe(false);
    expect(localStorage.getItem('analysis_submission_id')).toBe(submission.id);
    expect(localStorage.getItem('analysis_report_id')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Analysis dashboard' })).toBeNull();
    expect(api.get).not.toHaveBeenCalledWith('/analyze/failed-report/status');
  });

  it('offers the existing report after a cooldown response without starting another analysis', async () => {
    api.post.mockRejectedValue(cooldownError());

    fireEvent.click(await openReview());

    const viewReport = await screen.findByRole('button', { name: /view latest report/i });
    expect(screen.getByRole('button', { name: 'Analyze again in 3s' }).disabled).toBe(true);
    fireEvent.click(viewReport);

    expect(await screen.findByRole('heading', { name: 'Analysis dashboard' })).toBeTruthy();
    expect(localStorage.getItem('report_id')).toBe('recent-report');
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  it('blocks repeated analysis during cooldown and enables retry when the countdown ends', async () => {
    api.post.mockRejectedValueOnce(cooldownError()).mockResolvedValueOnce({
      data: { report_id: 'retry-report', status: 'completed' },
    });
    const analyze = await openReview();
    vi.useFakeTimers();

    await act(async () => { fireEvent.click(analyze); });
    const disabledAnalyze = screen.getByRole('button', { name: 'Analyze again in 3s' });
    expect(disabledAnalyze.disabled).toBe(true);
    fireEvent.click(disabledAnalyze);
    expect(api.post).toHaveBeenCalledTimes(1);

    for (const secondsRemaining of [2, 1]) {
      await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
      expect(screen.getByRole('button', { name: `Analyze again in ${secondsRemaining}s` }).disabled).toBe(true);
    }
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    const retry = screen.getByRole('button', { name: /analyze & score for AI Engineer/i });
    expect(retry.disabled).toBe(false);
    await act(async () => { fireEvent.click(retry); });

    vi.useRealTimers();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Analysis dashboard' })).toBeTruthy());
    expect(api.post).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem('report_id')).toBe('retry-report');
  });
});
