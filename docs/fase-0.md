# Fase 0 — Base y hardening

Fecha: 2026-11-17
Nodos: cluster0 (192.168.1.100), cluster1 (192.168.1.101)
SO: Raspberry Pi OS Lite 64-bit (Trixie), kernel 6.18.50

## Objetivo

Dejar los dos nodos con una base reproducible, segura y con el menor desgaste
posible de la tarjeta SD antes de instalar Kubernetes.

## Cambios aplicados

| Área | Cambio |
|---|---|
| Paquetes | `curl`, `jq`, `htop`, `iotop`, `iftop`, `tmux`, `rsync`, `rclone`, `ufw`, `fail2ban`, `python3-systemd`, `unattended-upgrades`, `mmc-utils`, `sysstat`, `nftables` |
| Hora | `Europe/Madrid`, `systemd-timesyncd` activo |
| Swap | `rpi-swap` en `Mechanism=none`; zram y `/var/swap` (2 GB) eliminados |
| journald | `Storage=volatile`, límite 64 MB en `/run` |
| Coredumps | `Storage=none` |
| Kernel | `vm.swappiness=1`, `kernel.panic=10`, `ip_forward=1`, `br_netfilter`, `overlay`, inotify ampliado |
| SSH | solo clave, sin root, `MaxAuthTries 3`, `AllowUsers ansible admin` |
| Firewall | UFW: deny incoming, allow outgoing/routed, puertos del cluster solo desde `192.168.1.0/24` |
| fail2ban | jail `sshd`, `ignoreip` para la LAN |
| Actualizaciones | `unattended-upgrades` sin reinicio automático |
| Firmware | `gpu_mem=16`, audio off, VC4 off, watchdog on, WiFi/BT off |
| Watchdog | `RuntimeWatchdogSec=15s`, `/dev/watchdog` presente |
| EEPROM | actualizada a `1793402435` (30 oct 2026) |

## Gotchas encontrados

1. **cgroup memory deshabilitado por firmware.** El kernel recibe
   `cgroup_disable=memory`; el fix es añadir al final de
   `/boot/firmware/cmdline.txt`:
   ```
   cgroup_enable=memory cgroup_memory=1
   ```
   La comprobación válida es `cat /sys/fs/cgroup/cgroup.controllers`.

2. **`50-cloud-init.conf` gana a `99-homelab.conf`.** En `sshd` se aplica la
   primera directiva encontrada, y el drop-in de cloud-init se lee antes. El
   drop-in propio debe llamarse `00-homelab.conf` para tener prioridad.

3. **FAT no acepta el nombre de backup de Ansible.** `lineinfile` con
   `backup: true` genera nombres con `@` y `~`, inválidos en
   `/boot/firmware`. Se sustituye por una copia manual `config.txt.orig`.

4. **`rpi-eeprom-update` devuelve 1 si hay actualización.** No es un error:
   hay que ejecutar `rpi-eeprom-update -a` y reiniciar.

5. **`rpi-swap` usa zram + archivo.** En Trixie el mecanismo por defecto es
   `zram+file`, con un `/var/swap` de 2 GB en la SD. `Mechanism=none` lo
   elimina y libera espacio.

6. **Entradas estáticas de avahi secuestran IPs.** cluster1 tenía en
   `/etc/avahi/hosts` restos de pruebas anteriores:
   `192.168.1.100 whoami.local`, `192.168.1.102 zz-offline.local` y
   `192.168.1.115 zz-control.local`. Al anunciar la IP de cluster0 como
   `whoami.local`, avahi en cluster0 detectaba un conflicto cada 20 s y se
   renombraba a `cluster0-N.local`, así que `cluster0.local` no resolvía. Se
   eliminaron las entradas y se reinició avahi en ambos nodos. Comprobación:
   `ps -o args= -C avahi-daemon` debe mostrar `cluster0.local`, no
   `cluster0-47.local`.

## Verificación

```bash
sudo sshd -T | grep -E '^(passwordauthentication|permitrootlogin|allowusers)'
sudo ufw status verbose
sudo fail2ban-client status sshd
cat /proc/swaps
cat /sys/fs/cgroup/cgroup.controllers
vcgencmd get_throttled
ls -l /dev/watchdog
sudo journalctl --disk-usage
sudo rpi-eeprom-update
```

Resultado: sin swap, `memory` en cgroups, UFW y fail2ban activos, watchdog
presente, EEPROM al día, sin throttling y journald en RAM.
