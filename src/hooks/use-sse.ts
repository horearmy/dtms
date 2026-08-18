'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

type SSEEvent = { event: string; data: unknown };

export function useSSE(channel?: string) {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<SSEEvent | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const listenersRef = useRef<Map<string, Set<(data: unknown) => void>>>(new Map());

  const subscribe = useCallback((eventName: string, handler: (data: unknown) => void) => {
    if (!listenersRef.current.has(eventName)) {
      listenersRef.current.set(eventName, new Set());
    }
    listenersRef.current.get(eventName)!.add(handler);
    return () => {
      listenersRef.current.get(eventName)?.delete(handler);
    };
  }, []);

  useEffect(() => {
    const tenantParam = channel || 'global';
    const url = `/api/events?tenantId=${tenantParam}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    es.addEventListener('connected', () => setConnected(true));

    const rawHandler = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        const eventObj = { event: e.type, data };
        setLastEvent(eventObj);

        const handlers = listenersRef.current.get(e.type);
        if (handlers) {
          for (const fn of handlers) fn(data);
        }

        const allHandlers = listenersRef.current.get('*');
        if (allHandlers) {
          for (const fn of allHandlers) fn(eventObj);
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onmessage = rawHandler;

    return () => {
      es.close();
      eventSourceRef.current = null;
      setConnected(false);
    };
  }, [channel]);

  return { connected, lastEvent, subscribe };
}
