import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { cn } from '@/lib/utils';
import { TooltipProvider } from '@/components/ui/tooltip';
import CsrfProvider from '@/components/CsrfProvider';
import PWARegister from '@/components/PWARegister';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#061B41',
};

export const metadata: Metadata = {
  title: 'DTMS - Delivery Tracking & Management System',
  description: 'Sistem tracking dan manajemen pengiriman terintegrasi',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'DTMS',
  },
  icons: {
    icon: '/favicon-32x32.png',
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={cn('font-sans antialiased scroll-smooth', jakarta.variable)}>
      <body>
        <PWARegister />
        <CsrfProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </CsrfProvider>
      </body>
    </html>
  );
}
