import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DTMS - Delivery Tracking & Management System',
  description: 'Sistem tracking dan manajemen pengiriman terintegrasi',
  manifest: '/manifest.webmanifest',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}