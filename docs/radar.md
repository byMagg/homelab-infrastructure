# Radar (UI de Kubernetes)

[Radar](https://github.com/skyhook-io/radar) es una UI de Kubernetes de código
abierto (Apache-2.0): un binario único en Go que habla con la API con su
ServiceAccount. No instala agentes, CRDs ni dependencias en el cluster.

Sirve para responder "¿qué está roto, por qué y qué cambió?" sin saltar entre
`kubectl describe` y `kubectl logs`: cola de issues ordenada por gravedad,
topología clicable, timeline de eventos y cambios con diff, Helm, Argo CD,
auditoría del cluster e impacto de upgrades. También expone un servidor MCP
para agentes de IA.

## Dónde vive

| Pieza | Fichero |
|---|---|
| Namespace | `kubernetes/apps/radar/namespace.yaml` |
| RBAC | `kubernetes/apps/radar/rbac.yaml` |
| Deployment | `kubernetes/apps/radar/deployment.yaml` |
| Service e Ingress | `service.yaml`, `ingress.yaml` |
| Application de Argo CD | `kubernetes/argocd/radar-app.yaml` |

Imagen: `ghcr.io/skyhook-io/radar` (multi-arch; arm64 verificado). Tag fijado
a mano y vigilado por Renovate con el manager regex de `renovate.json`.

## Acceso

- LAN: `http://radar.homelab.home.arpa` (sin autenticación).
- Público: `https://radar.dbarroso.dev`, detrás de **Cloudflare Access**. La
  public hostname y la política viven en el dashboard de Cloudflare, no en este
  repo; aquí solo está la regla de host en el `Ingress` y el valor en
  `--allowed-hosts`.

## Decisiones

- **Solo lectura.** El `ClusterRole` copia el del chart oficial (lectura de
  pods, servicios, configmaps, nodos, eventos, CRDs…) y añade `pods/log`,
  `metrics.k8s.io` (CPU/RAM por pod) y los grupos de las integraciones que hay
  aquí: `argoproj.io`, `helm.cattle.io`, `upgrade.cattle.io`, `traefik.io` y
  `bitnami.com` (Sealed Secrets). No hay verbos de escritura, así que la propia
  UI oculta los botones que no puede usar (Radar consulta sus permisos al
  arrancar con `SelfSubjectAccessReview`).
- **Sin auth + sin escritura.** Al estar expuesto en la LAN sin login se añaden
  `--disable-exec` (sin terminal, debug shells ni navegador de ficheros) y
  `--mcp-read-only` (apaga `/mcp`, que trae herramientas destructivas; queda
  `/mcp-readonly`).
- **Timeline en memoria.** Se pierde al reiniciar el pod. Para conservarlo hay
  que pasar a `--timeline-storage=sqlite` con PVC y `strategy: Recreate`, o a
  `postgres`.
- **Una réplica.** Radar mantiene su propia caché de informers y el búfer del
  timeline en memoria: dos réplicas darían dos vistas distintas.
- **Telemetría apagada** (`RADAR_USAGE_REPORTING=off`).

## Gotchas

- `--allowed-hosts` valida la cabecera `Host`: incluye el host del Ingress, el
  del Service y el FQDN (`radar.radar.svc.cluster.local`) que usa Homepage en
  su `siteMonitor`. Si falta uno, la respuesta es 404.
- Las probes `httpGet` mandan `Host: <IP del pod>`, así que llevan
  `httpHeaders: Host: radar.radar`; si no, el kubelet recibe 404 y el pod nunca
  queda `Ready`.
- El rootfs es de solo lectura: necesita `emptyDir` en `/tmp` (caché de Helm) y
  en `/home/nonroot`.
- Si la URL pública no resuelve desde Windows/WSL justo después de crear la
  public hostname, es caché negativa del resolver: `ipconfig /flushdns` y
  `wsl.exe -u root -e sh -c 'resolvectl flush-caches'`.
- El descubrimiento inicial de CRDs contra el apiserver de un Pi deja avisos
  `probeCount ... rate limiter` en los logs. Son transitorios y no vuelven.
- Conectar un agente por MCP: apuntar a `http://<host>:9280/mcp-readonly`. Nunca
  a `/mcp` mientras el RBAC sea de solo lectura y no haya autenticación.

## Verificación

```bash
kubectl -n radar get pods
curl -s http://radar.homelab.home.arpa/api/health   # status: healthy
curl -s -o /dev/null -w '%{http_code}\n' https://radar.dbarroso.dev/  # 302 (Access)
```
