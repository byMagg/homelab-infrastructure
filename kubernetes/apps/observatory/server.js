'use strict';

// Observatorio público del homelab. Sin dependencias: solo Node 22.
// Sirve /live (estático) y /live/api/status (JSON curado). Nunca expone
// Prometheus, la API de Kubernetes ni Alertmanager directamente.

const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');

const PORT = Number(process.env.PORT || 8080);
const PUBLIC_DIR = '/app';
const PREFIX = '/live';
const PROM = process.env.PROM_URL || 'http://prometheus.observability.svc.cluster.local:9090';
const ALERTMANAGER = process.env.ALERTMANAGER_URL || 'http://alertmanager.observability.svc.cluster.local:9093';
const PROBE_URL = process.env.PUBLIC_PROBE_URL || 'https://dbarroso.dev/live/healthz';
const BACKUP_SCHEDULE = process.env.BACKUP_SCHEDULE || '03:15';
const CACHE_MS = 15000;
const TOKEN_FILE = '/var/run/secrets/kubernetes.io/serviceaccount/token';
const CA_FILE = '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt';

const SHOWCASE = [
  ['portfolio', 'portfolio'],
  ['homepage', 'homepage'],
  ['adguard', 'adguard'],
  ['cloudflared', 'cloudflared'],
  ['grafana', 'observability'],
  ['prometheus', 'observability'],
  ['alertmanager', 'observability'],
  ['traefik', 'kube-system'],
  ['argocd-server', 'argocd'],
  ['sealed-secrets-controller', 'sealed-secrets'],
];

const STATIC = new Map();
for (const file of ['index.html', 'styles.css', 'app.js']) {
  try {
    STATIC.set(`/${file}`, fs.readFileSync(path.join(PUBLIC_DIR, file)));
  } catch (err) {
    console.error(`No se pudo leer ${file}: ${err.message}`);
  }
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
};

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function readToken() {
  try {
    return fs.readFileSync(TOKEN_FILE, 'utf8').trim();
  } catch {
    return '';
  }
}

function kubeGet(pathname, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    let ca;
    try {
      ca = fs.readFileSync(CA_FILE);
    } catch (err) {
      reject(err);
      return;
    }
    const req = https.request(
      {
        hostname: 'kubernetes.default.svc',
        port: 443,
        path: pathname,
        method: 'GET',
        ca,
        timeout: timeoutMs,
        headers: {
          Authorization: `Bearer ${readToken()}`,
          Accept: 'application/json',
        },
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`kube ${pathname} -> ${res.statusCode}`));
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (err) {
            reject(err);
          }
        });
      },
    );
    req.on('timeout', () => req.destroy(new Error(`kube timeout ${pathname}`)));
    req.on('error', reject);
    req.end();
  });
}

async function fetchJson(url, timeoutMs = 4000) {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

async function promQuery(query) {
  const data = await fetchJson(`${PROM}/api/v1/query?query=${encodeURIComponent(query)}`);
  return data.data.result || [];
}

async function promRange(query, seconds = 3600, step = 120) {
  const end = Math.floor(Date.now() / 1000);
  const start = end - seconds;
  const url = `${PROM}/api/v1/query_range?query=${encodeURIComponent(query)}&start=${start}&end=${end}&step=${step}`;
  const data = await fetchJson(url);
  return data.data.result || [];
}

function single(result) {
  if (!Array.isArray(result) || result.length === 0) return null;
  return num(result[0].value && result[0].value[1]);
}

function byNode(result) {
  const out = {};
  for (const sample of result) {
    const node = sample.metric && sample.metric.node;
    if (node) out[node] = num(sample.value && sample.value[1]);
  }
  return out;
}

function historyByNode(result) {
  const out = {};
  for (const sample of result) {
    const node = sample.metric && sample.metric.node;
    if (!node || !Array.isArray(sample.values)) continue;
    out[node] = sample.values.map((point) => num(point[1])).filter((v) => v !== null);
  }
  return out;
}

let probeCache = { at: 0, value: null };

async function publicProbe() {
  if (Date.now() - probeCache.at < 60000) return probeCache.value;
  try {
    const started = Date.now();
    const res = await fetch(PROBE_URL, {
      method: 'HEAD',
      redirect: 'manual',
      signal: AbortSignal.timeout(3000),
    });
    probeCache = {
      at: Date.now(),
      value: { status: res.status, ms: Date.now() - started, at: new Date().toISOString() },
    };
  } catch {
    probeCache = { at: Date.now(), value: null };
  }
  return probeCache.value;
}

function imageTag(image) {
  if (!image) return '';
  const clean = image.split('@')[0];
  const colon = clean.lastIndexOf(':');
  const slash = clean.lastIndexOf('/');
  return colon > slash ? clean.slice(colon + 1) : clean;
}

async function buildStatus() {
  const errors = new Set();
  const guard = async (label, fn, fallback, soft = false) => {
    try {
      return await fn();
    } catch (err) {
      if (!soft) errors.add(label);
      return fallback;
    }
  };

  const [
    nodesApi,
    podsApi,
    deploysApi,
    appsApi,
    alertsApi,
    cpuResult,
    memResult,
    tempResult,
    diskResult,
    uptimeResult,
    readyResult,
    targetsUpResult,
    targetsTotalResult,
    backupTsResult,
    backupSizeResult,
    probe,
  ] = await Promise.all([
    guard('kubernetes', () => kubeGet('/api/v1/nodes'), { items: [] }),
    guard('kubernetes', () => kubeGet('/api/v1/pods'), { items: [] }),
    guard('kubernetes', () => kubeGet('/apis/apps/v1/deployments'), { items: [] }),
    guard('kubernetes', () => kubeGet('/apis/argoproj.io/v1alpha1/applications'), { items: [] }),
    guard('alertmanager', () => fetchJson(`${ALERTMANAGER}/api/v2/alerts`), []),
    guard('prometheus', () => promQuery('100 - (avg by (node) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)'), []),
    guard('prometheus', () => promQuery('100 * (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes))'), []),
    guard('prometheus', () => promQuery('node_thermal_zone_temp{type="cpu-thermal"}'), []),
    guard('prometheus', () => promQuery('100 * (1 - (node_filesystem_avail_bytes{fstype!~"tmpfs|ramfs|overlay",mountpoint="/"} / node_filesystem_size_bytes{fstype!~"tmpfs|ramfs|overlay",mountpoint="/"}))'), []),
    guard('prometheus', () => promQuery('node_time_seconds - node_boot_time_seconds'), []),
    guard('prometheus', () => promQuery('kube_node_status_condition{condition="Ready",status="true"}'), []),
    guard('prometheus', () => promQuery('sum(up)'), []),
    guard('prometheus', () => promQuery('count(up)'), []),
    guard('prometheus', () => promQuery('k3s_backup_last_success_timestamp_seconds'), []),
    guard('prometheus', () => promQuery('k3s_backup_last_size_bytes'), []),
    publicProbe(),
  ]);

  // Las sparklines son cosméticas: si fallan, no marcan la página como degradada.
  const [cpuHistory, memHistory, tempHistory] = await Promise.all([
    guard('history', () => promRange('100 - (avg by (node) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)'), [], true),
    guard('history', () => promRange('100 * (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes))'), [], true),
    guard('history', () => promRange('node_thermal_zone_temp{type="cpu-thermal"}'), [], true),
  ]);

  const cpu = byNode(cpuResult);
  const mem = byNode(memResult);
  const temp = byNode(tempResult);
  const disk = byNode(diskResult);
  const uptime = byNode(uptimeResult);
  const cpuHist = historyByNode(cpuHistory);
  const memHist = historyByNode(memHistory);
  const tempHist = historyByNode(tempHistory);

  const ready = {};
  for (const sample of readyResult) {
    const node = sample.metric && sample.metric.node;
    if (node) ready[node] = num(sample.value && sample.value[1]) === 1;
  }

  const kubeNodes = nodesApi.items || [];
  const kubeNodeInfo = new Map();
  for (const node of kubeNodes) {
    const labels = node.metadata.labels || {};
    const conditions = node.status.conditions || [];
    kubeNodeInfo.set(node.metadata.name, {
      role: labels['node-role.kubernetes.io/control-plane'] !== undefined ? 'control-plane' : 'worker',
      ready: (conditions.find((c) => c.type === 'Ready') || {}).status === 'True',
    });
  }

  const nodeNames = new Set([...Object.keys(cpu), ...Object.keys(mem), ...Object.keys(temp), ...kubeNodeInfo.keys()]);
  const nodes = [...nodeNames].sort().map((name) => {
    const info = kubeNodeInfo.get(name) || {};
    return {
      name,
      role: info.role || 'worker',
      ready: info.ready !== undefined ? info.ready : ready[name] === true,
      cpu: cpu[name] ?? null,
      mem: mem[name] ?? null,
      temp: temp[name] ?? null,
      disk: disk[name] ?? null,
      uptimeSeconds: uptime[name] ?? null,
      history: {
        cpu: cpuHist[name] || [],
        mem: memHist[name] || [],
        temp: tempHist[name] || [],
      },
    };
  });

  const pods = podsApi.items || [];
  const runningPods = pods.filter((pod) => pod.status && pod.status.phase === 'Running');
  const tunnelPods = pods.filter((pod) => (pod.metadata.labels || {})['app.kubernetes.io/name'] === 'cloudflared');
  const tunnelReady = tunnelPods.filter((pod) => {
    const statuses = (pod.status && pod.status.containerStatuses) || [];
    return statuses.length > 0 && statuses.every((c) => c.ready);
  }).length;

  const apps = (appsApi.items || [])
    .map((app) => {
      const status = app.status || {};
      const sync = status.sync || {};
      const health = status.health || {};
      const op = status.operationState || {};
      return {
        name: app.metadata.name,
        namespace: (app.spec.destination || {}).namespace || '',
        sync: sync.status || 'Unknown',
        health: health.status || 'Unknown',
        revision: (sync.revision || '').slice(0, 7),
        lastSync: op.finishedAt || status.reconciledAt || null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const deployMap = new Map();
  for (const deploy of deploysApi.items || []) {
    deployMap.set(`${deploy.metadata.namespace}/${deploy.metadata.name}`, deploy);
  }
  const workloads = SHOWCASE.map(([name, namespace]) => {
    const deploy = deployMap.get(`${namespace}/${name}`);
    if (!deploy) return null;
    const container = ((deploy.spec.template || {}).spec || {}).containers || [{}];
    return {
      name,
      namespace,
      ready: (deploy.status && deploy.status.readyReplicas) || 0,
      desired: (deploy.spec && deploy.spec.replicas) || 0,
      image: container[0].image || '',
      tag: imageTag(container[0].image),
    };
  }).filter(Boolean);

  const alerts = (Array.isArray(alertsApi) ? alertsApi : [])
    .filter((alert) => alert.status && alert.status.state !== 'suppressed')
    .map((alert) => ({
      name: (alert.labels || {}).alertname || 'Alert',
      severity: (alert.labels || {}).severity || 'warning',
      summary: (alert.annotations || {}).summary || '',
      startsAt: alert.startsAt || null,
    }));

  const backupTs = single(backupTsResult);
  const backupSize = single(backupSizeResult);
  const now = Date.now();
  const backup = {
    lastSuccess: backupTs ? new Date(backupTs * 1000).toISOString() : null,
    ageSeconds: backupTs ? Math.max(0, Math.round(now / 1000 - backupTs)) : null,
    sizeBytes: backupSize,
    stale: backupTs ? now / 1000 - backupTs > 26 * 3600 : true,
    schedule: BACKUP_SCHEDULE,
    r2: Boolean(backupTs),
  };

  const targetsUp = single(targetsUpResult);
  const targetsTotal = single(targetsTotalResult);
  const appsHealthy = apps.filter((a) => a.health === 'Healthy').length;
  const appsSynced = apps.filter((a) => a.sync === 'Synced').length;

  const events = [];
  const lastApp = apps
    .filter((a) => a.lastSync)
    .sort((a, b) => new Date(b.lastSync) - new Date(a.lastSync))[0];
  if (lastApp) {
    events.push({ type: 'gitops', at: lastApp.lastSync, app: lastApp.name, revision: lastApp.revision });
  }
  if (backup.lastSuccess) {
    events.push({ type: 'backup', at: backup.lastSuccess, sizeBytes: backup.sizeBytes });
  }
  if (probe) {
    events.push({ type: 'probe', at: probe.at, ms: probe.ms, status: probe.status });
  }
  for (const alert of alerts.slice(0, 3)) {
    events.push({ type: 'alert', at: alert.startsAt, name: alert.name, severity: alert.severity });
  }
  events.sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));

  const uptimes = Object.values(uptime).filter((v) => v !== null);
  return {
    generatedAt: new Date().toISOString(),
    degraded: errors.size > 0,
    degradedLayers: [...errors],
    summary: {
      nodesReady: nodes.filter((n) => n.ready).length,
      nodesTotal: nodes.length,
      appsHealthy,
      appsSynced,
      appsTotal: apps.length,
      podsRunning: runningPods.length,
      podsTotal: pods.length,
      alerts: alerts.length,
      uptimeSeconds: uptimes.length ? Math.min(...uptimes) : null,
      revision: apps[0] ? apps[0].revision : '',
    },
    edge: {
      tunnelReady,
      tunnelTotal: tunnelPods.length,
      probe: probe || null,
      hostname: 'dbarroso.dev',
    },
    nodes,
    apps,
    workloads,
    backup,
    observability: {
      targetsUp,
      targetsTotal,
      alerts,
    },
    events: events.slice(0, 8),
  };
}

let cache = { at: 0, data: null, promise: null };

async function getStatus() {
  if (cache.data && Date.now() - cache.at < CACHE_MS) return cache.data;
  if (cache.promise) return cache.promise;
  cache.promise = buildStatus()
    .then((data) => {
      cache = { at: Date.now(), data, promise: null };
      return data;
    })
    .catch((err) => {
      cache.promise = null;
      throw err;
    });
  return cache.promise;
}

function securityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self'; frame-ancestors 'self'",
  );
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': status === 200 ? 'public, max-age=15, stale-while-revalidate=30' : 'no-store',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function serveStatic(req, res, pathname) {
  let rel = pathname;
  if (rel === PREFIX || rel === `${PREFIX}/`) rel = '/index.html';
  else if (rel.startsWith(`${PREFIX}/`)) rel = rel.slice(PREFIX.length);
  if (!rel.startsWith('/')) rel = `/${rel}`;
  if (rel === '/') rel = '/index.html';

  const body = STATIC.get(rel);
  if (!body) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('not found\n');
    return;
  }

  const ext = path.extname(rel);
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': 'no-cache',
    'Content-Length': body.length,
  });
  if (req.method === 'HEAD') res.end();
  else res.end(body);
}

const server = http.createServer(async (req, res) => {
  securityHeaders(res);
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    res.end('method not allowed\n');
    return;
  }

  if (pathname === '/healthz' || pathname === `${PREFIX}/healthz`) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : '{"status":"ok"}');
    return;
  }

  if (pathname === `${PREFIX}/api/status` || pathname === '/api/status') {
    try {
      const data = await getStatus();
      sendJson(res, 200, data);
    } catch (err) {
      console.error(`status: ${err.message}`);
      sendJson(res, 503, { error: 'status unavailable', generatedAt: new Date().toISOString() });
    }
    return;
  }

  if (pathname === PREFIX || pathname.startsWith(`${PREFIX}/`) || pathname === '/' || pathname === '/index.html') {
    serveStatic(req, res, pathname);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('not found\n');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`observatory listening on :${PORT}`);
});
