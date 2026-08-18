// src/lib/request-logger.ts
// Request logging middleware for API routes.
import { NextRequest, NextResponse } from 'next/server';
import { logger } from './logger';
import { incrementCounter, observeHistogram } from './metrics';

export function withRequestLogging(handler: (req: NextRequest) => Promise<NextResponse>) {
  return async (req: NextRequest) => {
    const start = performance.now();
    const requestId = logger.request({ method: req.method, url: req.url });

    incrementCounter('dtms_http_requests_total', { method: req.method, path: req.nextUrl.pathname });

    try {
      const response = await handler(req);
      const duration = performance.now() - start;

      observeHistogram('dtms_http_duration_ms', duration, {
        method: req.method,
        path: req.nextUrl.pathname,
        status: String(response.status),
      });

      logger.info('Request completed', {
        requestId,
        method: req.method,
        url: req.url,
        status: response.status,
        duration: Math.round(duration),
      });

      response.headers.set('X-Request-Id', requestId);
      return response;
    } catch (err) {
      const duration = performance.now() - start;
      incrementCounter('dtms_http_errors_total', { method: req.method, path: req.nextUrl.pathname });

      logger.error('Request failed', {
        requestId,
        method: req.method,
        url: req.url,
        duration: Math.round(duration),
        error: err instanceof Error ? err.message : String(err),
      });

      throw err;
    }
  };
}
