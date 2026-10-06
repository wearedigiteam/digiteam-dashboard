import { Html, Head, Main, NextScript } from 'next/document';

// Runs before the page paints so there's no flash of the wrong theme.
// Uses the dt_theme cookie if set; otherwise follows the operating system setting.
const themeScript = `
(function () {
  try {
    var m = document.cookie.match(/(?:^|; )dt_theme=(light|dark)/);
    var theme = m ? m[1]
      : (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.dataset.theme = theme;
  } catch (e) {}
})();
`;

export default function Document() {
  return (
    <Html lang="en-CA">
      <Head />
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
