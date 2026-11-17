// Runs before the page paints so there's no flash of the wrong theme.
// Shared with next.config.mjs, which allows exactly this script in the Content Security Policy by its hash:
// change it here and the hash updates on the next build.
export const themeScript = `
(function () {
  try {
    var m = document.cookie.match(/(?:^|; )dt_theme=(light|dark)/);
    var theme = m ? m[1]
      : (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.dataset.theme = theme;
  } catch (e) {}
})();
`;
