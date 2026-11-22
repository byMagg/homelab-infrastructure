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
| Workloads | réplicas listas/deseadas, namespace e imagen | API de Kubernetes |
| Datos | último backup, antigüedad, tamaño, R2 y horario | métricas `k3s_backup_*` de node-exporter |
| Observabilidad | targets up/total, alertas activas y reglas | Prometheus + Alertmanager |

La topología SVG conecta navegador → Cloudflare → Traefik → cluster → R2 y
Prometheus. El botón **simular petición** anima un paquete por ese camino.

## Modo reclutador e idiomas

- Botón **modo reclutador** (o `?recruiter=1`): muestra una explicación en
  lenguaje claro dentro de cada capa.
- Selector **ES / EN** (o `?lang=en`): traduce la interfaz. Los datos técnicos
  (nombres de apps, estados de Argo) se mantienen tal cual.
- La preferencia de idioma y el modo reclutador se guardan en `localStorage`.

## API

`GET /live/api/status` devuelve un JSON curado, cacheado 15 s en el servidor:

```json
{
  "summary": { "nodesReady": 3, "appsHealthy": 9, "podsRunning": 35 },
  "edge": { "tunnelReady": 2, "tunnelTotal": 2, "probe": { "status": 200, "ms": 500 } },
  "nodes": [{ "name": "cluster0", "cpu": 9.1, "mem": 51.9, "temp": 31.2 }],
  "apps": [{ "name": "portfolio", "sync": "Synced", "health": "Healthy" }],
  "workloads": [{ "name": "portfolio", "ready": 3, "desired": 3 }],
  "backup": { "lastSuccess": "...", "ageSeconds": 1200, "r2": true },
  "observability": { "targetsUp": 12, "targetsTotal": 12, "alerts": [] }
}
```

El endpoint no acepta parámetros de consulta ni ejecuta PromQL arbitrario: las
consultas están en una lista cerrada en `server.js`.

## Seguridad y datos públicos

- **Nunca** se exponen Secrets, tokens, logs, IPs internas ni PromQL libre.
- La ServiceAccount `observatory` solo puede `get/list` de `nodes`, `pods`,
  `deployments` y `applications`. Sin escritura, sin secrets.
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
curl -s http://observatory.homelab.home.arpa/api/status | jq .
curl -s -o /dev/null -w '%{http_code}\n' http://dbarroso.dev/live

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

1. Añade la consulta al array de `buildStatus()` en `server.js` (lista cerrada).
2. Incluye el dato en el JSON y tipa el render en `web/app.js`.
3. Si es una métrica de Prometheus, comprueba que el target está `up`.
4. Commit: Kustomize cambia el hash del ConfigMap y el pod se recrea solo.
5. Revisa que no aparezcan IPs, nombres internos ni datos sensibles.

## Pendiente

- Añadir request rate/errores de Traefik (requiere habilitar métricas en
  Traefik) y, si se quiere, analytics de Cloudflare.
- Cache/rate limit en Cloudflare para `/live/api/status` si la página recibe
  mucho tráfico.
- Monitor externo (Healthchecks/UptimeRobot) para avisar si el cluster entero
  cae, algo que el propio observatorio no puede hacer.
- Enlazar el observatorio desde el portfolio (hecho en el repo del CV) y desde
  Homepage.
- Notificaciones de Alertmanager (fase 5).
