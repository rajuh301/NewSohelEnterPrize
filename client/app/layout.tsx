import './globals.css';
import type { Metadata, Viewport } from 'next';
export const metadata: Metadata = { title: 'সোয়েল এন্টারপ্রাইজ' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="bn"><head>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;700&display=swap" rel="stylesheet" />
  </head><body>{children}</body></html>);
}
