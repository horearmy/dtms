// src/lib/metrics.ts
// Prometheus-compatible metrics collector (in-memory, no external deps).

interface Metric {
  name: string;
  help: string;
  type: 'counter' | 'gauge' | 'histogram';
  values: Map<string, number>;
}

const metrics = new Map<string, Metric>();

// ─── API ─────────────────────────────────────────────────
export function counter(name: string, help: string, labels: Record<string, string> = {}, value = 1) {
  const m = getOrCreate(name, help, 'counter');
  const key = labelKey(labels);
  m.values.set(key, (m.values.get(key) || 0) + value);
}

export function gauge(name: string, help: string, labels: Record<string, string> = {}, value: number) {
  const m = getOrCreate(name, help, 'gauge');
  m.values.set(labelKey(labels), value);
}

export function histogram(name: string, help: string, labels: Record<string, string> = {}, value: number) {
  const m = getOrCreate(name, help, 'histogram');
  const key = labelKey(labels);
  m.values.set(key, (m.values.get(key) || 0) + value);
}

export function incrementCounter(name: string, labels: Record<string, string> = {}) {
  counter(name, '', labels, 1);
}

export function setGauge(name: string, value: number, labels: Record<string, string> = {}) {
  gauge(name, '', labels, value);
}

export function observeHistogram(name: string, value: number, labels: Record<string, string> = {}) {
  histogram(name, '', labels, value);
}

// ─── Export Prometheus format ─────────────────────────────
export function collectMetrics(): string {
  const lines: string[] = [];

  for (const [, m] of metrics) {
    lines.push(`# HELP ${m.name} ${m.help}`);
    lines.push(`# TYPE ${m.name} ${m.type}`);

    for (const [key, value] of m.values) {
      const labels = key ? `{${key}}` : '';
      lines.push(`${m.name}${labels} ${value}`);
    }
  }

  return lines.join('\n') + '\n';
}

// ─── System metrics (auto-collected) ─────────────────────
export function collectSystemMetrics() {
  const mem = process.memoryUsage();
  gauge('dtms_memory_heap_used_bytes', 'Heap memory used', {}, mem.heapUsed);
  gauge('dtms_memory_heap_total_bytes', 'Heap memory total', {}, mem.heapTotal);
  gauge('dtms_memory_rss_bytes', 'RSS memory', {}, mem.rss);
  gauge('dtms_uptime_seconds', 'Process uptime', {}, Math.round(process.uptime()));
}

// Auto-collect system metrics every 30s
let systemInterval: ReturnType<typeof setInterval> | null = null;
export function startMetricsCollector() {
  if (systemInterval) return;
  collectSystemMetrics();
  systemInterval = setInterval(collectSystemMetrics, 30000);
}

// ─── Helpers ─────────────────────────────────────────────
function getOrCreate(name: string, help: string, type: Metric['type']): Metric {
  if (!metrics.has(name)) {
    metrics.set(name, { name, help, type, values: new Map() });
  }
  return metrics.get(name)!;
}

function labelKey(labels: Record<string, string>): string {
  return Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}="${v}"`)
    .join(',');
}
