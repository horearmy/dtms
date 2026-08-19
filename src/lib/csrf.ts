function getCsrfToken(): string {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(/(?:^|;\s*)dtms_csrf=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : '';
}

export async function csrfFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method || 'GET').toUpperCase();
  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

  const headers = new Headers(init.headers);
  if (isMutation) {
    headers.set('x-csrf-token', getCsrfToken());
  }
  if (!headers.has('Content-Type') && init.body && typeof init.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(url, { ...init, headers });
}

let patched = false;

export function patchFetchCsrf() {
  if (patched || typeof window === 'undefined') return;
  patched = true;

  const originalFetch = window.fetch;
  window.fetch = function patchedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const method = (init?.method || 'GET').toUpperCase();
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const headers = new Headers(init?.headers);
      if (!headers.has('x-csrf-token')) {
        headers.set('x-csrf-token', getCsrfToken());
      }
      if (!headers.has('Content-Type') && init?.body && typeof init.body === 'string') {
        headers.set('Content-Type', 'application/json');
      }
      return originalFetch.call(window, input, { ...init, headers });
    }
    return originalFetch.call(window, input, init);
  } as typeof window.fetch;
}
