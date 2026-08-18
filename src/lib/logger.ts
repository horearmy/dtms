// src/lib/logger.ts
// Structured logging with context and levels.

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  requestId?: string;
  tenantId?: string;
  userId?: string;
  duration?: number;
  status?: number;
  error?: string;
  [key: string]: unknown;
}

const LOG_LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const MIN_LEVEL = LOG_LEVELS[(process.env.LOG_LEVEL as LogLevel) || 'info'];

function formatEntry(entry: LogEntry): string {
  if (process.env.NODE_ENV === 'production') {
    return JSON.stringify(entry);
  }
  const ctx = entry.context ? `[${entry.context}]` : '';
  const extra = Object.entries(entry)
    .filter(([k]) => !['timestamp', 'level', 'message', 'context'].includes(k))
    .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`)
    .join(' ');
  return `${entry.timestamp} ${entry.level.toUpperCase().padEnd(5)} ${ctx} ${entry.message} ${extra}`.trim();
}

function log(level: LogLevel, message: string, meta: Record<string, unknown> = {}) {
  if (LOG_LEVELS[level] < MIN_LEVEL) return;

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  };

  const formatted = formatEntry(entry);
  if (level === 'error') console.error(formatted);
  else if (level === 'warn') console.warn(formatted);
  else console.log(formatted);
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => log('debug', msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => log('info', msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => log('warn', msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => log('error', msg, meta),

  // Contextual logger
  child: (context: string) => ({
    debug: (msg: string, meta?: Record<string, unknown>) => log('debug', msg, { context, ...meta }),
    info: (msg: string, meta?: Record<string, unknown>) => log('info', msg, { context, ...meta }),
    warn: (msg: string, meta?: Record<string, unknown>) => log('warn', msg, { context, ...meta }),
    error: (msg: string, meta?: Record<string, unknown>) => log('error', msg, { context, ...meta }),
  }),

  // Request logger
  request: (req: { method: string; url: string; headers?: Record<string, string> }, meta?: Record<string, unknown>) => {
    const requestId = req.headers?.['x-request-id'] || `req_${Date.now().toString(36)}`;
    log('info', `${req.method} ${req.url}`, { requestId, ...meta });
    return requestId;
  },

  // Performance timer
  timer: (label: string) => {
    const start = performance.now();
    return {
      end: (meta?: Record<string, unknown>) => {
        const duration = Math.round(performance.now() - start);
        log(duration > 1000 ? 'warn' : 'info', `${label} completed`, { duration, ...meta });
      },
    };
  },
};
