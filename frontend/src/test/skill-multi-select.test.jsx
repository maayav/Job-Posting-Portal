import { describe, it, expect } from 'vitest';
import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import SkillMultiSelect from '../components/SkillMultiSelect';

const OPTIONS = ['React', 'Node.js', 'Python', 'AWS'];

function Harness({ initial = [] }) {
  const [value, setValue] = useState(initial);
  return <SkillMultiSelect value={value} onChange={setValue} options={OPTIONS} />;
}

describe('SkillMultiSelect', () => {
  it('selects several skills at once from the checkbox panel', () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: /select skills/i }));
    fireEvent.click(screen.getByLabelText('React'));
    fireEvent.click(screen.getByLabelText('Node.js'));

    expect(screen.getByLabelText('React').checked).toBe(true);
    expect(screen.getByLabelText('Node.js').checked).toBe(true);
    expect(screen.getByText('2 selected')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remove React' })).toBeTruthy();
  });

  it('adds a typed custom skill and removes chips', () => {
    render(<Harness initial={['React']} />);

    fireEvent.click(screen.getByRole('button', { name: /add more/i }));
    const search = screen.getByPlaceholderText(/search skills/i);
    fireEvent.change(search, { target: { value: 'rust' } });
    fireEvent.keyDown(search, { key: 'Enter' });

    expect(screen.getByRole('button', { name: 'Remove rust' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Remove React' }));
    expect(screen.queryByRole('button', { name: 'Remove React' })).toBeNull();
  });
});
