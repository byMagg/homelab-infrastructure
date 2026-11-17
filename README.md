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

Sin dominio público por ahora. Se usa un dominio interno:

- Zona: `homelab.home.arpa` (RFC 8375, reservado para redes domésticas).
- Fase inicial: entradas en `/etc/hosts` de WSL y Windows apuntando a
  `192.168.1.100`.
- DNS y bloqueo: AdGuard Home en el cluster (`192.168.1.100:53`), con
  reescritura `*.homelab.home.arpa` → `192.168.1.100` ya activa.
- Pendiente: cambiar el DNS (IPv4 **e IPv6**) del DHCP del router a
  `192.168.1.100`.
- TLS: pendiente. Se añadirá cert-manager con CA interna cuando haga falta.

## Decisiones de arquitectura

| Tema | Decisión | Motivo |
|---|---|---|
| SO | Raspberry Pi OS Lite 64-bit (Trixie) | Soporte oficial del hardware |
| Kubernetes | k3s `v1.37.2+k3s1` | Certificado, ligero, ARM64, SQLite |
| CNI / red | flannel + kube-proxy (default de k3s) | Menos piezas; Cilium se probará en una fase posterior |
| Entrada | Traefik (default de k3s) | `ingress-nginx` está EOL y no hace falta añadir nada |
| LoadBalancer | ServiceLB (default de k3s) | Usa las IPs de los nodos; kube-vip llegará más adelante |
| GitOps | Argo CD 3.6.1 | Patrón estándar; se adopta en la Fase 2 |
| Secretos | Pendiente (Sealed Secrets y SOPS+age) | Sin secretos en claro en Git |
| Storage | local-path (default de k3s) | Sin SSD; evita el peso de Longhorn |
| Observabilidad | Pendiente (kube-prometheus-stack) | Fase posterior |
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
- [x] **Fase 1 — Cluster**: k3s `v1.37.2+k3s1` en cluster0 y cluster1,
      kubeconfig en WSL, verificación de nodos, DNS y Traefik.
      *(completada 2026-11-17)*
- [x] **Fase 2 — GitOps + primera app**: Argo CD, repo privado, `whoami` e
      Ingress de Traefik. *(completada 2026-11-17)*
- [ ] **Fase 3 — DNS y bloqueo**: AdGuard Home desplegado en el cluster con
      reescritura wildcard; pendiente el cutover del DNS de la LAN.
      *(desplegado 2026-11-17)*
- [ ] **Fase 4 — TLS y secretos**: cert-manager con CA interna, Sealed Secrets.
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
scripts/       Utilidades de bootstrap, backup y restore
```

## Estado actual

- Repo privado en GitHub con remoto `origin` por SSH.
- Fase 0 aplicada y verificada en cluster0 y cluster1:
  - swap/zram desactivado y `/var/swap` eliminado;
  - journald en memoria y coredumps desactivados;
  - SSH solo con clave, UFW activo y fail2ban;
  - watchdog de hardware y EEPROM actualizada;
  - kernel con `memory` cgroup y sin throttling.
- Fase 1 completada: k3s `v1.37.2+k3s1` en cluster0 (server) y cluster1
  (agent), kubeconfig en `~/.kube/homelab.yaml`, DNS interno y Traefik
  verificados.
- Fase 2 completada: Argo CD `v3.6.1` sincroniza `whoami` desde el repo
  privado con deploy key de solo lectura; Ingress en
  `whoami.homelab.home.arpa` y UI en `argocd.homelab.home.arpa`, con entradas
  en el hosts de WSL y Windows.
- Fase 3 desplegada: AdGuard Home `v0.107.80` en el namespace `adguard`, DNS
  en `192.168.1.100:53` vía ServiceLB, reescritura
  `*.homelab.home.arpa` → `192.168.1.100` y UI en
  `adguard.homelab.home.arpa`. Bloqueo verificado de forma directa.
- Observabilidad: `node-exporter`, `kube-state-metrics`, Prometheus (7 días,
  PVC 5 Gi) y Grafana en `grafana.homelab.home.arpa` con el dashboard
  `Homelab - Cluster` (temperatura, CPU, RAM, disco, red, pods).
- cluster2 incorporado como worker ligero (2 GB), etiquetado
  `homelab.io/role=light` y aislado con un taint `NoSchedule`; `whoami` corre
  allí y `node-exporter` lo monitoriza.
- Reconstrucción 2026-11-17: cluster0 y cluster2 reflasheados, Fase 0/1
  reaplicadas, cluster1 reincorporado con el token nuevo y Argo CD + apps
  resincronizadas.
- Siguiente: cambiar el DNS del DHCP del router (IPv4 e IPv6) a
  `192.168.1.100` y quitar la regla NRPT de los clientes Windows.

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

