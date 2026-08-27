"use client";

export default function LogoutButton() {
  async function logout() {
    window.location.assign('/api/auth/logout');
  }
  return (
    <button
      type="button"
      onClick={logout}
      className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/20"
    >
      Keluar
    </button>
  );
}
