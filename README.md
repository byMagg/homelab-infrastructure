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

Sin dominio público por ahora. Se usará un dominio interno:

- Zona: `homelab.home.arpa` (RFC 8375, reservado para redes domésticas).
- DNS interno: dnsmasq o CoreDNS con wildcard `*.homelab.home.arpa`.
- Gateway: `192.168.1.240` (pool de LoadBalancer `192.168.1.240-250`).
- TLS: CA interna con cert-manager. Si más adelante hay dominio público,
  se cambia el ClusterIssuer a Let's Encrypt DNS-01 sin rehacer el cluster.

## Decisiones de arquitectura

| Tema | Decisión | Motivo |
|---|---|---|
| SO | Raspberry Pi OS Lite 64-bit (Trixie) | Soporte oficial del hardware |
| Kubernetes | k3s `v1.37.1+k3s1` | Certificado, ligero, ARM64, SQLite |
| CNI / red | Cilium (eBPF) | Reemplaza kube-proxy, LB IPAM, Gateway API, NetworkPolicy, Hubble |
| Entrada | Gateway API (Cilium) | `ingress-nginx` está EOL desde marzo 2026 |
| GitOps | Argo CD 3.6 (app-of-apps) | Patrón estándar de plataforma |
| Secretos | Sealed Secrets (fase 2); SOPS+age para bootstrap | Sin secretos en claro en Git |
| Storage | local-path | Sin SSD; evita el peso de Longhorn |
| Observabilidad | kube-prometheus-stack tuneado | Métricas, dashboards y alertas |
| Backup | Snapshots de k3s a Cloudflare R2 | RPO 6 h; bajo coste |
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
- [ ] **Fase 1 — Cluster**: reset limpio de k3s, instalación fijada, Cilium,
      kubeconfig en WSL, pruebas de conectividad.
- [ ] **Fase 2 — Red local**: DNS `homelab.home.arpa`, LB IPAM, Gateway,
      CA interna, Sealed Secrets.
- [ ] **Fase 3 — GitOps**: Argo CD, app-of-apps, adopción de componentes.
- [ ] **Fase 4 — Observabilidad**: Prometheus, Grafana, alertas a ntfy.
- [ ] **Fase 5 — App demo + CI/CD**: multi-arch, Trivy, SBOM, Cosign, Argo.
- [ ] **Fase 6 — Backup y DR**: snapshots a R2, restauración probada.
- [ ] **Fase 7 — Hardening y upgrades**: kube-bench, Kyverno, drill de upgrade.
- [ ] **Fase 8 — Extras**: Tailscale, SLOs, documentación y posts.

## Estructura

```
ansible/       Inventario, roles y playbooks
kubernetes/    Manifiestos y charts gestionados por Argo CD
docs/          Arquitectura, ADRs, runbooks, postmortems
scripts/       Utilidades de bootstrap, backup y restore
```

## Estado actual

- Repo inicializado.
- k3s de pruebas eliminado por completo en cluster0 y cluster1.
- Fase 0 aplicada y verificada en cluster0 y cluster1:
  - swap/zram desactivado y `/var/swap` eliminado;
  - journald en memoria y coredumps desactivados;
  - SSH solo con clave, UFW activo y fail2ban;
  - watchdog de hardware y EEPROM actualizada;
  - kernel con `memory` cgroup y sin throttling.
- cluster2 pendiente de la SD.
- Siguiente: Fase 1 (instalación limpia de k3s + Cilium).

## Ejecución

```bash
# Conectividad
.venv/bin/ansible all -m ping

# Fase 0 por bloques
.venv/bin/ansible-playbook ansible/playbooks/phase0.yml --tags base,sd,sysctl,unattended
.venv/bin/ansible-playbook ansible/playbooks/phase0.yml --tags ssh,firewall,fail2ban
.venv/bin/ansible-playbook ansible/playbooks/phase0.yml --tags pi

# Verificación
.venv/bin/ansible-playbook ansible/playbooks/verify.yml
```

Los mismos comandos están en el `Makefile` (`make base`, `make security`,
`make pi`, `make verify`) si tienes `make` instalado.

