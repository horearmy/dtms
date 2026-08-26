import type { Metadata } from 'next';
import Link from 'next/link';
import LoginForm from './LoginForm';

export const metadata: Metadata = { title: 'Masuk | DTMS' };

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#F7F9FC] p-4">
      <LoginForm />
      <Link
        href="/admin/secure-login"
        className="absolute bottom-4 right-4 text-xs text-gray-300 transition hover:text-gray-500"
      >
        Portal Admin
      </Link>
    </div>
  );
}
