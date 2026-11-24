# Actualizaciones: qué es automático y qué no

Hay cuatro relojes distintos en el homelab. Tres son automáticos:

| Qué | Cuándo | Cómo | ¿Reinicio? |
|---|---|---|---|
| Parches de seguridad de Debian | Diario, de madrugada | `unattended-upgrades` | No automático |
| EEPROM / firmware | Al aplicar `--tags pi` | Ansible | Sí |
| k3s (binario y charts empaquetados) | Manual | instalador de k3s | Sí, uno a uno |
| Manifiestos de Kubernetes | ~3 min tras `git push` | Argo CD | Rollout automático |
| Imágenes de las apps | PR semanal | Renovate (merge manual) | Rollout automático |
| Tag del portfolio | ~2 min tras el build | Image Updater | Rollout automático |
| Argo CD | Manual | reaplicar manifiesto upstream | Sí |
| Backup del datastore | Diario a las 03:15 | `k3s-backup.timer` | No |

Lo que **no** existe: auto-merge de Renovate, auto-upgrade de k3s,
auto-reboot, salto de versión mayor de Debian ni actualización automática de
Argo CD.

## 1. Nodos: `unattended-upgrades`

Configurado por el tag `unattended` del rol `common`
(`ansible/roles/common/tasks/main.yml`):

- `unattended-20auto-upgrades.j2` activa la actualización diaria de listas y la
  instalación de upgrades; `AutocleanInterval` es de 7 días.
- `unattended-99-homelab.j2` desactiva el reinicio automático, borra kernels y
  dependencias viejas y apaga el log a syslog.
- Corre con los timers de APT (`apt-daily.timer` / `apt-daily-upgrade.timer`):
  **una vez al día, de madrugada y con retardo aleatorio**.
- La política de orígenes sigue siendo la del sistema
  (`/etc/apt/apt.conf.d/50unattended-upgrades`, no la gestiona Ansible): por
  defecto **solo el origen de seguridad de Debian**. El repo `raspberrypi`
  (kernel y firmware) y el firmware de la EEPROM **no** entran por aquí.

Un kernel nuevo se instala pero **no se activa hasta reiniciar**. Comprobación:

```bash
cat /var/run/reboot-required 2>/dev/null
cat /var/run/reboot-required.pkgs 2>/dev/null
uname -r
dpkg -l 'linux-image-*' | awk '/^ii/{print $2}'
tail -20 /var/log/unattended-upgrades/unattended-upgrades.log
```

Ritmo recomendado: **reiniciar una vez al mes** (o cuando toque un kernel de
seguridad). Recuerda que journald es volátil: tras reiniciar no hay logs
anteriores.

### EEPROM

El rol `pi` comprueba `rpi-eeprom-update` y aplica `rpi-eeprom-update -a` si hay
`UPDATE AVAILABLE`, pero solo **cuando lanzas el playbook**:

```bash
ansible-playbook ansible/playbooks/phase0.yml --tags pi
```

Si aplica algo, hay que reiniciar. No hay timer para esto.

## 2. Upgrade de k3s (manual)

Restricciones del cluster que mandan en el procedimiento:

- **Un solo server** (`cluster0`) con datastore **SQLite/kine**, sin HA. Su
  reinicio deja la API y el DNS (AdGuard vía ServiceLB, `externalTrafficPolicy:
  Local`) caídos **~1 minuto**.
- **No drenes `cluster0`**: AdGuard tiene `nodeSelector` a ese nodo y sus dos
  PVC, igual que los de Prometheus y Grafana, son `local-path`. Si lo drenas,
  esos pods no pueden reprogramarse, AdGuard se queda sin endpoints y el DNS
  de toda la casa cae.
- Los agentes (`cluster1`, `cluster2`) sí se pueden drenar: el portfolio tiene
  3 réplicas y `maxUnavailable: 1`.
- Kubernetes admite un kubelet hasta 3 minor por detrás del API server, pero
  **sube un minor por vez** (1.37 → 1.38 → 1.39), no de golpe.
- El rol `k3s` **no actualiza**: el instalador usa `creates:
  /usr/local/bin/k3s`, así que reejecutar `phase1.yml` con otra versión no hace
  nada. El upgrade se lanza a mano con el instalador oficial; después Ansible
  reconcilia etiquetas, taints y unidades.

### 2.1. Preparación

Elige una ventana sin cambios pendientes y con el repo al día. No lo hagas
justo antes de las 03:15 (backup) ni mientras Argo esté sincronizando.

```bash
cd ~/workspaces/homelab-infrastructure
git pull
kubectl get nodes -o wide
kubectl get pods -A --field-selector=status.phase!=Running
kubectl -n argocd get applications
kubectl get pv -o wide      # confirma en qué nodo vive cada PVC local-path
```

Fuerza un backup justo antes (y comprueba que está):

```bash
ansible cluster0 -b -m command -a /usr/local/sbin/k3s-datastore-backup
ansible cluster0 -b -m shell -a 'ls -lh /var/backups/k3s | tail -3'
```

Apunta la versión actual y el archivo de backup: son el punto de vuelta.

```bash
ansible cluster0 -b -m shell -a '/usr/local/bin/k3s --version'
```

Lee las notas de la release de k3s antes de seguir (cambios en Traefik,
ServiceLB o local-path van dentro del binario y se actualizan con él).

### 2.2. Fijar la versión nueva

Edita `ansible/inventory/production/group_vars/all.yml`:

```yaml
k3s_version: v1.38.x+k3s1
```

No cambies nada más. La versión de `group_vars` manda sobre el README y AGENTS.

### 2.3. Servidor (`cluster0`)

El instalador actualiza en sitio y reinicia el servicio. `INSTALL_K3S_EXEC`
**debe repetir exactamente** el flag con el que se instaló, o la unidad de
systemd pierde `--tls-san`:

```bash
ssh ansible@192.168.1.100
sudo -i
curl -sfL https://get.k3s.io | \
  INSTALL_K3S_VERSION=v1.38.x+k3s1 \
  INSTALL_K3S_EXEC="server --tls-san 192.168.1.100" sh -
```

Espera a que vuelva (~1 min). Comprueba:

```bash
/usr/local/bin/k3s --version
systemctl cat k3s | grep ExecStart      # debe conservar --tls-san
systemctl status k3s --no-pager
kubectl get nodes
```

Durante el reinicio es normal que Argo CD marque las apps `Unknown` unos
segundos, que Cloudflare Tunnel reconecte y que el DNS tenga un hueco. No
toques nada hasta que `kubectl get nodes` responda.

### 2.4. Agentes (`cluster1`, después `cluster2`)

Uno a uno, nunca los dos a la vez. Primero comprueba dónde están las réplicas:

```bash
kubectl -n portfolio get pods -o wide
kubectl get pv -o wide
```

Drena el nodo:

```bash
kubectl drain cluster1 --ignore-daemonsets --delete-emptydir-data --timeout=5m
```

Si se queda colgado, hay un pod con PVC `local-path` en ese nodo o un PDB
bloqueando la expulsión: mira `kubectl get pvc -A` y `kubectl get pdb -A`. **No
uses `--force`**; resuelve la causa.

El token solo lo necesita el instalador para unirse al server; léelo de
`cluster0` y pásalo en el entorno (no lo dejes en el historial):

```bash
TOKEN=$(ssh ansible@192.168.1.100 'sudo cat /var/lib/rancher/k3s/server/node-token')
ansible cluster1 -b -m shell -a "curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION=v1.38.x+k3s1 K3S_URL=https://192.168.1.100:6443 K3S_TOKEN=$TOKEN sh -"
unset TOKEN
```

Devuelve el nodo al servicio y espera:

```bash
kubectl get nodes -o wide
kubectl uncordon cluster1
kubectl -n portfolio get pods -o wide
```

Repite con `cluster2`. Al terminar, reaplica Ansible para reconciliar
etiquetas, taints y el estado esperado (el instalador no vuelve a correr por el
`creates`, así que es seguro):

```bash
ansible-playbook ansible/playbooks/phase1.yml
ansible-playbook ansible/playbooks/verify.yml
```

### 2.5. Verificación

```bash
kubectl get nodes -o wide                       # misma versión en los tres
kubectl get pods -A | grep -vE 'Running|Completed'
kubectl -n argocd get applications              # todo Synced/Healthy
systemctl list-timers k3s-backup.timer          # sigue programado
nslookup adguard.homelab.home.arpa 192.168.1.100
nslookup dbarroso.dev 192.168.1.100
curl -fsS https://dbarroso.dev/live/healthz
```

Y en `cluster0`, comprueba que no quedó un reinicio pendiente de la fase 0:

```bash
[ -f /var/run/reboot-required ] && cat /var/run/reboot-required.pkgs
```

### 2.6. Si sale mal: vuelta atrás

k3s **no soporta downgrade** del datastore entre versiones con migraciones de
esquema. La vuelta atrás es reinstalar el binario antiguo y restaurar el backup
tomado en 2.1. Se pierde lo que haya cambiado desde ese backup.

En `cluster0`:

```bash
sudo systemctl stop k3s
curl -sfL https://get.k3s.io | \
  INSTALL_K3S_VERSION=v1.37.2+k3s1 \
  INSTALL_K3S_SKIP_START=true \
  INSTALL_K3S_EXEC="server --tls-san 192.168.1.100" sh -
sudo /usr/local/sbin/k3s-datastore-restore \
  /var/backups/k3s/k3s-state-<FECHA>.tar.gz --yes
```

`k3s-datastore-restore` conserva el datastore anterior en
`db.pre-restore-<fecha>` y arranca k3s al final. No borres esa copia hasta
validar el cluster.

En los agentes: drenar, instalar la versión antigua con el mismo comando de
2.4, `uncordon`. Después devuelve `k3s_version` en `group_vars` a la versión
que quedó instalada.

## 3. Aplicaciones: Argo CD

- Cualquier push a `main` que toque `kubernetes/apps/**` se aplica solo:
  polling cada **~3 min**, `automated + prune + selfHeal`.
- Un `kubectl edit` a mano se revierte en el siguiente ciclo. El estado deseado
  es Git, no el cluster.
- Las imágenes están **pineadas en Git**. Renovate abre un PR con el tag nuevo
  (`kubernetes/apps/<app>/*.yaml`); al fusionarlo, Argo despliega.
- Excepción: el **portfolio**. `argocd-image-updater` mira GHCR cada ~2 min y
  parchea `spec.source.kustomize.images` de la Application. Ese tag vive en el
  cluster y el app-of-apps lo ignora (`ignoreDifferences`). No lo edites a mano.
- **Argo CD** no se autogestiona: se instaló con el manifiesto de
  `docs/fase-2.md`. Para actualizarlo, reaplica el `install.yaml` del tag nuevo
  con `kubectl apply --server-side --force-conflicts` (los CRDs grandes fallan
  con `apply` normal).
- `sealed-secrets` y `kubeseal` deben ir **a la par**: si subes el controller,
  sube también la versión de `kubeseal` que uses en el portátil.

## 4. Imágenes: Renovate (PR semanal)

Desde 2026-11-24 el repo tiene:

- `renovate.json`: qué vigila y con qué política.
- `.github/workflows/renovate.yml`: lunes a las 04:00 UTC (05:00/06:00 en
  Madrid) y `workflow_dispatch` para lanzarlo a mano.

Renovate **no despliega nada**: abre PRs contra `main`. Al fusionarlos, Argo CD
hace el rollout en ~3 min. No hay auto-merge.

### Qué cubre

- Todos los `image:` de `kubernetes/apps/**` (AdGuard, cloudflared, Homepage,
  Prometheus, Grafana, Alertmanager, kube-state-metrics, node-exporter,
  sealed-secrets y el `node:22-alpine` del observatorio).
- `k3s_version` en `ansible/inventory/production/group_vars/all.yml`.

### Qué no cubre (a propósito)

| Qué | Por qué |
|---|---|
| `kubernetes/apps/portfolio/**` | Lo gobierna Image Updater (ver abajo) |
| `kubernetes/apps/image-updater/**` | La imagen y los CRD son una unidad; se suben juntos a mano |
| Versión de Argo CD | Solo está en la documentación; se instala con el manifiesto upstream |
| Acciones de GitHub | Con `GITHUB_TOKEN` no se pueden modificar workflows; son dos y se suben a mano |
| Ejecutar el upgrade de k3s | Renovate solo cambia `group_vars`; el procedimiento es la sección 2 |

### Activación

1. Commitea `renovate.json` y `.github/workflows/renovate.yml`.
2. Elige autenticación:
   - **`GITHUB_TOKEN`** (por defecto): activa en *Settings → Actions → General*
     la opción *Allow GitHub Actions to create and approve pull requests*.
   - **PAT** (recomendado si quieres que los PRs disparen CI): crea un
     fine-grained token con `Contents: read/write`, `Pull requests: read/write`
     e `Issues: read/write`, y guárdalo como secret `RENOVATE_TOKEN`. El
     workflow lo usa si existe.
3. *Actions → renovate → Run workflow*. Entre los PRs debería aparecer, por
   ejemplo, `cloudflare/cloudflared 2026.11.1 → 2026.12.x`; si no está, mira el
   issue *Dependency Dashboard*.

La cadencia la marca el cron del workflow, no un `schedule` de Renovate: así
`workflow_dispatch` funciona cualquier día. Si algún día instalas la GitHub App
en lugar del workflow, añade `"schedule": ["before 8am on monday"]` al
`renovate.json` para que no abra PRs a diario.

Con `GITHUB_TOKEN`, los PRs que abre Renovate **no disparan otros workflows**
(es una restricción de GitHub para evitar recursión): el lint de Ansible no
correría en el PR de `k3s_version`. Con PAT o con la GitHub App sí.

### Avisos al revisar los PRs

1. **Arquitectura**: el cluster es `arm64`. Renovate no valida que el tag tenga
   manifiesto `linux/arm64`; uno sin esa plataforma acaba en
   `exec format error`. Los PRs de imagen van etiquetados `arm64`.
2. **Mayors**: Grafana 13 → 14 puede romper dashboards, AdGuard cambia la UI de
   puerto con facilidad (aquí escucha en el 80 del pod) y `sealed-secrets` debe
   subir a la par que `kubeseal`.
3. **k3s**: los tags son `v1.37.2+k3s1`. Renovate detecta los cambios de minor,
   pero las revisiones `+k3sN` del mismo minor pueden no ofrecerse porque el
   *build metadata* de semver no altera la precedencia. En ese caso, edita
   `k3s_version` a mano.
4. **Blast radius**: cada PR es una dependencia. Si algún día quieres
   auto-merge, que sea solo para `patch` y después de varios ciclos sin
   sorpresas; recuerda que fusionar = desplegar.

### ¿Y el portfolio?

No: ya está automatizado de punta a punta y mejor que con Renovate. El flujo es
build en GitHub Actions → GHCR → `argocd-image-updater` detecta el tag en ~2 min
→ parchea la Application → rollout. Sin PRs, sin latencia y sin ruido.

Si Renovate también mirase `kubernetes/apps/portfolio/**`, abriría un PR por
cada build del sitio (varios al día) y competiría con el tag que Image Updater
escribe en el cluster. Por eso está en `ignorePaths`.

Solo tendría sentido pasarlo a Renovate si quisieras revisar cada despliegue
del portfolio antes de publicarlo. En ese caso habría que quitar el recurso
`ImageUpdater` (`kubernetes/apps/image-updater/portfolio-imageupdater.yaml`),
sacar el portfolio de `ignorePaths` y añadir un manager para `newTag` de
`kustomization.yaml`. No lo recomiendo: se pierde el despliegue automático y
cada build genera un PR.

### Dependabot

No está configurado y no aporta: solo cubriría `github-actions` (que Renovate ya
toca), no entiende manifiestos de Kubernetes ni `group_vars`, y no hay
`requirements.txt` ni Dockerfile. Si algún día se añade código con dependencias
npm/pip, se puede activar en paralelo sin conflicto.

## 5. Calendario recomendado

| Tarea | Frecuencia |
|---|---|
| Revisar `unattended-upgrades` y reiniciar si hay kernel nuevo | Mensual |
| Revisar avisos de Alertmanager (backup, nodos, disco) | Continuo |
| Revisar y fusionar PRs de Renovate | Semanal |
| Subir k3s un minor | Cuando salga release estable, con ventana |
| Actualizar Argo CD | Cuando haya CVE o feature necesaria |
| Probar una restauración del backup | Tras cada cambio de versión de k3s |

## Ver también

- [`despliegue.md`](despliegue.md): Ansible vs Argo CD y política de sync.
- [`fase-7.md`](fase-7.md): backup, restauración y drill.
- [`ansible-guia.md`](ansible-guia.md): comandos seguros de Ansible.
