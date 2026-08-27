// src/app/api/events/route.ts
// Server-Sent Events endpoint for real-time dashboard updates.
import { subscribe } from '@/lib/sse-bus';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const session = await getSession();

  let channel: string;
  if (session?.tenantId) {
    channel = `tenant:${session.tenantId}`;
  } else if (session?.role === 'SUPER_ADMIN') {
    const url = new URL(req.url);
    const requestedTenant = url.searchParams.get('tenantId');
    channel = requestedTenant ? `tenant:${requestedTenant}` : 'global';
  } else {
    return new Response(JSON.stringify({ error: 'Tidak terautentikasi' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('event: connected\ndata: {}\n\n'));

      const unsubscribe = subscribe(channel, (event, data) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          // stream closed
        }
      });

      // Also subscribe to global channel for cross-tenant events (SUPER_ADMIN only)
      const unsubGlobal = (session?.role === 'SUPER_ADMIN' && channel === 'global') ? subscribe('global', (event, data) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          // stream closed
        }
      }) : () => {};

      // Heartbeat every 25s
      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          clearInterval(heartbeat);
        }
      }, 25000);

      req.signal.addEventListener('abort', () => {
        closed = true;
        unsubscribe();
        unsubGlobal();
        clearInterval(heartbeat);
        try { controller.close(); } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
