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
  const orig = window.fetch;
  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
    const method = (init?.method || 'GET').toUpperCase();
    if (IS_MUTATION.includes(method)) {
      const headers = new Headers(init?.headers || {});
      const csrf = getCsrfToken();
      if (csrf && !headers.has('x-csrf-token')) {
        headers.set('x-csrf-token', csrf);
      }
      if (!headers.has('content-type') && init?.body) {
        headers.set('content-type', 'application/json');
      }
      init = { ...init, headers };
    }
    return orig.call(this, input, init);
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
