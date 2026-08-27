export function getCsrfToken(): string | null {
  const m = document.cookie.match(/(?:^|;\s*)dtms_csrf=([^;]*)/);
  return m ? m[1] : null;
}

export function csrfHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const csrf = getCsrfToken();
  if (csrf) extra['x-csrf-token'] = csrf;
  return extra;
}

const IS_MUTATION = ['POST', 'PUT', 'PATCH', 'DELETE'];

export function patchFetchCsrf() {
  const w = window as unknown as { __csrfOriginalFetch?: typeof fetch; __csrfPatched?: boolean };
  // Jika sudah pernah dipatch (HMR), kembalikan ke original dulu agar patch baru aktif
  if (w.__csrfPatched && w.__csrfOriginalFetch) {
    window.fetch = w.__csrfOriginalFetch;
  }
  const orig = window.fetch.bind(window);
  w.__csrfOriginalFetch = orig;
  w.__csrfPatched = true;
  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
    const method = (init?.method || 'GET').toUpperCase();
    if (IS_MUTATION.includes(method)) {
      const headers = new Headers(init?.headers || {});
      const csrf = getCsrfToken();
      if (csrf && !headers.has('x-csrf-token')) {
        headers.set('x-csrf-token', csrf);
      }
      const body: unknown = init?.body as unknown;
      const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
      const isBlobLike = body != null && typeof (body as { arrayBuffer?: unknown }).arrayBuffer === 'function' && (body as { constructor?: { name?: string } }).constructor?.name !== 'String';
      if (!headers.has('content-type') && body && !isFormData && !isBlobLike && typeof body !== 'string') {
        headers.set('content-type', 'application/json');
      }
      // Jangan pernah timpa content-type yang sudah diset untuk FormData (browser akan isi boundary)
      if (isFormData) headers.delete('content-type');
      init = { ...init, headers };
    }
    return orig(input as RequestInfo, init);
  };
}

export async function apiFetch(path: string, opts: RequestInit & { body?: unknown } = {}): Promise<Response> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(opts.body);
  }
  Object.assign(headers, csrfHeaders(opts.headers as Record<string, string> | undefined));
  const res = await fetch(path, { ...opts, headers, credentials: 'same-origin' });
  return res;
}

// HMR: jika sudah pernah dipatch, terapkan patch baru segera (tanpa perlu remount)
if (typeof window !== 'undefined' && (window as unknown as { __csrfPatched?: boolean }).__csrfPatched) {
  patchFetchCsrf();
}
