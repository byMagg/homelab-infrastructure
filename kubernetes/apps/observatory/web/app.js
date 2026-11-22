'use strict';

const I18N = {
  es: {
    'hero.eyebrow': 'cat /proc/homelab',
    'hero.title1': 'Todo el stack,',
    'hero.title2': 'en vivo.',
    'hero.lede': 'Tres Raspberry Pi, Kubernetes, GitOps, backups y observabilidad. Esto no es una captura: es el estado real del homelab mientras lo miras.',
    'hero.journey': 'simular petición',
    'hero.layers': 'explorar capas ↓',
    'stat.nodes': 'nodos',
    'stat.nodesSub': 'Ready',
    'stat.apps': 'apps',
    'stat.appsSub': 'Healthy',
    'stat.pods': 'pods',
    'stat.podsSub': 'Running',
    'stat.backup': 'backup',
    'stat.backupSub': 'antigüedad',
    'stat.alerts': 'alertas',
    'stat.alertsSub': 'activas',
    'topo.note': 'datos en vivo · se actualiza cada 15 s',
    'layer.edge.title': 'Edge',
    'layer.edge.tunnel': 'túnel',
    'layer.edge.probe': 'probe',
    'layer.edge.tls': 'TLS',
    'layer.edge.host': 'host',
    'explain.edge': 'Cloudflare termina el TLS y filtra el tráfico. El cluster no abre puertos: un túnel saliente publica los servicios.',
    'layer.data.title': 'Datos',
    'layer.data.last': 'desde el último backup',
    'layer.data.size': 'tamaño',
    'layer.data.schedule': 'horario',
    'layer.data.r2': 'R2',
    'layer.data.retention': 'retención',
    'explain.data': 'Copia consistente del datastore SQLite de k3s, el token y las CA. Se guarda en local y se replica a Cloudflare R2 cada día.',
    'layer.cluster.title': 'Cluster',
    'explain.cluster': 'Tres Raspberry Pi 4 con k3s: un control-plane y dos workers. cluster2 es el nodo ligero de 2 GB y solo recibe cargas pequeñas.',
    'layer.gitops.title': 'GitOps',
    'explain.gitops': 'Argo CD compara Git con el cluster y corrige cualquier deriva automáticamente. Si el estado no coincide con el repo, vuelve a él sin intervención.',
    'layer.workloads.title': 'Workloads',
    'explain.workloads': 'Aplicaciones reales sirviendo tráfico: portfolio, AdGuard, Homepage, Grafana, Prometheus y el propio observatorio.',
    'layer.obs.title': 'Observabilidad',
    'layer.obs.targets': 'targets',
    'layer.obs.alerts': 'alertas',
    'layer.obs.rules': 'reglas',
    'layer.obs.notify': 'notificaciones',
    'layer.obs.pending': 'pendientes',
    'explain.obs': 'Prometheus mide cada 30 segundos; Alertmanager agrupa las alertas y las deja listas para conectar a email o mensajería.',
    'timeline.note': 'últimos eventos del sistema',
    'footer.built': 'construido con k3s · Argo CD · Prometheus · Cloudflare',
    'degraded.text': 'Algunas capas no responden; se muestra la última lectura conocida.',
    'degraded.offline': 'Sin conexión con el observatorio; se muestra la última lectura conocida.',
    'status.ok': 'ok',
    'status.warn': 'aviso',
    'status.err': 'error',
    'status.off': 'off',
    'status.check': 'revisar',
    'status.stale': 'obsoleto',
    'status.synced': 'Synced',
    'status.healthy': 'Healthy',
    'status.progressing': 'Progressing',
    'status.outofsync': 'OutOfSync',
    'status.degraded': 'Degraded',
    'status.missing': 'Missing',
    'status.unknown': 'Unknown',
    'backup.off': 'sin R2',
    'alerts.none': 'sin alertas activas',
    'alerts.activeCount': '{n} activas',
    'workloads.count': '{n} apps',
    'timeline.empty': 'sin eventos recientes',
    'unit.daily': 'diario',
    'event.gitops': 'Argo CD sincronizó {app} en {rev}',
    'event.backup': 'Backup completado ({size})',
    'event.probe': 'Petición pública OK ({ms} ms)',
    'event.alert': 'Alerta {name} ({severity})',
    'journey.ok': 'Cloudflare → tunnel → Traefik → pod · {status} · {ms} ms',
    'journey.nodata': 'Ruta simulada: sin datos del probe público.',
  },
  en: {
    'hero.eyebrow': 'cat /proc/homelab',
    'hero.title1': 'The whole stack,',
    'hero.title2': 'live.',
    'hero.lede': 'Three Raspberry Pis, Kubernetes, GitOps, backups and observability. This is not a screenshot: it is the real state of the homelab while you watch it.',
    'hero.journey': 'simulate request',
    'hero.layers': 'explore layers ↓',
    'stat.nodes': 'nodes',
    'stat.nodesSub': 'Ready',
    'stat.apps': 'apps',
    'stat.appsSub': 'Healthy',
    'stat.pods': 'pods',
    'stat.podsSub': 'Running',
    'stat.backup': 'backup',
    'stat.backupSub': 'age',
    'stat.alerts': 'alerts',
    'stat.alertsSub': 'active',
    'topo.note': 'live data · refreshed every 15 s',
    'layer.edge.title': 'Edge',
    'layer.edge.tunnel': 'tunnel',
    'layer.edge.probe': 'latency',
    'layer.edge.tls': 'TLS',
    'layer.edge.host': 'host',
    'explain.edge': 'Cloudflare terminates TLS and filters traffic. The cluster opens no ports: an outbound tunnel publishes the services.',
    'layer.data.title': 'Data',
    'layer.data.last': 'since the last backup',
    'layer.data.size': 'size',
    'layer.data.schedule': 'schedule',
    'layer.data.r2': 'R2',
    'layer.data.retention': 'retention',
    'explain.data': 'Consistent copy of the k3s SQLite datastore, the token and the CAs. Kept locally and replicated to Cloudflare R2 every day.',
    'layer.cluster.title': 'Cluster',
    'explain.cluster': 'Three Raspberry Pi 4 running k3s: one control-plane and two workers. cluster2 is the 2 GB light node and only gets small workloads.',
    'layer.gitops.title': 'GitOps',
    'explain.gitops': 'Argo CD compares Git with the cluster and corrects any drift automatically. If state does not match the repo, it goes back to it without intervention.',
    'layer.workloads.title': 'Workloads',
    'explain.workloads': 'Real applications serving traffic: portfolio, AdGuard, Homepage, Grafana, Prometheus and this observatory itself.',
    'layer.obs.title': 'Observability',
    'layer.obs.targets': 'targets',
    'layer.obs.alerts': 'alerts',
    'layer.obs.rules': 'rules',
    'layer.obs.notify': 'notifications',
    'layer.obs.pending': 'pending',
    'explain.obs': 'Prometheus measures every 30 seconds; Alertmanager groups alerts and leaves them ready to connect to email or messaging.',
    'timeline.note': 'latest system events',
    'footer.built': 'built with k3s · Argo CD · Prometheus · Cloudflare',
    'degraded.text': 'Some layers are not responding; showing the last known reading.',
    'degraded.offline': 'No connection to the observatory; showing the last known reading.',
    'status.ok': 'ok',
    'status.warn': 'warn',
    'status.err': 'error',
    'status.off': 'off',
    'status.check': 'check',
    'status.stale': 'stale',
    'status.synced': 'Synced',
    'status.healthy': 'Healthy',
    'status.progressing': 'Progressing',
    'status.outofsync': 'OutOfSync',
    'status.degraded': 'Degraded',
    'status.missing': 'Missing',
    'status.unknown': 'Unknown',
    'backup.off': 'no R2',
    'alerts.none': 'no active alerts',
    'alerts.activeCount': '{n} active',
    'workloads.count': '{n} apps',
    'timeline.empty': 'no recent events',
    'unit.daily': 'daily',
    'event.gitops': 'Argo CD synced {app} at {rev}',
    'event.backup': 'Backup completed ({size})',
    'event.probe': 'Public request OK ({ms} ms)',
    'event.alert': 'Alert {name} ({severity})',
    'journey.ok': 'Cloudflare → tunnel → Traefik → pod · {status} · {ms} ms',
    'journey.nodata': 'Simulated path: no public probe data.',
  },
};

const state = {
  lang: localStorage.getItem('obs.lang') || (navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en'),
  recruiter: localStorage.getItem('obs.recruiter') === '1',
  data: null,
  lastGood: 0,
  offline: false,
};

const params = new URLSearchParams(location.search);
if (['es', 'en'].includes(params.get('lang'))) state.lang = params.get('lang');
if (params.has('recruiter')) state.recruiter = true;

const $ = (id) => document.getElementById(id);

function t(key, vars = {}) {
  let text = (I18N[state.lang] && I18N[state.lang][key]) || I18N.es[key] || key;
  for (const [k, v] of Object.entries(vars)) text = text.replaceAll(`{${k}}`, String(v));
  return text;
}

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function setText(id, value) {
  const node = $(id);
  if (node) node.textContent = value;
}

function fmtPct(value) {
  return value == null ? '--' : `${Number(value).toFixed(1)}%`;
}

function fmtBytes(value) {
  if (value == null) return '--';
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = Number(value);
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function fmtDuration(seconds) {
  if (seconds == null) return '--';
  const sec = Math.max(0, Math.round(Number(seconds)));
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function fmtRelative(iso) {
  if (!iso) return '--';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '--';
  let diff = Math.round((then - Date.now()) / 1000);
  if (diff > 0) diff = 0;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(state.lang, { numeric: 'auto' });
  if (abs < 60) return rtf.format(diff, 'second');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  return rtf.format(Math.round(diff / 86400), 'day');
}

function tone(value) {
  const v = String(value || '').toLowerCase();
  if (['synced', 'healthy', 'ok', 'true'].includes(v)) return 'ok';
  if (['progressing', 'pending', 'unknown'].includes(v)) return 'warn';
  if (!v) return 'idle';
  return 'err';
}

function localizeStatus(value) {
  const map = {
    Synced: 'status.synced',
    Healthy: 'status.healthy',
    Progressing: 'status.progressing',
    OutOfSync: 'status.outofsync',
    Degraded: 'status.degraded',
    Missing: 'status.missing',
    Unknown: 'status.unknown',
  };
  return map[value] ? t(map[value]) : value || '--';
}

function applyLang() {
  document.documentElement.lang = state.lang;
  document.querySelectorAll('[data-i18n]').forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  document.querySelectorAll('.lang-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.lang === state.lang);
    btn.setAttribute('aria-pressed', btn.dataset.lang === state.lang ? 'true' : 'false');
  });
  if (state.data) render(state.data);
  updateLiveState();
}

function setChip(id, text, status) {
  const node = $(id);
  if (!node) return;
  node.textContent = text;
  node.classList.remove('ok', 'warn', 'err');
  if (status) node.classList.add(status);
}

function bar(label, value) {
  const v = value == null ? null : Math.max(0, Math.min(100, Number(value)));
  const cls = v == null ? '' : v > 90 ? 'err' : v > 75 ? 'warn' : '';
  return `<div class="bar-row"><span class="k">${esc(label)}</span><span class="bar"><i class="${cls}" style="width:${v == null ? 0 : v}%"></i></span><strong>${fmtPct(v)}</strong></div>`;
}

function tempBar(value) {
  const temp = value == null ? null : Number(value);
  const width = temp == null ? 0 : Math.max(0, Math.min(100, (temp / 90) * 100));
  const cls = temp == null ? '' : temp > 75 ? 'err' : temp > 65 ? 'warn' : '';
  return `<div class="bar-row"><span class="k">TEMP</span><span class="bar"><i class="${cls}" style="width:${width}%"></i></span><strong>${temp == null ? '--' : `${temp.toFixed(1)}°C`}</strong></div>`;
}

function sparkline(values) {
  if (!Array.isArray(values) || values.length < 2) return '';
  const w = 120;
  const h = 30;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * w;
      const y = h - ((value - min) / span) * (h - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${points}"/></svg>`;
}

function renderNodes(nodes) {
  const grid = $('node-grid');
  if (!grid) return;
  if (!nodes || nodes.length === 0) {
    grid.innerHTML = '<p class="alert-ok">--</p>';
    return;
  }
  grid.innerHTML = nodes
    .map((node) => {
      const readyClass = node.ready ? '' : 'err';
      return `<div class="node-card">
        <div class="node-head">
          <span class="status-dot ${readyClass}"></span>
          <span class="node-name">${esc(node.name)}</span>
          <span class="node-role">${esc(node.role)}</span>
        </div>
        ${bar('CPU', node.cpu)}
        ${bar('MEM', node.mem)}
        ${tempBar(node.temp)}
        ${bar('DISK', node.disk)}
        ${sparkline((node.history && node.history.cpu) || [])}
        <div class="node-foot"><span class="k">uptime</span><strong>${fmtDuration(node.uptimeSeconds)}</strong></div>
      </div>`;
    })
    .join('');
}

function renderApps(apps) {
  const grid = $('app-grid');
  if (!grid) return;
  if (!apps || apps.length === 0) {
    grid.innerHTML = '<p class="alert-ok">--</p>';
    return;
  }
  grid.innerHTML = apps
    .map((app) => {
      const syncTone = tone(app.sync);
      const healthTone = tone(app.health);
      return `<div class="app-card">
        <span class="app-sync ${syncTone}"></span>
        <span class="app-main">
          <span class="app-name">${esc(app.name)}</span>
          <span class="app-meta">${esc(app.revision || '--')} · ${esc(fmtRelative(app.lastSync))}</span>
        </span>
        <span class="app-health ${healthTone}">${esc(localizeStatus(app.health))}</span>
      </div>`;
    })
    .join('');
}

function renderWorkloads(workloads) {
  const list = $('workload-list');
  if (!list) return;
  if (!workloads || workloads.length === 0) {
    list.innerHTML = '<li class="alert-ok">--</li>';
    return;
  }
  list.innerHTML = workloads
    .map((w) => {
      const readyTone = w.desired > 0 && w.ready >= w.desired ? 'ok' : w.ready > 0 ? 'warn' : 'err';
      return `<li class="workload">
        <span class="workload-name">${esc(w.name)}</span>
        <span class="workload-ready ${readyTone}">${w.ready}/${w.desired}</span>
        <span class="workload-ns">${esc(w.namespace)}</span>
        <span class="workload-tag">${esc(w.tag || w.image || '')}</span>
      </li>`;
    })
    .join('');
}

function renderTimeline(events) {
  const list = $('timeline');
  if (!list) return;
  if (!events || events.length === 0) {
    list.innerHTML = `<li><span class="ev">${esc(t('timeline.empty'))}</span></li>`;
    return;
  }
  list.innerHTML = events
    .map((event) => {
      let text = '';
      if (event.type === 'gitops') {
        text = t('event.gitops', { app: event.app, rev: event.revision || '--' });
      } else if (event.type === 'backup') {
        text = t('event.backup', { size: fmtBytes(event.sizeBytes) });
      } else if (event.type === 'probe') {
        text = t('event.probe', { ms: event.ms });
      } else if (event.type === 'alert') {
        text = t('event.alert', { name: event.name, severity: event.severity });
      }
      return `<li class="${event.type === 'alert' ? 'alert' : ''}"><span class="t">${esc(fmtRelative(event.at))}</span><span class="ev">${esc(text)}</span></li>`;
    })
    .join('');
}

function setTone(id, value) {
  const node = $(id);
  if (!node) return;
  node.classList.remove('tone-ok', 'tone-warn', 'tone-err', 'tone-idle');
  node.classList.add(`tone-${value}`);
}

function shortName(name, max = 9) {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

function renderTopology(data) {
  const nodes = data.nodes || [];
  const apps = data.apps || [];
  const summary = data.summary || {};
  const edge = data.edge || {};
  const backup = data.backup || {};
  const obs = data.observability || {};

  const nodeIds = ['topo-node0', 'topo-node1', 'topo-node2'];
  const nameIds = ['topo-node0-name', 'topo-node1-name', 'topo-node2-name'];
  for (let i = 0; i < 3; i += 1) {
    const node = nodes[i];
    setText(nameIds[i], node ? node.name : `node${i}`);
    setTone(nodeIds[i], node ? (node.ready ? 'ok' : 'err') : 'idle');
  }

  setTone('topo-browser', data.degraded ? 'warn' : 'ok');
  setTone('topo-edge', edge.tunnelReady > 0 ? (edge.probe && edge.probe.status === 200 ? 'ok' : 'warn') : 'err');
  setTone('topo-traefik', summary.nodesReady > 0 ? 'ok' : 'err');
  setTone('topo-cluster', summary.nodesReady === summary.nodesTotal && summary.nodesTotal > 0 ? 'ok' : summary.nodesReady > 0 ? 'warn' : 'err');
  setTone('topo-r2', backup.lastSuccess && !backup.stale ? 'ok' : backup.lastSuccess ? 'warn' : 'err');
  setTone('topo-obs', obs.targetsUp == null ? 'warn' : obs.targetsUp === obs.targetsTotal && summary.alerts === 0 ? 'ok' : 'warn');

  setText('topo-edge-sub', `tunnel ${edge.tunnelReady || 0}/${edge.tunnelTotal || 0}`);
  setText('topo-cluster-sub', `${summary.nodesReady || 0}/${summary.nodesTotal || 0} ready`);
  setText('topo-pods-sub', `${summary.podsRunning ?? '--'}/${summary.podsTotal ?? '--'} pods`);
  setText('topo-workloads-sub', `${(data.workloads || []).length} apps`);
  setText('topo-r2-sub', backup.lastSuccess ? `backup ${fmtDuration(backup.ageSeconds)}` : 'backup off');
  setText('topo-obs-sub', `Alertmanager · targets ${obs.targetsUp ?? '--'}/${obs.targetsTotal ?? '--'}`);

  const appsGroup = $('topo-apps');
  if (appsGroup) {
    const picks = ['portfolio', 'homepage', 'adguard', 'cloudflared', 'observability', 'sealed-secrets']
      .map((name) => apps.find((a) => a.name === name))
      .filter(Boolean)
      .slice(0, 6);
    appsGroup.innerHTML = picks
      .map((app, index) => {
        const x = 660 + index * 63;
        return `<g class="app-chip" transform="translate(${x},214)">
          <rect width="58" height="20" rx="4"/>
          <text x="29" y="13" text-anchor="middle">${esc(shortName(app.name, 8))}</text>
        </g>`;
      })
      .join('');
  }
}

function updateLiveState() {
  const box = $('live-state');
  if (!box) return;
  box.classList.toggle('offline', state.offline);
  setText('live-label', state.offline ? 'OFFLINE' : 'LIVE');
  const age = state.lastGood ? Math.round((Date.now() - state.lastGood) / 1000) : null;
  setText('last-update', age == null ? '--' : fmtDuration(age));
}

function showDegraded(show, mode = 'partial') {
  const node = $('degraded');
  if (!node) return;
  node.hidden = !show;
  if (show) {
    const text = mode === 'offline' ? t('degraded.offline') : t('degraded.text');
    node.innerHTML = `<span class="warn-dot"></span><span>${esc(text)}</span>`;
  }
}

function render(data) {
  state.data = data;
  const summary = data.summary || {};
  const edge = data.edge || {};
  const backup = data.backup || {};
  const obs = data.observability || {};

  setText('stat-nodes', `${summary.nodesReady ?? '--'}/${summary.nodesTotal ?? '--'}`);
  setText('stat-apps', `${summary.appsHealthy ?? '--'}/${summary.appsTotal ?? '--'}`);
  setText('stat-pods', summary.podsRunning ?? '--');
  setText('stat-backup', backup.ageSeconds == null ? '--' : fmtDuration(backup.ageSeconds));
  setText('stat-alerts', summary.alerts ?? '--');
  setText('footer-rev', `rev ${summary.revision || '--'}`);

  const tunnelOk = edge.tunnelTotal > 0 && edge.tunnelReady === edge.tunnelTotal;
  const probeOk = edge.probe && edge.probe.status === 200;
  setText('edge-tunnel', `${edge.tunnelReady || 0}/${edge.tunnelTotal || 0}`);
  setText('edge-probe', edge.probe ? `${edge.probe.ms} ms · ${edge.probe.status}` : '--');
  setChip('edge-chip', tunnelOk && probeOk ? t('status.ok') : t('status.check'), tunnelOk ? (probeOk ? 'ok' : 'warn') : 'err');

  setText('backup-age', backup.ageSeconds == null ? '--' : fmtDuration(backup.ageSeconds));
  setText('backup-size', fmtBytes(backup.sizeBytes));
  setText('backup-schedule', `${backup.schedule || '--'} · ${t('unit.daily')}`);
  setText('backup-r2', backup.r2 ? t('status.ok') : t('backup.off'));
  setChip('data-chip', backup.stale ? t('status.stale') : t('status.ok'), backup.stale ? 'warn' : 'ok');

  const allNodesReady = summary.nodesTotal > 0 && summary.nodesReady === summary.nodesTotal;
  setText('cluster-note', `${summary.nodesReady ?? '--'}/${summary.nodesTotal ?? '--'} ready`);
  setText('gitops-note', `${summary.appsSynced ?? '--'}/${summary.appsTotal ?? '--'} synced`);
  setChip('workloads-chip', t('workloads.count', { n: (data.workloads || []).length }), 'ok');

  setText('obs-targets', `${obs.targetsUp ?? '--'}/${obs.targetsTotal ?? '--'}`);
  setText('obs-alerts', summary.alerts ?? '--');
  setChip('obs-chip', summary.alerts ? t('alerts.activeCount', { n: summary.alerts }) : t('status.ok'), summary.alerts ? 'warn' : 'ok');

  renderNodes(data.nodes || []);
  renderApps(data.apps || []);
  renderWorkloads(data.workloads || []);
  renderTimeline(data.events || []);
  renderTopology(data);

  const alertList = $('alert-list');
  if (alertList) {
    if (!obs.alerts || obs.alerts.length === 0) {
      alertList.innerHTML = `<li class="alert-ok">● ${esc(t('alerts.none'))}</li>`;
    } else {
      alertList.innerHTML = obs.alerts
        .map(
          (alert) => `<li class="alert-item ${alert.severity === 'critical' ? 'critical' : ''}">
            <span class="alert-sev">${esc(alert.severity)}</span>
            <span class="alert-summary">${esc(alert.summary || alert.name)}</span>
          </li>`,
        )
        .join('');
    }
  }

  if (data.degraded) showDegraded(true, 'partial');
  else if (!state.offline) showDegraded(false);
  updateLiveState();
}

let toastTimer = null;

function showToast(text, detail = '') {
  const node = $('toast');
  if (!node) return;
  node.innerHTML = `<div class="toast-k">${esc(text)}</div>${detail ? `<div>${esc(detail)}</div>` : ''}`;
  node.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('show'), 5200);
}

function runJourney() {
  const data = state.data;
  const probe = data && data.edge && data.edge.probe;
  const packet = $('packet');
  const path = $('journey-path');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!packet || !path || reduced) {
    if (probe) showToast(t('journey.ok', { status: probe.status, ms: probe.ms }));
    else showToast(t('journey.nodata'));
    return;
  }
  const length = path.getTotalLength();
  const start = performance.now();
  const duration = 1500;
  packet.classList.add('show');
  document.body.classList.add('journey-active');
  const frame = (now) => {
    const progress = Math.min(1, (now - start) / duration);
    const point = path.getPointAtLength(length * progress);
    packet.setAttribute('cx', String(point.x));
    packet.setAttribute('cy', String(point.y));
    if (progress < 1) {
      requestAnimationFrame(frame);
    } else {
      packet.classList.remove('show');
      document.body.classList.remove('journey-active');
      if (probe) showToast(t('journey.ok', { status: probe.status, ms: probe.ms }));
      else showToast(t('journey.nodata'));
    }
  };
  requestAnimationFrame(frame);
}

async function refresh() {
  try {
    const res = await fetch('/live/api/status', { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    state.offline = false;
    state.lastGood = Date.now();
    render(data);
  } catch {
    state.offline = true;
    showDegraded(true, 'offline');
    updateLiveState();
  }
}

function init() {
  document.body.classList.toggle('recruiter', state.recruiter);
  const recruiterBtn = $('recruiter-btn');
  if (recruiterBtn) {
    recruiterBtn.setAttribute('aria-pressed', state.recruiter ? 'true' : 'false');
    recruiterBtn.textContent = state.recruiter
      ? state.lang === 'es' ? 'modo reclutador: on' : 'recruiter mode: on'
      : state.lang === 'es' ? 'modo reclutador' : 'recruiter mode';
    recruiterBtn.addEventListener('click', () => {
      state.recruiter = !state.recruiter;
      localStorage.setItem('obs.recruiter', state.recruiter ? '1' : '0');
      document.body.classList.toggle('recruiter', state.recruiter);
      recruiterBtn.setAttribute('aria-pressed', state.recruiter ? 'true' : 'false');
      recruiterBtn.textContent = state.recruiter
        ? state.lang === 'es' ? 'modo reclutador: on' : 'recruiter mode: on'
        : state.lang === 'es' ? 'modo reclutador' : 'recruiter mode';
    });
  }

  document.querySelectorAll('.lang-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.lang = btn.dataset.lang;
      localStorage.setItem('obs.lang', state.lang);
      applyLang();
      if (recruiterBtn) {
        recruiterBtn.textContent = state.recruiter
          ? state.lang === 'es' ? 'modo reclutador: on' : 'recruiter mode: on'
          : state.lang === 'es' ? 'modo reclutador' : 'recruiter mode';
      }
      if (state.data) render(state.data);
    });
  });

  const journeyBtn = $('journey-btn');
  if (journeyBtn) journeyBtn.addEventListener('click', runJourney);

  applyLang();
  refresh();
  setInterval(refresh, 15000);
  setInterval(updateLiveState, 1000);
}

document.addEventListener('DOMContentLoaded', init);
