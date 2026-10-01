import type { Metadata, Viewport } from 'next';
import './globals.css';
import './cyber.css';
export const metadata: Metadata = { title: 'NEON DRIFT — After hours. No limits.', description: 'A lightweight, endless single-player cyberpunk shooter. Enter the grid.', icons: { icon: { url: '/favicon.svg?v=neon-3', type: 'image/svg+xml', sizes: 'any' } } };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#09051c' };
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
