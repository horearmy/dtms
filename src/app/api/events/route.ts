// src/app/api/events/route.ts
// Server-Sent Events endpoint for real-time dashboard updates.
import { subscribe } from '@/lib/sse-bus';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const tenantId = url.searchParams.get('tenantId') || 'global';
  const channel = tenantId === 'global' ? 'global' : `tenant:${tenantId}`;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      controller.enqueue(encoder.encode('event: connected\ndata: {}\n\n'));

      const unsubscribe = subscribe(channel, (event, data) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          // stream closed
        }
      });

      // Heartbeat every 30s
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          clearInterval(heartbeat);
        }
      }, 30000);

      // Cleanup on close
      req.signal.addEventListener('abort', () => {
        unsubscribe();
        clearInterval(heartbeat);
        try { controller.close(); } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
