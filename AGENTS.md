# AGENTS.md

Repo de infraestructura (no hay código de aplicación): Ansible para los nodos y,
más adelante, manifiestos en `kubernetes/`. README y docs están en español;
mantén ese idioma en prosa, docs y nombres de tareas Ansible.

## Comandos

Ejecuta siempre desde la raíz del repo: `ansible.cfg` usa rutas relativas
(`roles_path`, `inventory`, `collections_path`).

```bash
ansible all -m ping
ansible-playbook ansible/playbooks/bootstrap.yml -e ansible_user=admin --ask-pass --ask-become-pass --limit cluster0
ansible-playbook ansible/playbooks/phase0.yml --tags base,sd,sysctl,unattended
ansible-playbook ansible/playbooks/phase0.yml --tags ssh,firewall,fail2ban
ansible-playbook ansible/playbooks/phase0.yml --tags pi
ansible-playbook ansible/playbooks/phase1.yml
ansible-playbook ansible/playbooks/verify.yml
```

- Ansible está instalado en el sistema (`/usr/bin/ansible`). Si existe
  `.venv/`, los mismos comandos funcionan con `.venv/bin/...`.
- **`make` no está instalado en el WSL del usuario**: el `Makefile` existe, pero
  usa los comandos `.venv/bin/...` directamente.
- Las colecciones viven en `ansible/collections` (ignorado por git). Si falta
  `community.general` (módulo `ufw`):
  `.venv/bin/ansible-galaxy collection install community.general -p ansible/collections`
- `stdout_callback = yaml` no existe en ansible-core 2.22; ya está configurado
  como `default` + `result_format = yaml`. No lo cambies.
- `sudo` en WSL pide contraseña; para tareas root no interactivas usa
  `wsl.exe -u root -e sh -c '...'`.

## Orden de la Fase 0

`base,sd,sysctl,unattended` → `ssh,firewall,fail2ban` → `pi` → **reiniciar** →
`verify`. El reinicio es obligatorio: aplica EEPROM/config.txt, watchdog y
journald en RAM. No ejecutes `firewall`/`ssh` a la vez que `base` sin motivo.

## Inventario y acceso

- Automatización siempre como `ansible` (NOPASSWD sudo). `admin` es solo
  interactivo y **no** tiene sudo sin contraseña.
- Jerarquía: `k3s_cluster` → `k3s_server` (cluster0) / `k3s_agents`
  (cluster1 y cluster2).
- Un nodo recién flasheado necesita `bootstrap.yml` como `admin` antes de
  Ansible; crea `ansible` con la clave del portátil y sudo NOPASSWD.
- `cluster2` (2 GB) está aislado con `homelab.io/role=light:NoSchedule`; las
  etiquetas y taints se declaran en `hosts.yml` (`k3s_node_labels` /
  `k3s_node_taints`) y las aplica el rol `k3s`.
- La versión de k3s fijada está en
  `ansible/inventory/production/group_vars/all.yml` (`v1.37.2+k3s1`). El README
  puede estar desfasado; manda `group_vars`.

## Gotchas verificados (no los "arregles")

- `sshd` aplica la **primera** directiva: el drop-in propio debe ser
  `/etc/ssh/sshd_config.d/00-homelab.conf`; con `99-...` pierde frente a
  `50-cloud-init.conf` (`PasswordAuthentication yes`).
- `/boot/firmware` es FAT: `backup: true` en Ansible falla por nombres con `@`
  y `~`. Se usa una copia `config.txt.orig`.
- `rpi-eeprom-update` sale con 1 si hay actualización; hay que ejecutar
  `rpi-eeprom-update -a` y reiniciar.
- cgroups: comprueba `cat /sys/fs/cgroup/cgroup.controllers` (debe incluir
  `memory`), no `/proc/cgroups`. El fix vive en `cmdline.txt`.
- Swap/zram debe seguir desactivado (`Mechanism=none` en `rpi-swap`); kubelet
  no arranca con swap.
- journald es volátil: los logs no sobreviven al reinicio. No busques causas en
  logs anteriores a un reboot.
- `.local` depende de avahi. Si el proceso aparece como `cluster0-N.local`, hay
  conflicto de nombre: revisa `/etc/avahi/hosts` en todos los nodos por
  entradas estáticas que reclamen la misma IP.
- UFW permite puertos del cluster solo desde `192.168.1.0/24`; un cambio de
  puerto en k3s exige actualizar `ansible/roles/common/tasks/main.yml`.
- Argo CD: los CRDs grandes fallan con `kubectl apply` normal; reinstalar con
  `kubectl apply --server-side --force-conflicts`.
- AdGuard Home escucha la UI en el puerto **80** del pod (se eligió en el
  asistente). Probes, `containerPort` y Service deben apuntar a 80; si apuntan
  a 3000 el pod nunca queda `Ready` y el DNS se queda sin endpoints.
- AdGuard está fijado a cluster0 (`nodeSelector`) porque el Service usa
  `externalTrafficPolicy: Local`: si el pod cae en cluster1, ServiceLB no
  anuncia `192.168.1.100:53`. Sus dos PVC son `local-path` de cluster0.
- El rol `pi` ya aplica el fix de cgroups y desactiva swap/zram (antes se
  hacía a mano). Sigue siendo obligatorio reiniciar tras la Fase 0.
- Al reconstruir cluster0 (server), el agente de cluster1 conserva token y CA
  viejos: ejecutar `/usr/local/bin/k3s-agent-uninstall.sh` en cluster1 y volver
  a lanzar la Fase 1.
- Windows prefiere los DNS IPv6 que anuncia el router. Si `home.arpa` no
  resuelve en el portátil pero `nslookup x.homelab.home.arpa 192.168.1.100`
  responde, el problema es el cliente: añade una regla NRPT
  (`Add-DnsClientNrptRule -Namespace '.homelab.home.arpa' -NameServers
  192.168.1.100`) o desactiva el DNS IPv6 del DHCP. WSL2 hereda el resolver de
  Windows.
- Observabilidad (`namespace observability`): `node-exporter` no tiene
  `/-/healthy` (probes a `/` y TCP); la salud de `kube-state-metrics` está en
  `:8080/healthz`, no en telemetría; Grafana usa rootfs de solo lectura con
  `GF_PLUGINS_PREINSTALL_DISABLED=true`. Prometheus scrapea la IP del nodo, así
  que UFW abre `9100` y `10250` desde `cluster_cidr`/`service_cidr`.
- Homepage con `readOnlyRootFilesystem: true` necesita montar **todos** los
  ficheros de `/app/src/skeleton` (`settings`, `services`, `widgets`,
  `bookmarks`, `kubernetes`, `docker`, `proxmox`, `custom.css`, `custom.js`);
  si falta uno, el contenedor muere con `EROFS: read-only file system`. También
  valida la cabecera `Host` (`HOMEPAGE_ALLOWED_HOSTS`): incluye el host del
  Ingress **y** `$(MY_POD_IP):3000` para las probes. Los montajes `subPath` no
  se refrescan en caliente: al tocar `config.yaml` actualiza la anotación
  `homelab.io/config-hash` del Deployment (`sha256sum` del fichero).
- Cloudflare Tunnel (`namespace cloudflared`): el token va en el Secret
  `cloudflared-token` (clave `token`; la *variable* sí se llama
  `TUNNEL_TOKEN`), **nunca** en los `args` del
  Deployment: esos están en Git y el token acabaría commiteado. La probe buena
  es `/ready` en `:2000` — proceso vivo no implica túnel registrado, y un TCP
  check deja pasar pods "sanos" con el sitio caído. El token no se refresca en
  caliente: tras cambiarlo, `rollout restart`. Todas las public hostnames
  apuntan a `http://traefik.kube-system.svc.cluster.local:80`, así que el
  enrutado sigue viviendo en los `Ingress`. El dashboard **no** acepta
  wildcards en public hostnames.

## Estado y convenciones

- Fases 0, 1 y 2 completadas: k3s `v1.37.2+k3s1` (flannel, Traefik, ServiceLB,
  local-path) y Argo CD `v3.6.1` sincronizando `kubernetes/apps/whoami`.
- Fase 3 desplegada: AdGuard Home `v0.107.80` en `kubernetes/apps/adguard`
  (namespace `adguard`), DNS en `192.168.1.100:53` vía ServiceLB y UI en
  `adguard.homelab.home.arpa`. La UI escucha en el puerto **80** del pod.
- Fase 5 parcial: Prometheus + Grafana + `node-exporter` +
  `kube-state-metrics` en `kubernetes/apps/observability` (namespace
  `observability`); dashboards `Homelab - Cluster` y `Homelab - Workloads` en
  `grafana.homelab.home.arpa` (admin por defecto `admin`/`admin`, acceso
  anónimo de solo lectura). Cada dashboard es **una clave** del ConfigMap
  `grafana-dashboard-homelab`: el proveedor `file` lee el directorio montado y
  no hace falta reiniciar Grafana. Ver `docs/fase-5.md`.
- Panel de inicio: Homepage `v2.8.0` en `kubernetes/apps/homepage` (namespace
  `homepage`), en `homepage.homelab.home.arpa`; enlaza Argo CD, Grafana,
  Prometheus, AdGuard y el portfolio.
- Fase 6 en curso: Cloudflare Tunnel desplegado (`kubernetes/apps/cloudflared`,
  2 réplicas) y conectado al borde, con el dominio `dbarroso.dev`. Los `Ingress`
  ya declaran el host público junto al interno (`lab`, `whoami`, `grafana`,
  `prometheus`, `argocd`) y la raíz sirve el portfolio. Falta crear los public
  hostnames en el dashboard. Sin cert-manager: el TLS público lo termina
  Cloudflare. Ver `docs/fase-6.md`.
- Portfolio: `kubernetes/apps/portfolio` (namespace `portfolio`, 3 réplicas de
  `nginx-unprivileged`). La imagen la construye el repo del sitio
  (`dbarrosourr/dbarrosourr.github.io`) en GitHub Actions y se publica en
  `ghcr.io/dbarrosourr/cv-portfolio:sha-<commit>`; el tag se sube a mano en el
  Deployment. El paquete de GHCR debe ser **público** o el kubelet no puede
  hacer pull.
- Kubeconfig local en `~/.kube/homelab.yaml`; `kubectl` en `~/.local/bin`.
- `kubernetes/` existe; `scripts/` sigue siendo planificado.
- Argo CD lee el repo con la deploy key del Secret `repo-homelab` (namespace
  `argocd`); la clave privada no está en Git.
- Remoto `origin` por SSH: `git@github.com:byMagg/homelab-infrastructure.git`.
- Nunca commitees kubeconfig, claves ni secretos (ver `.gitignore`).
- No edites archivos gestionados por Ansible directamente en los nodos:
  cambia rol/plantilla y vuelve a aplicar el playbook.
