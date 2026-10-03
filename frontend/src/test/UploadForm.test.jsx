import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import UploadForm from '../components/UploadForm';
import { api } from '../api/client';

vi.mock('../api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
  errorMessage: (err) => err?.message ?? 'error',
}));

describe('UploadForm target-role selector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders every role returned by GET /api/roles', async () => {
    api.get.mockResolvedValue({
      data: {
        roles: [
          { id: 'SDE', label: 'Software Development Engineer' },
          { id: 'ML Engineer', label: 'ML Engineer' },
          { id: 'Data Scientist', label: 'Data Scientist' },
        ],
      },
    });

    render(<UploadForm onSubmit={vi.fn()} loading={false} />);

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/roles'));

    const select = screen.getByLabelText(/target role/i);
    const options = Array.from(select.querySelectorAll('option')).map((o) => ({
      value: o.value,
      text: o.textContent,
    }));

    expect(options).toEqual([
      { value: 'SDE', text: 'Software Development Engineer' },
      { value: 'ML Engineer', text: 'ML Engineer' },
      { value: 'Data Scientist', text: 'Data Scientist' },
    ]);
  });

  it('defaults to the first role from the backend', async () => {
    api.get.mockResolvedValue({
      data: { roles: [{ id: 'ML Engineer', label: 'ML Engineer' }] },
    });

    render(<UploadForm onSubmit={vi.fn()} loading={false} />);

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/roles'));
    const select = screen.getByLabelText(/target role/i);
    expect(select.value).toBe('ML Engineer');
  });

  it('shows an error state when roles cannot be loaded', async () => {
    api.get.mockRejectedValue(new Error('network down'));

    render(<UploadForm onSubmit={vi.fn()} loading={false} />);

    expect(await screen.findByText(/could not load target roles/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /upload & extract skills/i }).disabled).toBe(true);
  });

  it('selects AI Engineer when opened from its role guide', async () => {
    api.get.mockResolvedValue({ data: { roles: [{ id: 'SDE', label: 'Software Development Engineer' }, { id: 'AI Engineer', label: 'AI Engineer' }] } });
    render(<UploadForm onSubmit={vi.fn()} loading={false} requestedRole="AI Engineer" />);
    await waitFor(() => expect(screen.getByLabelText(/target role/i).value).toBe('AI Engineer'));
  });

  it('passes LinkedIn URL and user-provided summary as optional inputs', async () => {
    api.get.mockResolvedValue({ data: { roles: [{ id: 'SDE', label: 'Software Development Engineer' }] } });
    const onSubmit = vi.fn();
    render(<UploadForm onSubmit={onSubmit} loading={false} />);
    await waitFor(() => expect(screen.getByLabelText(/target role/i).value).toBe('SDE'));

    fireEvent.change(screen.getByLabelText(/linkedin profile url/i), { target: { value: 'https://www.linkedin.com/in/example-user/' } });
    fireEvent.change(screen.getByLabelText(/linkedin about or profile text/i), { target: { value: 'Built React dashboards.' } });
    fireEvent.change(screen.getByLabelText(/resume \(pdf\)/i), { target: { files: [new File(['pdf'], 'resume.pdf', { type: 'application/pdf' })] } });
    fireEvent.submit(screen.getByRole('button', { name: /upload & extract skills/i }).closest('form'));

    expect(onSubmit).toHaveBeenCalledWith(expect.any(File), '', 'https://www.linkedin.com/in/example-user/', 'Built React dashboards.', '', 'SDE', { codingProfileUrl: '', codingSummaryText: '' });
  });

  it('imports a LinkedIn PDF into editable text without submitting the profile', async () => {
    api.get.mockResolvedValue({ data: { roles: [{ id: 'SDE', label: 'Software Development Engineer' }] } });
    api.post.mockResolvedValue({ data: { text: 'Built Python tools.', truncated: false } });
    const onSubmit = vi.fn();
    render(<UploadForm onSubmit={onSubmit} loading={false} />);
    const pdf = new File(['pdf'], 'linkedin.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText(/import your linkedin profile pdf/i), { target: { files: [pdf] } });
    await waitFor(() => expect(screen.getByLabelText(/linkedin about or profile text/i).value).toBe('Built Python tools.'));
    expect(api.post.mock.calls[0][0]).toBe('/profile/linkedin-preview');
    expect(api.post.mock.calls[0][1].get('linkedin')).toBe(pdf);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rejects resumes above the deployed 4MB limit before submitting', async () => {
    api.get.mockResolvedValue({ data: { roles: [{ id: 'SDE', label: 'Software Development Engineer' }] } });
    const onSubmit = vi.fn();
    render(<UploadForm onSubmit={onSubmit} loading={false} />);
    await waitFor(() => expect(screen.getByLabelText(/target role/i).value).toBe('SDE'));
    const oversized = new File([new Uint8Array(4 * 1024 * 1024 + 1)], 'resume.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText(/resume \(pdf\)/i), { target: { files: [oversized] } });
    fireEvent.submit(screen.getByRole('button', { name: /upload & extract skills/i }).closest('form'));
    expect(screen.getByText('Resume must be 4MB or smaller.')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('passes optional coding evidence alongside the resume', async () => {
    api.get.mockResolvedValue({ data: { roles: [{ id: 'SDE', label: 'Software Development Engineer' }] } });
    const onSubmit = vi.fn();
    render(<UploadForm onSubmit={onSubmit} loading={false} />);
    await waitFor(() => expect(screen.getByLabelText(/target role/i).value).toBe('SDE'));
    const resume = new File(['pdf'], 'resume.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText(/resume \(pdf\)/i), { target: { files: [resume] } });
    fireEvent.change(screen.getByLabelText(/coding profile username or url/i), { target: { value: 'https://www.hackerrank.com/profile/demo-user' } });
    fireEvent.change(screen.getByLabelText(/coding practice evidence/i), { target: { value: 'Solved array problems using Python.' } });
    fireEvent.submit(screen.getByRole('button', { name: /upload & extract skills/i }).closest('form'));
    expect(onSubmit).toHaveBeenCalledWith(resume, '', '', '', '', 'SDE', {
      codingProfileUrl: 'https://www.hackerrank.com/profile/demo-user',
      codingSummaryText: 'Solved array problems using Python.',
    });
  });

  it('blocks profile submission during LinkedIn import and preserves editable text on failure', async () => {
    api.get.mockResolvedValue({ data: { roles: [{ id: 'SDE', label: 'Software Development Engineer' }] } });
    let rejectImport;
    api.post.mockImplementation(() => new Promise((resolve, reject) => { rejectImport = reject; }));
    render(<UploadForm onSubmit={vi.fn()} loading={false} />);
    await waitFor(() => expect(screen.getByLabelText(/target role/i).value).toBe('SDE'));
    const summary = screen.getByLabelText(/linkedin about or profile text/i);
    fireEvent.change(summary, { target: { value: 'My original profile text.' } });
    fireEvent.change(screen.getByLabelText(/import your linkedin profile pdf/i), { target: { files: [new File(['pdf'], 'linkedin.pdf', { type: 'application/pdf' })] } });
    expect(screen.getByRole('button', { name: /upload & extract skills/i }).disabled).toBe(true);
    rejectImport(new Error('The PDF has no readable text.'));
    expect(await screen.findByText('The PDF has no readable text.')).toBeTruthy();
    expect(summary.value).toBe('My original profile text.');
    expect(screen.getByRole('button', { name: /upload & extract skills/i }).disabled).toBe(false);
  });

  it('rejects an unsupported LinkedIn import before calling the preview API', async () => {
    api.get.mockResolvedValue({ data: { roles: [{ id: 'SDE', label: 'Software Development Engineer' }] } });
    render(<UploadForm onSubmit={vi.fn()} loading={false} />);
    fireEvent.change(screen.getByLabelText(/import your linkedin profile pdf/i), { target: { files: [new File(['text'], 'linkedin.txt', { type: 'text/plain' })] } });
    expect(await screen.findByText('Choose a LinkedIn PDF smaller than 4MB.')).toBeTruthy();
    expect(api.post).not.toHaveBeenCalled();
  });

  it.each([
    'https://www.linkedin.com:444/in/example-user/',
    'https://www.linkedin.com/in/example%ZZ/',
    'https://www.linkedin.com/in/example%2Fuser/',
  ])('allows a corrected LinkedIn URL after rejecting %s', async (invalidUrl) => {
    api.get.mockResolvedValue({ data: { roles: [{ id: 'SDE', label: 'Software Development Engineer' }] } });
    const onSubmit = vi.fn();
    render(<UploadForm onSubmit={onSubmit} loading={false} />);
    await waitFor(() => expect(screen.getByLabelText(/target role/i).value).toBe('SDE'));
    const resume = new File(['pdf'], 'resume.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText(/resume \(pdf\)/i), { target: { files: [resume] } });
    const linkedinInput = screen.getByLabelText(/linkedin profile url/i);
    const form = screen.getByRole('button', { name: /upload & extract skills/i }).closest('form');
    fireEvent.change(linkedinInput, { target: { value: invalidUrl } });
    fireEvent.submit(form);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/enter a public https linkedin profile url/i)).toBeTruthy();

    const correctedUrl = 'https://www.linkedin.com/in/maayav-%E6%9D%8E/';
    fireEvent.change(linkedinInput, { target: { value: correctedUrl } });
    fireEvent.submit(form);
    expect(onSubmit).toHaveBeenCalledWith(resume, '', correctedUrl, '', '', 'SDE', { codingProfileUrl: '', codingSummaryText: '' });
    expect(screen.queryByText(/enter a public https linkedin profile url/i)).toBeNull();
  });
});

describe('UploadForm combined coding profile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockResolvedValue({ data: { roles: [{ id: 'SDE', label: 'Software Development Engineer' }] } });
  });

  async function readyForm() {
    const onSubmit = vi.fn();
    render(<UploadForm onSubmit={onSubmit} loading={false} />);
    await waitFor(() => expect(screen.getByLabelText(/target role/i).value).toBe('SDE'));
    const resume = new File(['pdf'], 'resume.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText(/resume \(pdf\)/i), { target: { files: [resume] } });
    const input = screen.getByLabelText(/coding profile username or url/i);
    const form = screen.getByRole('button', { name: /upload & extract skills/i }).closest('form');
    return { onSubmit, resume, input, form };
  }

  it('renders one optional field for all supported coding profiles', async () => {
    const { input, form, onSubmit, resume } = await readyForm();
    expect(screen.getAllByLabelText(/coding profile username or url/i)).toHaveLength(1);
    expect(screen.queryByLabelText(/^leetcode username or profile url/i)).toBeNull();
    expect(screen.queryByLabelText(/^hackerrank, codeforces, or codechef profile/i)).toBeNull();
    expect(input.required).toBe(false);
    fireEvent.submit(form);
    expect(onSubmit).toHaveBeenCalledWith(resume, '', '', '', '', 'SDE', { codingProfileUrl: '', codingSummaryText: '' });
  });

  it.each([
    ['  demo_user-1  ', 'demo_user-1'],
    ['https://leetcode.com/u/demo-user/', 'demo-user'],
    ['leetcode.com/u/demo-user', 'demo-user'],
    ['https://www.leetcode.com/profile/demo.user/', 'demo.user'],
  ])('routes LeetCode input %s to its username field', async (value, username) => {
    const { onSubmit, resume, input, form } = await readyForm();
    fireEvent.change(input, { target: { value } });
    fireEvent.submit(form);
    expect(onSubmit).toHaveBeenCalledWith(resume, '', '', '', username, 'SDE', { codingProfileUrl: '', codingSummaryText: '' });
  });

  it.each([
    'https://www.hackerrank.com/profile/demo-user',
    'https://hackerrank.com/demo-user',
    'https://codeforces.com/profile/demo.user',
    'https://www.codechef.com/users/demo_user',
  ])('routes supported profile %s to its evidence link field', async (url) => {
    const { onSubmit, resume, input, form } = await readyForm();
    fireEvent.change(input, { target: { value: `  ${url}  ` } });
    fireEvent.submit(form);
    expect(onSubmit).toHaveBeenCalledWith(resume, '', '', '', '', 'SDE', { codingProfileUrl: url, codingSummaryText: '' });
  });

  it.each([
    'https://example.com/profile/demo-user',
    'https://leetcode.com.evil.example/u/demo-user',
    'https://leetcode.com/',
    'https://leetcode.com/u/demo-user/extra',
    'http://codeforces.com/profile/demo-user',
    'https://www.hackerrank.com:444/profile/demo-user',
    'https://user:password@codechef.com/users/demo-user',
    'https://codeforces.com/demo-user',
    'https://codeforces.com/profile/demo-user https://leetcode.com/u/demo-user/',
    'invalid username',
    'a'.repeat(121),
  ])('rejects invalid coding profile %s before submission', async (value) => {
    const { onSubmit, input, form } = await readyForm();
    fireEvent.change(input, { target: { value } });
    fireEvent.submit(form);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/^enter a leetcode username or profile url/i)).toBeTruthy();

    fireEvent.change(input, { target: { value: 'https://codechef.com/users/demo-user' } });
    fireEvent.submit(form);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/^enter a leetcode username or profile url/i)).toBeNull();
  });

  it('clears the inactive backend field when switching platforms or removing the profile', async () => {
    const { onSubmit, resume, input, form } = await readyForm();
    fireEvent.change(screen.getByLabelText(/coding practice evidence/i), { target: { value: 'Practiced Python arrays.' } });

    const profiles = [
      { value: 'https://leetcode.com/u/demo-user/', leetcode: 'demo-user', codingProfileUrl: '' },
      { value: 'https://codeforces.com/profile/demo-user', leetcode: '', codingProfileUrl: 'https://codeforces.com/profile/demo-user' },
      { value: 'second-user', leetcode: 'second-user', codingProfileUrl: '' },
      { value: '', leetcode: '', codingProfileUrl: '' },
    ];
    profiles.forEach(({ value, leetcode, codingProfileUrl }, index) => {
      fireEvent.change(input, { target: { value } });
      fireEvent.submit(form);
      expect(onSubmit).toHaveBeenNthCalledWith(index + 1, resume, '', '', '', leetcode, 'SDE', {
        codingProfileUrl,
        codingSummaryText: 'Practiced Python arrays.',
      });
    });
  });
});
