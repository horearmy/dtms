// src/app/api/events/route.ts
// Server-Sent Events endpoint for real-time dashboard updates.
import { subscribe } from '@/lib/sse-bus';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  let channel = url.searchParams.get('tenantId') || 'global';

  // Try to authenticate via cookie/token for tenant scoping
  const cookieHeader = req.headers.get('cookie') || '';
  const tokenMatch = cookieHeader.match(/session_token=([^;]+)/);
  if (tokenMatch) {
    try {
      const session = await verifyToken(tokenMatch[1]);
      if (session?.tenantId) {
        channel = `tenant:${session.tenantId}`;
      }
    } catch {
      // unauthenticated — use provided tenantId or global
    }
  } else if (channel !== 'global') {
    channel = `tenant:${channel}`;
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

      // Also subscribe to global channel for cross-tenant events
      const unsubGlobal = channel !== 'global' ? subscribe('global', (event, data) => {
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
