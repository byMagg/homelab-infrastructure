# Observatorio público del homelab

Fecha: 2026-11-22
URL pública: <https://dbarroso.dev/live>
URL interna: <http://observatory.homelab.home.arpa>
Namespace: `observatory`
Application: `kubernetes/argocd/observatory-app.yaml`

## Objetivo

Que un reclutador (o cualquiera) entienda en segundos qué hay montado y lo vea
funcionando de verdad: edge, cluster, GitOps, workloads, backups y
observabilidad, con datos en vivo y una estética de terminal coherente con el
CV.

No es un dashboard de administración: es una pieza de portfolio. La UI interna
(Homepage, Grafana, Argo, Prometheus) sigue existiendo aparte.

## Cómo se sirve

```
navegador → dbarroso.dev/live
              │
              ▼
        Cloudflare edge (TLS, WAF)
              │ túnel QUIC
              ▼
        Traefik ── PathPrefix /live ──► Service observatory:80
                                              │
                                              ▼
                                   node:22-alpine + server.js
                                   ├─ /live/*  estáticos (ConfigMap)
                                   └─ /live/api/status  JSON curado
```

El Ingress del portfolio ya ocupa `dbarroso.dev/`; Traefik elige la ruta más
específica (`/live`) y la manda al observatorio. No hay public hostname nuevo
en Cloudflare: se reutiliza el túnel y el `Ingress`.

Todo va dentro del cluster, como pidió el usuario. Si el cluster cae, la página
también; la diferencia con un panel alojado fuera es que el propio observatorio
mostraría el estado degradado si solo falla una capa.

## Estructura

```
kubernetes/apps/observatory/
├── kustomization.yaml      # configMapGenerator + recursos
├── namespace.yaml
├── rbac.yaml               # ServiceAccount + ClusterRole de solo lectura
├── deployment.yaml         # node:22-alpine, uid 65534, rootfs read-only
├── service.yaml
├── ingress.yaml            # dbarroso.dev/live + host interno
├── server.js               # BFF sin dependencias
└── web/
    ├── index.html
    ├── styles.css
    └── app.js
```

`configMapGenerator` mete `server.js` y los tres ficheros web en un ConfigMap
con hash. El Deployment referencia el nombre sin hash y Kustomize lo reescribe;
cuando cambia cualquier fichero, cambia el nombre y el pod se recrea solo. No
hace falta reiniciar nada a mano.

## Capas que se muestran

| Capa | Datos | Origen |
|---|---|---|
| Edge | túnel listo/total, latencia y status de una petición pública | API de Kubernetes + probe HTTP a `dbarroso.dev/live/healthz` |
| Cluster | 3 nodos, rol, Ready, CPU, RAM, temperatura, disco, uptime y sparkline | Prometheus |
| GitOps | apps de Argo, sync/health, revisión y última sincronización | CRD `applications.argoproj.io` |
| Workloads | réplicas, CPU/memoria, reinicios, pods y detalle por Deployment/DaemonSet | API de Kubernetes + cAdvisor |
| Datos | último backup, antigüedad, tamaño, R2 y horario | métricas `k3s_backup_*` de node-exporter |
| Observabilidad | targets up/total, alertas activas y reglas | Prometheus + Alertmanager |
| Dashboards | CPU/mem/temperatura, peticiones web, API y top de pods | Prometheus (consultas cerradas) |

La topología SVG conecta navegador → Cloudflare → Traefik → cluster → R2 y
Prometheus. El **recorrido guiado** resalta cada pieza y explica qué ocurre; al
pulsar cualquier nodo se abre un cajón con su explicación y datos en vivo.

## Explicaciones, idiomas y enlaces directos

- Cada bloque tiene una explicación en lenguaje claro **siempre visible** y su
  detalle técnico justo debajo, también visible. No hay desplegables ni modos
  que activar.
- Selector **ES / EN** (o `?lang=en`): traduce la interfaz. Los nombres de apps
  y estados de Argo se mantienen tal cual.
- Recorrido de una petición en 5 pasos, con reproducción automática o manual.
- Enlaces directos: `?node=edge`, `?workload=portfolio`, `?tab=web&range=6h`.
  Al abrirlos se muestran el cajón o la pestaña correspondientes.
- Buscador de workloads y botón para mostrar las piezas internas del cluster.

## Accesos de solo lectura

La sección **Entrar en las aplicaciones** enlaza las apps con interfaz:

| Tipo | Apps | Comportamiento |
|---|---|---|
| Público | portfolio, Homepage, observatorio | Abren directamente; son de solo lectura |
| Cloudflare Access | Grafana, Argo CD | El visitante necesita pasar Access |
| Solo LAN | Prometheus, Alertmanager, AdGuard | No se publican en Internet |

No se publican credenciales ni se permite escribir. Para dar acceso público de
solo lectura a Grafana, la vía soportada son los **dashboards compartidos
externamente** (*Share → Share externally*): son de solo lectura y no permiten
ejecutar PromQL arbitrario. Requiere una acción de admin en Grafana; Argo CD no
tiene modo anónimo de solo lectura.

## API

`GET /live/api/status` devuelve un JSON curado, cacheado 15 s en el servidor:

```json
{
  "summary": { "nodesReady": 3, "appsHealthy": 9, "podsRunning": 35 },
  "edge": { "tunnelReady": 2, "tunnelTotal": 2, "probe": { "status": 200, "ms": 500 } },
  "nodes": [{ "name": "cluster0", "cpu": 9.1, "mem": 51.9, "temp": 31.2 }],
  "apps": [{ "name": "portfolio", "sync": "Synced", "health": "Healthy" }],
  "workloads": [{
    "id": "portfolio", "kind": "Deployment", "ready": 3, "desired": 3,
    "cpu": 0.01, "mem": 16560128, "restarts": 0,
    "resources": { "cpuRequestMillis": 10, "memRequestBytes": 25165824 },
    "pods": [{ "name": "portfolio-...", "node": "cluster2", "phase": "Running" }]
  }],
  "backup": { "lastSuccess": "...", "ageSeconds": 1200, "r2": true },
  "observability": { "targetsUp": 12, "targetsTotal": 12, "alerts": [] }
}
```

`GET /live/api/dashboards?range=15m|1h|6h` devuelve, cacheado 60 s:

```json
{
  "range": "1h",
  "charts": {
    "cluster": { "cpu": [{ "label": "cluster0", "points": [[1700000000000, 9.1]] }] },
    "web": { "requests": [{ "label": "total", "points": [] }] },
    "api": { "requests": [], "errors": [], "latency": [] }
  },
  "top": { "cpu": [{ "label": "ns/pod", "value": 0.03 }], "memory": [] }
}
```

Ningún endpoint acepta PromQL: las consultas están en una lista cerrada en
`server.js` y el único parámetro es `range`, validado contra `RANGE_PRESETS`.

## Seguridad y datos públicos

- **Nunca** se exponen Secrets, tokens, logs, IPs internas ni PromQL libre.
- La ServiceAccount `observatory` solo puede `get/list` de `nodes`, `pods`,
  `deployments`, `daemonsets` y `applications`. Sin escritura, sin secrets.
- El contenedor corre como uid/gid `65534` (igual que Prometheus) para poder
  leer el token proyectado de la ServiceAccount, con rootfs de solo lectura.
- Cabeceras CSP, `X-Content-Type-Options`, `Referrer-Policy` y
  `Permissions-Policy` en todas las respuestas.
- El probe público sale a `https://dbarroso.dev/live/healthz` y vuelve por el
  túnel; mide la ruta real, con la latencia extra del hairpin.

## Verificación

```bash
# API y estáticos
curl -s http://observatory.homelab.home.arpa/healthz
curl -s http://observatory.homelab.home.arpa/api/status | jq .summary
curl -s 'http://observatory.homelab.home.arpa/api/dashboards?range=1h' | jq '.charts.cluster.cpu | length'
curl -s -o /dev/null -w '%{http_code}\n' 'http://dbarroso.dev/live/?tab=web&range=6h'

# La ruta /live tiene que ganar a / del portfolio
curl -s -o /dev/null -w '%{http_code}\n' http://dbarroso.dev/
curl -s -o /dev/null -w '%{http_code}\n' http://dbarroso.dev/live
```

Comprobación visual con Chrome headless:

```bash
chrome --headless=new --screenshot=/tmp/live.png \
  --window-size=1440,3000 'https://dbarroso.dev/live'
```

## Cómo añadir una capa o métrica

1. Añade la consulta al array de `buildStatus()` o `buildDashboards()` en
   `server.js` (lista cerrada).
2. Incluye el dato en el JSON y tipa el render en `web/app.js`.
3. Si es una métrica de Prometheus, comprueba que el target está `up`.
4. Commit: Kustomize cambia el hash del ConfigMap y el pod se recrea solo.
5. Revisa que no aparezcan IPs, nombres internos ni datos sensibles.

## Pendiente

- Publicar en Grafana los dashboards como *externamente compartidos* si se
  quiere enlazar la UI real en solo lectura desde el observatorio (requiere
  admin; Argo CD no ofrece modo anónimo).
- Cache/rate limit en Cloudflare para `/live/api/status` si la página recibe
  mucho tráfico.
- Monitor externo (Healthchecks/UptimeRobot) para avisar si el cluster entero
  cae, algo que el propio observatorio no puede hacer.
