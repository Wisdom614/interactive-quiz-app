import type { Metadata } from 'next';
import './globals.css';
import 'katex/dist/katex.min.css';
import { Navbar } from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'Kinetic AI - Real-time AI Multiplayer Trivia Arena',
  description: 'High-speed, competitive live multiplayer trivia powered by Grok AI and Supabase Realtime.',
  keywords: ['Kinetic AI', 'Live Quiz', 'Multiplayer Trivia', 'Grok AI', 'Supabase Realtime'],
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/icon.svg',
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
      </body>
    </html>
  );
}
