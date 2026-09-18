import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AssistantAnswer } from '../pages/AssistantPage';

describe('AI assistant answer formatting', () => {
  it('formats a mixed Markdown reply and rejects unsafe link protocols', () => {
    const reply = [
      '## Recommended next steps',
      'Based on **your React experience**, focus on TypeScript and `useState`.',
      '',
      '1. Build a typed project',
      '2. Review your component patterns',
      '',
      '- Add a focused test suite',
      '- Share the project in your portfolio',
      '',
      'Read [MDN](https://developer.mozilla.org/) and [this unsafe link](javascript:alert(1)).',
      '',
      '```js',
      'const skills = ["React"];',
      '```',
      '<script>alert("not HTML")</script>',
    ].join('\n');

    const { container } = render(<AssistantAnswer content={reply} />);

    expect(screen.getByRole('heading', { name: 'Recommended next steps', level: 2 })).toBeTruthy();
    expect(screen.getByText('your React experience').tagName).toBe('STRONG');
    expect(screen.getByText('useState').tagName).toBe('CODE');
    expect(screen.getAllByRole('list')).toHaveLength(2);
    expect(screen.getByText('Build a typed project')).toBeTruthy();
    expect(screen.getByText('Add a focused test suite')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'MDN' }).getAttribute('href')).toBe('https://developer.mozilla.org/');
    expect(screen.queryByRole('link', { name: 'this unsafe link' })).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('pre code')?.textContent).toBe('const skills = ["React"];');
    expect(screen.getByText('<script>alert("not HTML")</script>')).toBeTruthy();
  });
});
