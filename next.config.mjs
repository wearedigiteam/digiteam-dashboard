import { createHash } from 'crypto';
import { themeScript } from './lib/theme-script.mjs';

// The only inline script on the site is the theme script; allow exactly that one by hash
const themeHash = `'sha256-${createHash('sha256').update(themeScript).digest('base64')}'`;

const csp = [
  "default-src 'self'",
  `script-src 'self' ${themeHash}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", // React inline styles
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",                            // Userback screenshots, Slack avatars, GIFs
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "form-action 'self' https://accounts.google.com",
  "base-uri 'self'",
  "object-src 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The app doesn't use next/image; switching the optimizer off closes its endpoint (and its advisories)
  images: { unoptimized: true },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
