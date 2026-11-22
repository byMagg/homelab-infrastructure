# Fase 5 — Observabilidad (parcial)

Stack ligero para ver el estado del cluster y de los tres Pis sin el peso de
`kube-prometheus-stack`.

| Componente | Versión | Función |
| --- | --- | --- |
| `node-exporter` | `v1.10.0` | Métricas del host (temperatura, CPU, RAM, disco, red) |
| `kube-state-metrics` | `v2.15.0` | Estado de nodos, pods, deployments, reinicios |
| `Prometheus` | `v3.5.0` | Scrape cada 30 s, retención 7 d / 3 GB |
| `Alertmanager` | `v0.35.0` | Agrupa las alertas; receiver `null` (sin envío todavía) |
| `Grafana` | `13.1.0` | Dashboard `Homelab - Cluster` |

Namespace `observability`, gestionado por Argo CD con
`kubernetes/argocd/observability-app.yaml`.

## Acceso

- Grafana: <http://grafana.homelab.home.arpa>
- Prometheus: <http://prometheus.homelab.home.arpa> (UI y consultas PromQL,
  sin autenticación; solo accesible desde la LAN).
- Alertmanager: <http://alertmanager.homelab.home.arpa> (alertas agrupadas;
  también solo LAN y sin autenticación).
- Anónimo: rol **Viewer** (solo lectura).
- Admin: `admin` / `admin`; Grafana obliga a cambiarla al primer acceso. No hay
  Secret en Git a propósito.

## Cómo se recogen las métricas

- `node-exporter` corre como DaemonSet con `hostNetwork`, así que su IP de pod
  es la del nodo. Prometheus lo descubre con `role: pod` y reescribe la
  dirección a `:9100`.
- `kubelet` y `cadvisor` se scrapean por `role: node` en `:10250`, con
  `insecure_skip_verify` y el token de la ServiceAccount. El binding a
  `system:kubelet-api-admin` da acceso a `/metrics` y `/metrics/cadvisor`.
- `kube-state-metrics` se scrapea por el Service del namespace.

Temperatura en el Pi:

```
node_thermal_zone_temp{type="cpu-thermal",zone="0"} 36.5
```

También existe `node_hwmon_temp_celsius{chip="thermal_thermal_zone0"}` con el
mismo valor duplicado por sensor; el dashboard usa `node_thermal_zone_temp`.

## Dashboard

Provisionados como una clave por dashboard dentro del mismo ConfigMap
(`grafana-dashboard-homelab`), sin tocar la UI. El proveedor `file` de Grafana
lee todos los ficheros del directorio montado, así que añadir una clave basta:
no hay que reiniciar el pod (kubelet tarda hasta un minuto en refrescar el
volumen).

`Homelab - Cluster` (uid `homelab-cluster`, fichero `homelab-overview.json`):

1. Estadísticas: temperatura máxima, CPU, memoria, disco, nodos `Ready`, pods
   que no están `Running` y uptime mínimo.
2. Series temporales: temperatura, CPU, memoria, load average, disco `/` y
   tráfico `eth0`.
3. Tabla: top 10 de reinicios por pod.

`Homelab - Workloads` (`homelab-workloads`):

1. Estadísticas: pods `Running`, pods `Pending`/`Failed`/`Unknown`, pods con
   reinicios en la última hora y deployments incompletos (`available` <
   `spec.replicas`).
2. Series temporales: CPU y memoria por namespace (top 8) y, por nodo, CPU y
   memoria reservadas (`kube_pod_container_resource_requests`) frente a las
   asignables (`kube_node_status_allocatable`).
3. Tablas: top 10 de pods por CPU y por memoria, y pods `Running` por
   namespace.

Sustituye a Headlamp, que pedía pegar en cada navegador un token de
ServiceAccount con `cluster-admin` y caducidad de una hora.

## Alertas

Prometheus evalúa las reglas de `kubernetes/apps/observability/rules.yaml`
cada 30 s y las envía a Alertmanager (`v0.35.0`), que las agrupa por
`alertname` y `node`.

| Alerta | Condición | Para |
|---|---|---|
| `NodeNotReady` | `kube_node_status_condition` no `Ready` | 5 min |
| `NodeTemperatureHigh` | CPU > 75 °C | 10 min |
| `NodeFilesystemAlmostFull` | < 15 % libre en `/` | 10 min |
| `TargetDown` | `up == 0` | 5 min |
| `K3sBackupStale` | último backup > 26 h | 10 min |
| `K3sBackupMissing` | no existe la métrica de backup | 15 min |
| `AlertmanagerDown` | Prometheus no scrapea Alertmanager | 5 min |

El receiver es **`null`**: las alertas se ven en Prometheus (`/alerts`) y en la
UI de Alertmanager, pero no se envía ningún email/push. Para activar las
notificaciones más adelante basta con añadir un receiver `email` (o `webhook`
para ntfy/Telegram) en `alertmanager-config` y cambiar `route.receiver`. Las
credenciales SMTP irían en un `SealedSecret`, igual que `kube-system/r2-backup`.

`k3s_backup_last_success_timestamp_seconds` lo escribe el script de backup en
`/var/lib/node-exporter/textfile/k3s_backup.prom`; `node-exporter` lo expone con
el textfile collector y la regla avisa si el último backup tiene más de 26 h.

Prometheus **no recarga la configuración solo**. Tras cambiar
`prometheus-config` o `prometheus-rules`:

```bash
kubectl -n observability rollout restart deploy/prometheus
# o, sin reiniciar:
kubectl -n observability exec deploy/prometheus -- \
  wget -qO- --post-data='' http://localhost:9090/-/reload
```

## Firewall

Prometheus corre en la red de pods y scrapea la IP de cada nodo, así que UFW
permite `9100/tcp` y `10250/tcp` desde `cluster_cidr` y `service_cidr`
(`ansible/roles/common/tasks/main.yml`, tag `firewall`). Sin esas reglas los
targets quedan `down` aunque los pods estén `Running`.

## Gotchas

1. **`node-exporter` no tiene endpoints de salud.** No existen `/-/healthy` ni
   `/-/ready`; los probes apuntan a `/` y a TCP `9100`.
2. **La salud de `kube-state-metrics` está en el puerto de métricas.** `/healthz`
   responde en `8080`, no en el puerto de telemetría (`8081`).
3. **Grafana con rootfs de solo lectura.** El instalador de plugins en segundo
   plano falla contra `/usr/share/grafana`; se desactiva con
   `GF_PLUGINS_PREINSTALL_DISABLED=true`. Grafana solo escribe en
   `/var/lib/grafana` (PVC) y `/tmp` (`emptyDir`).
4. **Grafana necesita ~350 MB en marcha.** Con un límite de 256 Mi el primer
   arranque (instalación de plugins incluida en la imagen) terminó en
   `OOMKilled`; el navegador mostraba `ChunkLoadError` al pedir un chunk
   mientras el pod se reiniciaba. Límite actual: 768 Mi (`request` 256 Mi). Un
   `ChunkLoadError` con el asset respondiendo 200 suele ser un reinicio del pod
   a mitad de carga: recarga forzada (`Ctrl+Shift+R`).
5. **Cardinalidad de cadvisor.** Los tres nodos generan ~79k series; la
   retención por tamaño (3 GB) evita llenar el PVC de 5 Gi. Si crece, subir
   `scrape_interval` o filtrar métricas de cadvisor.
6. **local-path no comparte datos.** Prometheus y Grafana quedan atados al nodo
   donde se creó su PVC; no hay HA (una réplica cada uno).
7. **Alertmanager usa `emptyDir`.** Los silencios y el estado interno no
   sobreviven a un reinicio del pod; las reglas y el enrutado sí, porque viven
   en el ConfigMap.

## Verificación

```bash
kubectl -n observability get pods,pvc
kubectl -n observability port-forward svc/prometheus 9090:9090 &
curl -s localhost:9090/api/v1/targets | jq -r '.data.activeTargets[] | "\(.labels.job)\t\(.health)"'
curl -s 'localhost:9090/api/v1/query?query=node_thermal_zone_temp' | jq .
curl -s localhost:9090/api/v1/rules | jq -r '.data.groups[].rules[].name'
curl -I http://grafana.homelab.home.arpa
curl -I http://alertmanager.homelab.home.arpa
```

Todos los targets (`prometheus`, `alertmanager`, `node-exporter` ×3,
`kube-state-metrics`, `kubelet` ×3, `cadvisor` ×3) deben estar `up`.
`node-exporter` tolera el taint de cluster2 (`operator: Exists`), así que
también se scrapea el nodo de 2 GB; Prometheus, Grafana y Alertmanager se
quedan en los nodos de 4 GB.

## Pendiente

1. **Notificaciones** de las alertas (email, ntfy o Telegram). Las reglas y
   Alertmanager ya están montados con receiver `null`; falta el canal.
2. Dashboard por pod (CPU/memoria de contenedores) usando cadvisor.
3. Métricas del servidor de k3s (apiserver, etcd/SQLite) y de AdGuard.
4. Valorar VictoriaMetrics o retención mayor si el volumen de series crece.
