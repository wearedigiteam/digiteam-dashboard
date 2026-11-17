import { Html, Head, Main, NextScript } from 'next/document';

// Theme script (runs before paint): lib/theme-script.mjs, also allowed by hash in next.config.mjs
import { themeScript } from '../lib/theme-script.mjs';

export default function Document() {
  return (
    <Html lang="en-CA">
      <Head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </Head>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
