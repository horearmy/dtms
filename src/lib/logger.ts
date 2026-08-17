type Level = 'info' | 'warn' | 'error' | 'debug';

function log(level: Level, tag: string, msg: string, data?: Record<string, unknown>) {
  const entry = { ts: new Date().toISOString(), level, tag, msg, ...data };
  if (level === 'error') console.error(JSON.stringify(entry));
  else if (level === 'warn') console.warn(JSON.stringify(entry));
  else console.log(JSON.stringify(entry));
}

export const logger = {
  info: (tag: string, msg: string, data?: Record<string, unknown>) => log('info', tag, msg, data),
  warn: (tag: string, msg: string, data?: Record<string, unknown>) => log('warn', tag, msg, data),
  error: (tag: string, msg: string, data?: Record<string, unknown>) => log('error', tag, msg, data),
  debug: (tag: string, msg: string, data?: Record<string, unknown>) => log('debug', tag, msg, data),
};
