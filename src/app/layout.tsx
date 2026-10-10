import type { Metadata } from 'next';
import './globals.css';
import { getSettings, hexToRgbTriplet } from '@/lib/settings';

export const metadata: Metadata = { title: 'Contratti — Love Coach Academy', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const s = await getSettings();
  return (
    <html lang="it">
      <body className="min-h-screen antialiased" style={{ ['--brand' as string]: hexToRgbTriplet(s.brandColor) }}>
        {children}
      </body>
    </html>
  );
}
