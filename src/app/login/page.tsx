import type { Metadata } from 'next';
import LoginForm from './LoginForm';

export const metadata: Metadata = { title: 'Masuk | DTMS' };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F9FC] p-4">
      <LoginForm />
    </div>
  );
}
