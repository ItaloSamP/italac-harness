(function () {
  try {
    var saved = localStorage.getItem('harness-hub-theme');
    if (saved === 'light' || saved === 'dark') {
      document.documentElement.setAttribute('data-theme', saved);
    }
  } catch (_) {
    // ignore storage errors
  }
})();
