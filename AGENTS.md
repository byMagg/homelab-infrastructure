# AGENTS.md

Repo de infraestructura (no hay código de aplicación): Ansible para los nodos y,
más adelante, manifiestos en `kubernetes/`. README y docs están en español;
mantén ese idioma en prosa, docs y nombres de tareas Ansible.

## Comandos

Ejecuta siempre desde la raíz del repo: `ansible.cfg` usa rutas relativas
(`roles_path`, `inventory`, `collections_path`).

```bash
.venv/bin/ansible all -m ping
.venv/bin/ansible-playbook ansible/playbooks/phase0.yml --tags base,sd,sysctl,unattended
.venv/bin/ansible-playbook ansible/playbooks/phase0.yml --tags ssh,firewall,fail2ban
.venv/bin/ansible-playbook ansible/playbooks/phase0.yml --tags pi
.venv/bin/ansible-playbook ansible/playbooks/verify.yml
```

- **`make` no está instalado en el WSL del usuario**: el `Makefile` existe, pero
  usa los comandos `.venv/bin/...` directamente.
- Las colecciones viven en `ansible/collections` (ignorado por git). Si falta
  `community.general` (módulo `ufw`):
  `.venv/bin/ansible-galaxy collection install community.general -p ansible/collections`
- `stdout_callback = yaml` no existe en ansible-core 2.22; ya está configurado
  como `default` + `result_format = yaml`. No lo cambies.

## Orden de la Fase 0

`base,sd,sysctl,unattended` → `ssh,firewall,fail2ban` → `pi` → **reiniciar** →
`verify`. El reinicio es obligatorio: aplica EEPROM/config.txt, watchdog y
journald en RAM. No ejecutes `firewall`/`ssh` a la vez que `base` sin motivo.

## Inventario y acceso

- Automatización siempre como `ansible` (NOPASSWD sudo). `admin` es solo
  interactivo y **no** tiene sudo sin contraseña.
- Jerarquía: `k3s_cluster` → `k3s_server` (cluster0) / `k3s_agents` (cluster1).
- `cluster2` está comentado en `ansible/inventory/production/hosts.yml` hasta
  que llegue su SD; para añadirlo, descomenta y ejecuta la Fase 0.
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
  puerto en k3s/Cilium exige actualizar `ansible/roles/common/tasks/main.yml`.

## Estado y convenciones

- Fase 0 completada; k3s **no** está instalado todavía (Fase 1 pendiente).
- `kubernetes/` y `scripts/` del README son planificados, aún no existen.
- No hay remoto git: los commits son locales.
- Nunca commitees kubeconfig, claves ni secretos (ver `.gitignore`).
- No edites archivos gestionados por Ansible directamente en los nodos:
  cambia rol/plantilla y vuelve a aplicar el playbook.
