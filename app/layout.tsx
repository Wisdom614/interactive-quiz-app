import type { Metadata, Viewport } from 'next';
import './globals.css';
import 'katex/dist/katex.min.css';
import { Navbar } from '@/components/Navbar';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#020617',
};

export const metadata: Metadata = {
  title: 'Checkers Arena & Kinetic Quiz',
  description: 'Real-time 1v1 African Checkers Arena and live multiplayer trivia battles powered by AI and Supabase Realtime.',
  manifest: '/manifest.json',
  applicationName: 'Checkers Arena',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Checkers Arena',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: [
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#f8f9fa] text-zinc-950 min-h-screen flex flex-col antialiased selection:bg-zinc-900 selection:text-white">
        <Navbar />
        <main className="flex-1 flex flex-col">
          {children}
        </main>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
