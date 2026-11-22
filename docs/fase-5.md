# Fase 5 — Observabilidad (parcial)

Stack ligero para ver el estado del cluster y de los tres Pis sin el peso de
`kube-prometheus-stack`.

| Componente | Versión | Función |
| --- | --- | --- |
| `node-exporter` | `v1.10.0` | Métricas del host (temperatura, CPU, RAM, disco, red) |
| `kube-state-metrics` | `v2.15.0` | Estado de nodos, pods, deployments, reinicios |
| `Prometheus` | `v3.5.0` | Scrape cada 30 s, retención 7 d / 3 GB |
| `Alertmanager` | `v0.35.0` | Agrupa las alertas y las envía a ntfy.sh |
| `Grafana` | `13.1.0` | Dashboards de cluster, workloads, pods, plano de control e ingress |

Namespace `observability`, gestionado por Argo CD con
`kubernetes/argocd/observability-app.yaml`.

## Acceso

- Grafana: <http://grafana.homelab.home.arpa>
- Prometheus: <http://prometheus.homelab.home.arpa> (UI y consultas PromQL,
  sin autenticación; solo accesible desde la LAN).
- Alertmanager: <http://alertmanager.homelab.home.arpa> (alertas agrupadas;
  también solo LAN y sin autenticación).
- En Grafana, anónimo: rol **Viewer** (solo lectura).
- Admin de Grafana: contraseña cambiada a mano tras el primer acceso; no está en
  Git. Vive solo en el PVC de Grafana, que no entra en el backup: en un cluster
  nuevo vuelve a `admin`/`admin` y la obliga a cambiar. Pasarla a un
  `SealedSecret` con `existingSecret` sigue pendiente (ver `docs/fase-4.md`).

## Cómo se recogen las métricas

- `node-exporter` corre como DaemonSet con `hostNetwork`, así que su IP de pod
  es la del nodo. Prometheus lo descubre con `role: pod` y reescribe la
  dirección a `:9100`.
- `kubelet` y `cadvisor` se scrapean por `role: node` en `:10250`, con
  `insecure_skip_verify` y el token de la ServiceAccount. El binding a
  `system:kubelet-api-admin` da acceso a `/metrics` y `/metrics/cadvisor`.
- `kube-state-metrics` se scrapea por el Service del namespace.

### Plano de control de k3s

k3s no ejecuta el apiserver, el scheduler ni el datastore como procesos
separados: comparten el proceso `k3s`, que sirve `/metrics` en el puerto del
kubelet (`10250`). Por eso el job `kubelet` ya expone `apiserver_*`,
`scheduler_*`, `process_*`, `go_*` y `kine_*` del nodo `cluster0`. No hace falta
un scrape aparte ni abrir `6443` a la red de pods. `kine_*` es el equivalente a
las métricas de etcd en un cluster con SQLite (`kine_sql_total`,
`kine_sql_time_seconds_*`, `kine_compact_total`).

### Traefik

El chart de Traefik que empaqueta k3s ya arranca con
`--metrics.prometheus=true` y un entrypoint `metrics` en el puerto `9100` del
pod. El job `traefik` lo scrapea por IP de pod, así que no hace falta
`HelmChartConfig` ni tocar UFW. Traefik v3 expone `traefik_entrypoint_*` y
`traefik_service_*` (no hay métricas por router).

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

`Homelab - Pods` (`homelab-pods`):

1. Variables `namespace` y `pod` (ambas con `All`).
2. Estadísticas: pods `Running`, pods que no están `Running`, CPU y memoria
   agregadas, pods con reinicios en la última hora y CPU throttling.
3. Series: top 10 por pod y por contenedor (CPU y memoria), memoria sobre el
   límite (%) y red del pod.
4. Tabla: CPU, memoria y reinicios por contenedor del pod seleccionado.

`Homelab - Control plane` (`homelab-control-plane`):

1. Estadísticas: peticiones/s, errores 5xx, latencia p99, peticiones en vuelo,
   latencia p99 de SQLite y pods en cola de scheduling.
2. Series: peticiones por verbo y código, percentiles de latencia del apiserver,
   latencia de kine/SQLite, CPU/RSS del proceso k3s y goroutines.
3. Tablas: top recursos consultados, operaciones de almacenamiento y colas de
   scheduling.

`Homelab - Ingress (Traefik)` (`homelab-ingress`):

1. Estadísticas: peticiones/s, 5xx, latencia p95, conexiones abiertas, tráfico
   de salida y recargas de configuración.
2. Series: peticiones y latencia por entrypoint, códigos, top servicios y
   conexiones abiertas.
3. Tabla: top servicios por peticiones.

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

### Notificaciones (ntfy)

El receiver `ntfy` envía cada grupo de alertas a <https://ntfy.sh>; ya no hay
receiver `null`.

El **topic** es la credencial del canal: vive en el `SealedSecret`
`observability/ntfy-topic` (clave `topic.tmpl`), se monta en
`/etc/alertmanager-templates` y la config lo usa como plantilla
(`{{ template "ntfy_topic" . }}`). Así el topic no queda en Git. Para
suscribirse hace falta leerlo:

```bash
kubectl -n observability get secret ntfy-topic \
  -o jsonpath='{.data.topic\.tmpl}' | base64 -d
```

En la app de ntfy (Android/iOS/escritorio) se añade ese topic como suscripción.

El webhook publica contra la raíz (`https://ntfy.sh`) con un `payload` JSON
propio. No se publica en `https://ntfy.sh/<topic>` porque ntfy interpretaría el
cuerpo como texto plano y la notificación llegaría como JSON crudo.

- Título: `🔥 <alertname>` al dispararse y `✅ <alertname> (resuelta)` al
  resolverse (`send_resolved: true`).
- Cuerpo: `summary` y `description` de cada alerta.
- Al pulsar la notificación se abre la UI de Alertmanager (solo LAN).
- Agrupado por `alertname` y `node`; `group_wait` 30 s, repetición cada 4 h.

Prueba de punta a punta (la imagen de Alertmanager incluye `amtool`):

```bash
kubectl -n observability exec deploy/alertmanager -- \
  amtool alert add PruebaNtfy node=cluster0 \
    --annotation=summary='Prueba de ntfy' \
    --alertmanager.url=http://localhost:9093
```

La notificación llega tras el `group_wait` (30 s).

Límites y avisos:

- ntfy.sh gratuito: ~250 mensajes/día, caché de 12 h y sin autenticación; el
  topic es lo único que protege el canal. No pongas credenciales ni datos
  sensibles en las anotaciones de las reglas.
- Si el cluster entero cae, Alertmanager cae con él y **no hay notificación por
  este canal**; eso solo lo cubre un monitor externo (ver
  `docs/observatorio.md`).
- Rotar el topic: regenerar `topic.tmpl`, sellarlo otra vez con `kubeseal`,
  commit y recargar Alertmanager (las plantillas se leen al arrancar):

  ```bash
  kubectl -n observability rollout restart deploy/alertmanager
  # o, sin perder los silencios del emptyDir:
  kubectl -n observability exec deploy/alertmanager -- kill -HUP 1
  ```

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
   sobreviven a un reinicio del pod; la configuración y el enrutado sí, porque
   viven en el ConfigMap, y las plantillas (incluido el topic de ntfy) en el
   Secret `ntfy-topic`.

## Verificación

```bash
kubectl -n observability get pods,pvc
kubectl -n observability port-forward svc/prometheus 9090:9090 &
curl -s localhost:9090/api/v1/targets | jq -r '.data.activeTargets[] | "\(.labels.job)\t\(.health)"'
curl -s 'localhost:9090/api/v1/query?query=node_thermal_zone_temp' | jq .
curl -s localhost:9090/api/v1/rules | jq -r '.data.groups[].rules[].name'
curl -I http://grafana.homelab.home.arpa
curl -I http://alertmanager.homelab.home.arpa
kubectl -n observability get sealedsecret ntfy-topic
kubectl -n observability exec deploy/alertmanager -- ls /etc/alertmanager-templates
```

Todos los targets (`prometheus`, `alertmanager`, `node-exporter` ×3,
`kube-state-metrics`, `kubelet` ×3, `cadvisor` ×3, `traefik`) deben estar `up`.
`node-exporter` tolera el taint de cluster2 (`operator: Exists`), así que
también se scrapea el nodo de 2 GB; Prometheus, Grafana y Alertmanager se
quedan en los nodos de 4 GB.

## Pendiente

1. **AdGuard**: no expone Prometheus nativo; necesita un exporter con
   usuario/contraseña de su API (no están en Git). Queda pendiente por las
   credenciales.
2. Valorar VictoriaMetrics o retención mayor si el volumen de series crece.
