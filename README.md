# Homelab Kubernetes — 3× Raspberry Pi 4

Cluster de Kubernetes doméstico para aprender y construir un portfolio de
ingeniería cloud: infraestructura como código, GitOps, observabilidad,
seguridad y operación real sobre ARM64.

## Hardware

| Nodo | IP | RAM | Rol | Almacenamiento |
|---|---|---|---|---|
| cluster0 | 192.168.1.100 | 4 GB | control-plane (k3s server) | SD |
| cluster1 | 192.168.1.101 | 4 GB | worker | SD |
| cluster2 | 192.168.1.102 | 2 GB | worker (cargas ligeras) | SD |

Red: `192.168.1.0/24`, gateway `192.168.1.1`.
Acceso desde WSL2 por SSH y mDNS (`.local`); su IP actual es
`192.168.1.114` (DHCP, puede cambiar).

## Dominio local y público

El cluster sirve dos zonas:

- **Interna:** `homelab.home.arpa` (RFC 8375, reservado para redes domésticas).
  AdGuard Home resuelve `*.homelab.home.arpa` → `192.168.1.100`; el DHCP del
  router entrega esa IP como DNS (IPv4 e IPv6) y la regla NRPT de Windows ya
  se retiró. Los `hosts` locales ya no son necesarios.
- **Pública:** `dbarroso.dev`, publicada con **Cloudflare Tunnel** sin abrir
  puertos en el router ni depender de IP fija. TLS lo termina Cloudflare (sin
  cert-manager).

Hosts públicos activos: `dbarroso.dev` (portfolio) y `dbarroso.dev/live`
(observatorio en vivo), `lab.dbarroso.dev` (Homepage), y `grafana` / `argocd`
detrás de Cloudflare Access. **Prometheus no se publica**: no tiene regla
pública en el `Ingress` ni public hostname, y se consulta solo desde la LAN (su
UI no tiene autenticación).

Para HTTPS dentro de la LAN sigue pendiente una CA interna. Ver
`docs/fase-4.md`.

## Decisiones de arquitectura

| Tema | Decisión | Motivo |
|---|---|---|
| SO | Raspberry Pi OS Lite 64-bit (Trixie) | Soporte oficial del hardware |
| Kubernetes | k3s `v1.37.2+k3s1` | Certificado, ligero, ARM64, SQLite |
| CNI / red | flannel + kube-proxy (default de k3s) | Menos piezas; Cilium se probará en una fase posterior |
| Entrada | Traefik (default de k3s) | `ingress-nginx` está EOL y no hace falta añadir nada |
| LoadBalancer | ServiceLB (default de k3s) | Usa las IPs de los nodos; kube-vip llegará más adelante |
| GitOps | Argo CD 3.6.1 | Patrón estándar; se adopta en la Fase 2 |
| Secretos | Sealed Secrets `v0.41.2` (SOPS+age como alternativa) | Cifrados en Git; sin secretos en claro |
| Storage | local-path (default de k3s) | Sin SSD; evita el peso de Longhorn |
| Observabilidad | Prometheus + Grafana propios | Sin Helm; manifiestos en `kubernetes/apps/observability` |
| Backup | SQLite (`state.db`) local + R2 con rclone | RPO 24 h; sin etcd, `etcd-snapshot` no aplica |
| Aprovisionamiento | Ansible (Terraform descartado por ahora) | No hay API de hardware; ver ADR-001 |
| HA control-plane | No (fase futura con kube-vip) | El nodo de 2 GB no debe ser CP |

## Particularidades de Raspberry Pi OS

1. **cgroup v2 con memoria deshabilitada.** El firmware inyecta
   `cgroup_disable=memory`. Sin el fix, los límites de memoria de los pods se
   aceptan pero no se aplican. Hay que añadir al final de la única línea de
   `/boot/firmware/cmdline.txt`:
   ```
   cgroup_enable=memory cgroup_memory=1
   ```
   Verificación correcta:
   ```
   cat /sys/fs/cgroup/cgroup.controllers   # debe incluir "memory"
   ```
   `/proc/cgroups` no sirve como comprobación en cgroup v2.

2. **Swap deshabilitado** (requisito de kubelet).
3. **SD como único disco**: journald volátil, rotación de logs de contenedor,
   snapshots frecuentes y SD de repuesto.

## Fases

- [x] **Fase 0 — Base**: SO, SSH, hardening, cgroups, swap, journald, hora,
      firewall, inventario Ansible. *(completada 2026-11-17)*
- [x] **Fase 1 — Cluster**: k3s `v1.37.2+k3s1` en cluster0, cluster1 y
      cluster2, kubeconfig en WSL, verificación de nodos, DNS y Traefik.
      *(completada 2026-11-17)*
- [x] **Fase 2 — GitOps + primera app**: Argo CD, repo privado, `whoami` e
      Ingress de Traefik. *(completada 2026-11-17; `whoami` se retiró el
      2026-11-19 y su papel lo cubre el portfolio)*
- [x] **Fase 3 — DNS y bloqueo**: AdGuard Home en el cluster, reescritura
      wildcard y cutover del DNS de la LAN (IPv4 e IPv6).
      *(completada 2026-11-21)*
- [ ] **Fase 4 — Secretos y TLS**: Sealed Secrets completado; pendiente el TLS
      interno con CA propia. *(secretos 2026-11-21)*
- [ ] **Fase 5 — Observabilidad**: Prometheus, Grafana, Alertmanager, ntfy y
      dashboards de pods, plano de control y Traefik. *(ntfy, pods, control
      plane y Traefik el 2026-11-22; quedan AdGuard y la retención)*
- [x] **Fase 6 — Dominio público y portfolio**: Cloudflare Tunnel,
      `dbarroso.dev` y el CV publicado. *(túnel y 5 hostnames activos
      2026-11-25)*
- [ ] **Fase 6b — Hardening del build**: multi-arch, Trivy, SBOM y Cosign.
      *(el tag lo actualiza Argo CD Image Updater en el cluster)*
- [x] **Fase 7 — Backup y DR**: copias consistentes de SQLite + token, retención
      local y réplica a R2, restauración probada. *(completada 2026-11-22;
      los PVC de las apps quedan para la fase 7b)*
- [ ] **Fase 8 — Hardening y upgrades**: kube-bench, Kyverno, drill de upgrade.
- [ ] **Fase 9 — Extras**: Tailscale, SLOs, documentación y posts.
- [x] **Extra — Observatorio público**: `dbarroso.dev/live`, explicaciones en
      dos niveles, topología clicable con recorrido, fichas de workloads y
      dashboards nativos, ES/EN. *(2026-11-22)*
- [x] **Extra — Radar**: UI de Kubernetes de solo lectura (issues, topología,
  timeline, Helm y Argo CD) en `radar.dbarroso.dev` tras Access, con servidor
  MCP de solo lectura. *(2026-11-25)*

## Estructura

```
ansible/       Inventario, roles y playbooks
kubernetes/    Manifiestos y charts gestionados por Argo CD
docs/          Arquitectura, ADRs, runbooks, postmortems
```

## Documentación

| Documento | Para qué |
|---|---|
| [`docs/ansible-guia.md`](docs/ansible-guia.md) | Empezar con Ansible: modelo mental, mapa del repo y comandos seguros |
| [`docs/despliegue.md`](docs/despliegue.md) | Cómo se automatiza el despliegue (Ansible + Argo CD) y qué queda manual |
| [`docs/actualizaciones.md`](docs/actualizaciones.md) | Qué se actualiza solo, cuándo, y procedimiento de upgrade de k3s |
| [`docs/fase-7.md`](docs/fase-7.md) | Backup y recuperación: SQLite, R2, restauración y drill |
| [`docs/observatorio.md`](docs/observatorio.md) | Observatorio público: capas, API, seguridad y despliegue |
| [`docs/radar.md`](docs/radar.md) | Radar: UI de Kubernetes de solo lectura y su MCP |
| [`docs/adr-001-ansible-en-lugar-de-terraform.md`](docs/adr-001-ansible-en-lugar-de-terraform.md) | Por qué Ansible y no Terraform |

Las fases están documentadas en `docs/fase-0.md` … `docs/fase-7.md`.

## Estado actual

- Repo privado en GitHub con remoto `origin` por SSH.
- Fase 0 aplicada y verificada en los tres nodos:
  - swap/zram desactivado y `/var/swap` eliminado;
  - journald en memoria y coredumps desactivados;
  - SSH solo con clave, UFW activo y fail2ban;
  - watchdog de hardware y EEPROM actualizada;
  - kernel con `memory` cgroup y sin throttling.
- Fase 1 completada: k3s `v1.37.2+k3s1` en cluster0 (server) y cluster1 /
  cluster2 (agents), kubeconfig en `~/.kube/homelab.yaml`, DNS interno y
  Traefik verificados.
- Fase 2 completada: Argo CD `v3.6.1` sincroniza las apps del repo privado con
  deploy key de solo lectura; UI en `argocd.homelab.home.arpa` (y
  `argocd.dbarroso.dev` detrás de Access). La app `whoami` de esta fase se
  retiró el 2026-11-19; hoy el ejemplo desplegado es el portfolio. Desde el
  2026-11-25 Argo CD se autogestiona desde `kubernetes/apps/argocd`.
- Fase 3 completada: AdGuard Home `v0.107.80` en el namespace `adguard`, DNS
  en `192.168.1.100:53` vía ServiceLB, reescritura
  `*.homelab.home.arpa` → `192.168.1.100` y UI en
  `adguard.homelab.home.arpa`. El router ya entrega AdGuard como DNS (IPv4 e
  IPv6), la regla NRPT de Windows se ha retirado y la resolución se verifica
  contra `cluster0` sin reglas locales.
- Secretos: Sealed Secrets `v0.41.2` en el namespace `sealed-secrets`. El token
  del túnel vive como `SealedSecret` en `kubernetes/apps/cloudflared` y el
  controller recrea el `Secret`; la clave privada está respaldada fuera del
  repo. Ver `docs/fase-4.md`.
- Observabilidad: `node-exporter`, `kube-state-metrics`, Prometheus (7 días /
  3 GB, PVC 5 Gi), Grafana `13.1.0` y Alertmanager `v0.35.0`. Cinco dashboards
  (`Cluster`, `Workloads`, `Pods`, `Control plane` e `Ingress`) en
  `grafana.homelab.home.arpa` y notificaciones a ntfy.sh. Prometheus se
  consulta en `prometheus.homelab.home.arpa` (solo LAN) y Alertmanager en
  `alertmanager.homelab.home.arpa`.
- cluster2 incorporado como worker ligero (2 GB), etiquetado
  `homelab.io/role=light` y aislado con un taint `NoSchedule`; `node-exporter`
  lo monitoriza y el portfolio tolera el taint (hoy tiene réplicas allí).
- Homepage `v2.8.0` en el namespace `homepage` como panel de inicio en
  `homepage.homelab.home.arpa` (y `lab.dbarroso.dev`): agrupa Argo CD, Grafana,
  Prometheus, AdGuard, el portfolio, el observatorio y Radar con monitorización
  HTTP, y muestra CPU/RAM del cluster vía el widget de Kubernetes
  (ServiceAccount de solo lectura).
- Observatorio público: `kubernetes/apps/observatory` sirve
  `dbarroso.dev/live` con explicaciones en lenguaje claro (y detalle técnico
  visible), topología clicable, recorrido guiado de una petición, fichas de
  cada workload y dashboards nativos con pestañas y rangos. Un BFF en Node
  consulta Prometheus, la API de Kubernetes y Alertmanager con permisos de solo
  lectura; no expone secretos, IPs ni PromQL libre. ES/EN y enlaces directos
  (`?tab`, `?range`, `?node`, `?workload`). Ver `docs/observatorio.md`.
- Fase 6 desplegada: Cloudflare Tunnel `2026.11.1` con 2 réplicas conectadas al
  borde. Publicados `dbarroso.dev` (portfolio), `lab` (Homepage), y `grafana` /
  `argocd` / `radar` con Access. `prometheus` no se publica: no tiene regla
  pública en el `Ingress` ni public hostname.
- Radar: `kubernetes/apps/radar` en `radar.homelab.home.arpa` y, tras
  Cloudflare Access, `radar.dbarroso.dev`. UI de Kubernetes de solo lectura
  (RBAC sin escritura, `--disable-exec`, MCP en `/mcp-readonly`) con issues,
  topología, timeline, Helm, Argo CD y auditoría. Ver `docs/radar.md`.
- Automatización: la Application raíz `homelab-root` (app-of-apps) gestiona
  `kubernetes/argocd/`, así que añadir una app es solo commitear su
  `*-app.yaml`. Argo CD se autogestiona desde `kubernetes/apps/argocd` y
  Renovate vigila su tag. GitHub Actions ejecuta `ansible-lint` +
  `--syntax-check` en cada cambio de `ansible/`, y Argo CD Image Updater
  actualiza el tag del portfolio solo (sin secretos ni cron).
- Reconstrucción 2026-11-17: cluster0 y cluster2 reflasheados, Fase 0/1
  reaplicadas, cluster1 reincorporado con el token nuevo y Argo CD + apps
  resincronizadas.
- Fase 7 completada: `cluster0` usa **SQLite/kine**, así que no hay
  `etcd-snapshot`. Un timer systemd crea cada día una copia consistente de
  `state.db` + token + `tls/cred/manifests` en `/var/backups/k3s` (4 copias) y
  la replica a R2 (`homelab/k3s`, 14 días) con rclone; las credenciales viven
  en el SealedSecret `kube-system/r2-backup`. Restauración probada el 2026-11-22
  (18 s de caída, marcador posterior eliminado) con
  `k3s-datastore-restore`. Ver `docs/fase-7.md`.
- Siguiente: métricas de AdGuard (fase 5), monitor externo, hardening del build
  del portfolio (fase 6b), PVCs de las apps (fase 7b), TLS interno (fase 4) y
  hardening/upgrades (fase 8).

## Ejecución

```bash
# Conectividad
ansible all -m ping

# Alta de un nodo recién flasheado (usuario `admin` de Raspberry Pi Imager)
ansible-playbook ansible/playbooks/bootstrap.yml \
  -e ansible_user=admin --ask-pass --ask-become-pass --limit cluster0

# Fase 0 por bloques
ansible-playbook ansible/playbooks/phase0.yml --tags base,sd,sysctl,unattended
ansible-playbook ansible/playbooks/phase0.yml --tags ssh,firewall,fail2ban
ansible-playbook ansible/playbooks/phase0.yml --tags pi

# Fase 1
ansible-playbook ansible/playbooks/phase1.yml

# Fase 7 — backups del datastore SQLite
ansible-playbook ansible/playbooks/phase7.yml

# Verificación
ansible-playbook ansible/playbooks/verify.yml
```

Si existe un virtualenv local, los mismos comandos funcionan con
`.venv/bin/ansible` y `.venv/bin/ansible-playbook`.

`kubectl` se instala en `~/.local/bin` y el kubeconfig en
`~/.kube/homelab.yaml` (exportado desde `~/.zshrc`).

Los mismos comandos están en el `Makefile` (`make base`, `make security`,
`make pi`, `make verify`) si tienes `make` instalado.

