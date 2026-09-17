import { useTheme } from '../context/ThemeContext';
import Icon from './Icon';

export default function ThemeToggle({ className = '' }) {
  const { theme, toggleTheme } = useTheme();
  const accessibleLabel = `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`;
  return (
    <button
      type="button"
      className={`theme-toggle ${className}`}
      onClick={toggleTheme}
      aria-label={accessibleLabel}
      title={accessibleLabel}
    >
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
    </button>
  );
}
