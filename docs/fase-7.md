# Fase 7 — Backup y recuperación (DR)

Fecha: 2026-11-22
Estado: **completado** (2026-11-22): copia diaria local, réplica en R2
(`homelab/k3s`, 14 días), credenciales selladas y restauración probada.
Nodo: `cluster0` (único server, datastore **SQLite/kine**)
RPO: 24 h · RTO esperado: < 15 min

## Por qué no se usa `etcd-snapshot`

`cluster0` se instaló sin `--cluster-init`, así que k3s guarda el estado en
SQLite a través de kine. En este modo **no hay etcd gestionado** y los comandos
`k3s etcd-snapshot` fallan con:

```
FATA[0000] Error: see server log for details: etcd datastore disabled
```

Por eso las flags `--etcd-s3` y el flujo de `docs/fase-6.md` no aplican. El
backup correcto para SQLite es una copia consistente de:

- `/var/lib/rancher/k3s/server/db/state.db` (API de backup de SQLite, no `cp`)
- `/var/lib/rancher/k3s/server/token` (cifra los datos de bootstrap)
- `/var/lib/rancher/k3s/server/{tls,cred,manifests}` (CA y credenciales; con
  SQLite **no** se reconstruyen desde el datastore en un nodo nuevo)
- `/etc/rancher/k3s/` (config y kubeconfig del server)

## Diseño

```
systemd timer (diario 03:15, cluster0)
        │
        ▼
k3s-datastore-backup
   ├─ sqlite3 .backup  ──►  state.db consistente
   ├─ tar.gz(state.db + token + tls/cred/manifests + etc/)
   ├─ retención local (4 copias = 4 días)
   ├─ rclone ──► Cloudflare R2 (14 días)
   └─ k3s_backup.prom ──► node-exporter ──► alerta K3sBackupStale
                    ▲
                    └─ credenciales en el Secret `kube-system/r2-backup`,
                       creado desde un SealedSecret
```

| Pieza | Decisión | Motivo |
|---|---|---|
| Herramienta | `python3` (stdlib `sqlite3`) + `rclone` | Ya están en el nodo; sin imágenes ni CronJob |
| Consistencia | API `.backup` de SQLite | `cp state.db` con WAL activo puede dar una copia rota |
| Programación | timer systemd diario (03:15) | Independiente del plano de control |
| Destino | local + R2 | RPO 24 h con copia fuera del nodo |
| Credenciales | SealedSecret en `kube-system` | Nada de claves en Git ni en `/etc` |
| Retención | 4 locales / 14 días en R2 | ~11 MB en la SD y ~28 objetos |
| Alcance | estado de k3s | PVCs y datos de apps quedan fuera (ver limitaciones) |

El script lee el Secret en cada ejecución, así que **activar R2 no requiere
tocar el nodo ni reiniciar k3s**: en cuanto exista `kube-system/r2-backup`,
la siguiente copia se sube.

## Implementación

```bash
ansible-playbook ansible/playbooks/phase7.yml
ansible-playbook ansible/playbooks/verify.yml
```

El rol `backup` instala `rclone` y `sqlite3`, deja los scripts en
`/usr/local/sbin/` y activa `k3s-backup.timer`. Vars ajustables en
`ansible/roles/backup/defaults/main.yml` (y en
`ansible/inventory/production/group_vars/all.yml`).

Ficheros:

| Ruta | Papel |
|---|---|
| `/usr/local/sbin/k3s-datastore-backup` | Crea y sube la copia |
| `/usr/local/sbin/k3s-datastore-restore` | Restaura una copia (pide `--yes`) |
| `/etc/systemd/system/k3s-backup.{service,timer}` | Programación |
| `/var/backups/k3s/` | Copias locales (`root:root 0700`) |

## Verificación local

```bash
systemctl list-timers k3s-backup.timer
systemctl status k3s-backup.service
journalctl -t k3s-backup -n 20 --no-pager
sudo ls -lh /var/backups/k3s/
```

Prueba manual (no espera al timer):

```bash
sudo /usr/local/sbin/k3s-datastore-backup
```

El journal debe mostrar `copia local creada` y, si R2 está configurado,
`subida a R2 correcta`. Si aún no lo está, mostrará `solo copia local`.

Métrica que consume la regla `K3sBackupStale` de la fase 5:

```bash
sudo cat /var/lib/node-exporter/textfile/k3s_backup.prom
# k3s_backup_last_success_timestamp_seconds <epoch>
# k3s_backup_last_size_bytes <bytes>
curl -s 'http://prometheus.homelab.home.arpa/api/v1/query?query=k3s_backup_last_success_timestamp_seconds'
```

## Cloudflare R2

Estado actual: bucket **`homelab`**, prefijo `k3s`, endpoint
`https://e76f2108757fbc18ff2385dc14c2dedf.r2.cloudflarestorage.com`, region
`auto`. Token limitado a ese bucket con *Object Read & Write*. Las credenciales
viven en el SealedSecret `kube-system/r2-backup`.

### 1. Bucket

*R2 → Create bucket*. Bucket `homelab`, ubicación automática, **privado** (sin
dominio público ni acceso público). El plan gratuito incluye 10 GB; con ~3 MB
por copia y 28 objetos sobra de largo.

### 2. Token de API

*R2 → Manage R2 API Tokens → Create API Token*:

- Permisos: **Object Read & Write**.
- Limitar al bucket `homelab` (evita que un token filtrado toque otros buckets).
- Guardar el **Access Key ID** y el **Secret Access Key** (solo se muestran una
  vez). No son los API Tokens de *My Profile*.

El endpoint S3 es
`https://e76f2108757fbc18ff2385dc14c2dedf.r2.cloudflarestorage.com`.

### 3. Secret en el cluster

```bash
kubectl -n kube-system create secret generic r2-backup \
  --from-literal=endpoint='https://e76f2108757fbc18ff2385dc14c2dedf.r2.cloudflarestorage.com' \
  --from-literal=region='auto' \
  --from-literal=bucket='homelab' \
  --from-literal=folder='k3s' \
  --from-literal=access_key='<ACCESS_KEY_ID>' \
  --from-literal=secret_key='<SECRET_ACCESS_KEY>'
```

Claves que lee el script: `endpoint`, `region`, `bucket`, `folder`,
`access_key`, `secret_key`. La región de R2 es `auto`; el endpoint lleva
`https://` (rclone, no el SDK de k3s).

### 4. Sellado

```bash
kubectl -n kube-system get secret r2-backup -o yaml \
  | kubeseal --controller-namespace sealed-secrets \
  > kubernetes/apps/k3s-backup/sealedsecret.yaml

# El controller NO adopta un Secret creado a mano: hay que borrarlo.
kubectl -n kube-system delete secret r2-backup
```

El `SealedSecret` está en `kubernetes/apps/k3s-backup/sealedsecret.yaml` y la
Application en `kubernetes/argocd/k3s-backup-app.yaml` (namespace
`kube-system`). Argo recrea el Secret y el siguiente backup sube a R2. Si el
cluster se reconstruye, hay que aplicar antes el SealedSecret (o esperar a
Argo), porque sin él el script solo guarda copias locales.

### 5. Comprobar en R2

```bash
# En el nodo, leyendo las credenciales del Secret:
sudo journalctl -t k3s-backup -n 5 --no-pager
# Debe terminar en: subida a R2 correcta: r2:homelab/k3s/k3s-state-...tar.gz
```

También se puede mirar el bucket en el dashboard. Objeto verificado el
2026-11-22: `k3s-state-20261121T235118Z.tar.gz` + su `.sha256`.

> **rclone 1.60.1 (Debian Trixie)**: sube bien a R2 pero el HEAD posterior
> devuelve `501 NotImplemented` y rclone reintenta. Por eso los `copyto` usan
> `--s3-no-head`. No actualices rclone desde un `.deb` de terceros sin motivo.

## Drill de restauración

Objetivo: demostrar que un backup restaura el estado y que lo creado después
del backup desaparece. Se hace sobre `cluster0`, en ventana de mantenimiento
(~2–5 min de caída).

```bash
# 1. Copia fresca y marca posterior: el marker NO debe estar en el backup.
sudo /usr/local/sbin/k3s-datastore-backup
kubectl create configmap drill-marker --from-literal=ts="$(date -u +%s)"

# 2. Restaurar la copia más reciente (parar k3s, swap de state.db, arrancar).
ARCHIVE=$(sudo ls -1t /var/backups/k3s/k3s-state-*.tar.gz | head -1)
sudo /usr/local/sbin/k3s-datastore-restore "$ARCHIVE" --yes

# 3. El marker debe haber desaparecido y el cluster debe volver a estar sano.
kubectl get configmap drill-marker   # NotFound esperado
kubectl get nodes
kubectl -n argocd get applications
sudo rm -rf /var/lib/rancher/k3s/server/db.pre-restore-*
```

El script aparta el datastore anterior en
`/var/lib/rancher/k3s/server/db.pre-restore-<fecha>` y conserva el token del
backup. Argo CD re-sincroniza cualquier deriva posterior al snapshot; el tag
del portfolio puede revertir al de Git hasta que Image Updater lo corrija.

### Resultado (2026-11-22)

- Copia `k3s-state-20261121T233429Z.tar.gz` (2,9 MB): `sha256` correcto y
  `pragma integrity_check` = `ok`; el token del archivo coincide con el del
  nodo.- `drill-marker` se creó **después** del backup y desapareció tras restaurar
  (`NotFound`), lo que demuestra que el estado volvió al punto del snapshot.
- k3s estuvo parado entre las 00:34:36 y las 00:34:54 CET: **18 s de caída**.
  Los 3 nodos quedaron `Ready` y las 8 Applications de Argo
  `Synced/Healthy`.
- El datastore anterior (`db.pre-restore-*`) se borró tras comprobar el
  cluster.

### Restaurar en un nodo nuevo

1. Flashear y ejecutar `bootstrap.yml` y `phase0.yml` como siempre.
2. `phase1.yml` instala k3s y `phase7.yml` deja los scripts.
3. Copiar el archivo **y su `.sha256`** a `/var/backups/k3s/` (desde R2 o desde
   el portátil).
4. `sudo /usr/local/sbin/k3s-datastore-restore <archivo> --yes --new-host`.
   El script restaura también el token, `tls`, `cred` y `manifests` antiguos;
   sin ellos k3s generaría una CA nueva y los agentes dejarían de confiar.
5. Mantener la misma IP (`192.168.1.100`): el certificado del API y las
   direcciones de los nodos están en el snapshot.
6. Los agentes que conserven el token antiguo vuelven solos. Si se
   reflashearon, volver a lanzar `phase1.yml` (el rol lee el token restaurado
   del server). Borrar los `Node` viejos que ya no existan:

   ```bash
   kubectl get nodes
   kubectl delete node <nodo-viejo>
   ```

## Restauración manual (si el script no está disponible)

```bash
sudo systemctl stop k3s
sudo mv /var/lib/rancher/k3s/server/db /var/lib/rancher/k3s/server/db.old
sudo mkdir -p /var/lib/rancher/k3s/server/db
sudo tar -xzf k3s-state-....tar.gz -C /tmp
sudo install -m 600 /tmp/state.db /var/lib/rancher/k3s/server/db/state.db
sudo install -m 600 /tmp/token /var/lib/rancher/k3s/server/token
sudo systemctl start k3s
```

No copies a mano `state.db` con k3s arrancado: el WAL puede dejarla
inconsistente.

## Qué NO cubre

| Dato | Dónde vive | Cómo se protege |
|---|---|---|
| PVC de AdGuard (reglas, listas) | `local-path` de cluster0 | **Pendiente (fase 7b)**: no está en `state.db` |
| PVC de Grafana / Prometheus | `local-path` | Dashboards están en Git; métricas son desechables |
| Imágenes de contenedor | GHCR / Docker Hub | Reconstruibles; el portfolio se publica desde su repo |
| Config de los nodos | Ansible | Se reaplica con Fase 0/1 |
| Clave de Sealed Secrets | Secret del cluster + copia en `~/.config/homelab/` | Va dentro de `state.db`; mantén además la copia en el gestor de contraseñas |
| Token de Cloudflare / R2 | Secrets del cluster | Van dentro de `state.db`; el bucket debe ser privado |
| Token del server k3s | `server/token` | Va dentro del backup y hay que guardarlo también fuera |

**Seguridad:** `k3s secrets-encrypt status` está en `Disabled`, así que
`state.db` contiene los Secrets en claro (CA, clave de Sealed Secrets, tokens
de Cloudflare y R2). El archivo va comprimido, no cifrado, y el bucket privado
más el cifrado en reposo de R2 son la única protección.

**Decisión (2026-11-22):** no se cifra el `.tar.gz` con `age`. Se asume el
riesgo porque la clave privada añade un punto de fallo (perderla deja todos los
backups inservibles) y el bucket es privado. Si se quiere cerrar el hueco, la
opción sigue siendo `age` con la clave pública en Git y la privada en el gestor
de contraseñas.

## Rollback

```bash
systemctl disable --now k3s-backup.timer
rm -f /etc/systemd/system/k3s-backup.{service,timer}
rm -f /usr/local/sbin/k3s-datastore-{backup,restore}
systemctl daemon-reload
rm -rf /var/backups/k3s
```

Quitar el rol `backup` de la fase 7 y borrar la Application `k3s-backup` si se
había creado. Los backups ya subidos a R2 se borran desde el dashboard.

## Gotchas

- **SQLite, no etcd**: `k3s etcd-snapshot` no sirve en este cluster. No lo
  "arregles" añadiendo `--cluster-init` sin una migración planificada.
- **WAL**: copiar `state.db` con `cp` mientras k3s corre puede producir una
  base corrupta. Usa siempre la API `.backup`.
- **El token es obligatorio**: sin el token original, los datos de bootstrap no
  se descifran. El backup lo incluye; guárdalo también en el gestor de
  contraseñas.
- **Nodo nuevo**: con SQLite hay que restaurar `server/tls` y `server/cred`
  (`--new-host`). Si solo se copia `state.db`, k3s genera una CA nueva y los
  agentes con el token viejo fallan.
- **El Secret manda**: si `kube-system/r2-backup` no existe, el script no falla:
  deja la copia local y sale con 0. Revisa el journal si esperabas subida.
- **R2**: endpoint con `https://`, región `auto`, token limitado al bucket y
  `no_check_bucket` (el script lo activa). Un token sin permiso de listar
  buckets falla si rclone intenta comprobarlo.
- **Retención**: `--min-age 14d` borra el `.tar.gz` y su `.sha256`; no mezcla
  carpetas de distintos clusters.
- **SD**: 4 copias locales ~11 MB. No subas la retención local sin motivo. La
  copia diaria es suficiente porque el estado valioso cambia poco (GitOps);
  las copias cada 6 h solo añadían objetos efímeros. Si haces un cambio
  sensible, lanza `k3s-datastore-backup` a mano.
- **Un backup no es un drill**: el valor está en restaurar, no en acumular
  archivos. Repite el drill tras cambiar de versión de k3s.
