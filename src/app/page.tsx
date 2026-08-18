import type { Metadata } from 'next';
import LandingClient from './LandingClient';

export const metadata: Metadata = {
  title: 'DTMS - Delivery Tracking & Management System',
  description: 'Sistem manajemen pengiriman terlengkap. Lacak pengiriman real-time, kelola armada, optimasi rute, dan tingkatkan layanan Anda.',
};

export default function LandingPage() {
  return <LandingClient />;
}
