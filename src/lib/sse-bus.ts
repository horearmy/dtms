// src/lib/sse-bus.ts
// In-process pub/sub for Server-Sent Events.
type Listener = (event: string, data: unknown) => void;

const channels = new Map<string, Set<Listener>>();

export function subscribe(channel: string, listener: Listener): () => void {
  if (!channels.has(channel)) channels.set(channel, new Set());
  channels.get(channel)!.add(listener);
  return () => {
    channels.get(channel)?.delete(listener);
    if (channels.get(channel)?.size === 0) channels.delete(channel);
  };
}

export function broadcast(channel: string, event: string, data: unknown) {
  const listeners = channels.get(channel);
  if (!listeners) return;
  for (const fn of listeners) {
    try {
      fn(event, data);
    } catch {
      // ignore
    }
  }
}
