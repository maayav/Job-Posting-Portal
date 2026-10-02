try {
  const theme = localStorage.getItem('theme');
  document.documentElement.dataset.theme = theme === 'dark' ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#171716' : '#f5f1e9';
} catch (_) {}
