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
Acceso desde WSL2 (`192.168.1.110`) por SSH y mDNS (`.local`).

## Dominio local

Sin dominio público todavía. Se usa un dominio interno:

- Zona: `homelab.home.arpa` (RFC 8375, reservado para redes domésticas).
- Fase inicial: entradas en `/etc/hosts` de WSL y Windows apuntando a
  `192.168.1.100`.
- DNS y bloqueo: AdGuard Home en el cluster (`192.168.1.100:53`), con
  reescritura `*.homelab.home.arpa` → `192.168.1.100` ya activa.
- Cutover hecho: el DHCP del router entrega `192.168.1.100` como DNS (IPv4 e
  IPv6) y la regla NRPT de Windows ya se ha retirado.
- TLS: en lo público lo termina Cloudflare (sin cert-manager). Para HTTPS
  dentro de la LAN sigue pendiente una CA interna.

Ya hay un **túnel de Cloudflare** desplegado (`kubernetes/apps/cloudflared`,
namespace `cloudflared`) esperando el dominio para publicar una selección de
servicios. No requiere abrir puertos en el router ni IP fija. Ver
`docs/fase-6.md`.

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
| Backup | Pendiente (snapshots de k3s a Cloudflare R2) | RPO 6 h; bajo coste |
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
      Ingress de Traefik. *(completada 2026-11-17)*
- [x] **Fase 3 — DNS y bloqueo**: AdGuard Home en el cluster, reescritura
      wildcard y cutover del DNS de la LAN (IPv4 e IPv6).
      *(completada 2026-11-21)*
- [ ] **Fase 4 — Secretos y TLS**: Sealed Secrets completado; pendiente el TLS
      interno con CA propia. *(secretos 2026-11-21)*
- [ ] **Fase 5 — Observabilidad**: Prometheus, Grafana y alertas a ntfy.
      *(stack desplegado 2026-11-17; pendientes las alertas)*
- [ ] **Fase 6 — App demo + CI/CD**: multi-arch, Trivy, SBOM, Cosign, Argo.
- [ ] **Fase 7 — Backup y DR**: snapshots a R2, restauración probada.
- [ ] **Fase 8 — Hardening y upgrades**: kube-bench, Kyverno, drill de upgrade.
- [ ] **Fase 9 — Extras**: Tailscale, SLOs, documentación y posts.

## Estructura

```
ansible/       Inventario, roles y playbooks
kubernetes/    Manifiestos y charts gestionados por Argo CD
docs/          Arquitectura, ADRs, runbooks, postmortems
scripts/       (planificado) Utilidades de bootstrap, backup y restore
```

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
- Fase 2 completada: Argo CD `v3.6.1` sincroniza `whoami` desde el repo
  privado con deploy key de solo lectura; Ingress en
  `whoami.homelab.home.arpa` y UI en `argocd.homelab.home.arpa`, con entradas
  en el hosts de WSL y Windows.
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
- Observabilidad: `node-exporter`, `kube-state-metrics`, Prometheus (7 días,
  PVC 5 Gi) y Grafana en `grafana.homelab.home.arpa` con el dashboard
  `Homelab - Cluster` (temperatura, CPU, RAM, disco, red, pods). La UI de
  Prometheus se expone en `prometheus.homelab.home.arpa`.
- cluster2 incorporado como worker ligero (2 GB), etiquetado
  `homelab.io/role=light` y aislado con un taint `NoSchedule`; `whoami` corre
  allí y `node-exporter` lo monitoriza.
- Homepage `v2.8.0` en el namespace `homepage` como panel de inicio en
  `homepage.homelab.home.arpa`: agrupa Argo CD, Grafana, Prometheus, AdGuard y
  whoami con monitorización HTTP, y muestra CPU/RAM del cluster vía el widget
  de Kubernetes (ServiceAccount de solo lectura).
- Reconstrucción 2026-11-17: cluster0 y cluster2 reflasheados, Fase 0/1
  reaplicadas, cluster1 reincorporado con el token nuevo y Argo CD + apps
  resincronizadas.
- Siguiente: alertas a ntfy (fase 5) y backup a R2 (fase 7); el TLS interno
  con CA propia queda pendiente de la fase 4.

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

# Verificación
ansible-playbook ansible/playbooks/verify.yml
```

Si existe un virtualenv local, los mismos comandos funcionan con
`.venv/bin/ansible` y `.venv/bin/ansible-playbook`.

`kubectl` se instala en `~/.local/bin` y el kubeconfig en
`~/.kube/homelab.yaml` (exportado desde `~/.zshrc`).

Los mismos comandos están en el `Makefile` (`make base`, `make security`,
`make pi`, `make verify`) si tienes `make` instalado.

