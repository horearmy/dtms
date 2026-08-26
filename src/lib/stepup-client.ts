'use client';

/**
 * Klien untuk aksi kritis superadmin (Blueprint §20/§21).
 * Jika server membalas 403 { stepUpRequired: true }, minta password
 * sekali, tukar dengan stepUpToken (5 menit), lalu ulangi request.
 */

type StepUpInit = Omit<RequestInit, 'body'> & { body?: unknown };

export async function fetchWithStepUp(input: string, init: StepUpInit): Promise<Response> {
  const serialize = (b: StepUpInit['body']) =>
    b === undefined ? undefined : typeof b === 'string' ? b : JSON.stringify(b);

  const doFetch = (token?: string) => {
    const headers = new Headers(init.headers);
    headers.set('Content-Type', 'application/json');
    if (token) headers.set('x-step-up-token', token);
    return fetch(input, {
      ...init,
      method: init.method,
      headers,
      body: serialize(init.body),
    });
  };

  let res = await doFetch();

  if (res.status === 403) {
    const data = (await res.clone().json().catch(() => ({}))) as { stepUpRequired?: boolean; error?: string };
    if (data.stepUpRequired) {
      const password = window.prompt(`Aksi kritis — ${data.error || 'verifikasi ulang diperlukan'}.\n\nMasukkan password Anda:`);
      if (!password) throw new Error('Verifikasi ulang dibatalkan');
      const sr = await fetch('/api/admin/security/step-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const sd = (await sr.json().catch(() => ({}))) as { stepUpToken?: string; error?: string };
      if (!sr.ok || !sd.stepUpToken) throw new Error(sd.error || 'Verifikasi ulang gagal');
      res = await doFetch(sd.stepUpToken);
    }
  }
  return res;
}
