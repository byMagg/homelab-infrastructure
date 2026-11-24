# Cómo se automatiza el despliegue

Hay **dos despliegues distintos** en el repo, con niveles de automatización
diferentes. Confundirlos es la fuente principal de líos.

| | Nodos (SO, kernel, k3s) | Aplicaciones (pods, Ingress) |
|---|---|---|
| Herramienta | **Ansible** | **Argo CD** |
| Se dispara con | Tú, a mano desde el portátil | Solo, al hacer `git push` |
| Almacén de verdad | Git + inventario | Git (`kubernetes/apps/`) |
| Frecuencia | Rara | Cada cambio de manifiesto |
| Reversión | Reaplicar playbook | `git revert` |
| Estado | Los propios nodos | El cluster |

## Pipeline de aplicaciones: automático

```
editas kubernetes/apps/portfolio/deployment.yaml
        │
        └─ git commit && git push origin main
                    │
                    ▼
        Argo CD (namespace argocd) hace polling del repo cada ~3 min
                    │
                    ├─ compara Git (kubernetes/apps/<app>) vs cluster
                    │
                    ▼
        syncPolicy: automated + prune + selfHeal
                    │
                    └─ aplica el diff → rollout → pods nuevos
```

### Las diez Applications

Cada fichero `kubernetes/argocd/*-app.yaml` declara **una** app y la carpeta
que vigila. Desde 2026-11-21 las gestiona la Application raíz `homelab-root`
(app-of-apps); se crearon a mano durante la Fase 2.

| Application | Vigila | Namespace |
|---|---|---|
| `homelab-root` | `kubernetes/argocd` | `argocd` |
| `adguard` | `kubernetes/apps/adguard` | `adguard` |
| `cloudflared` | `kubernetes/apps/cloudflared` | `cloudflared` |
| `homepage` | `kubernetes/apps/homepage` | `homepage` |
| `image-updater` | `kubernetes/apps/image-updater` | `argocd` |
| `k3s-backup` | `kubernetes/apps/k3s-backup` | `kube-system` |
| `observability` | `kubernetes/apps/observability` | `observability` |
| `observatory` | `kubernetes/apps/observatory` | `observatory` |
| `portfolio` | `kubernetes/apps/portfolio` | `portfolio` |
| `sealed-secrets` | `kubernetes/apps/sealed-secrets` | `sealed-secrets` |

`homelab-root` es la raíz (app-of-apps); las otras nueve son hijas. La
Application `image-updater` vive en `argocd` porque vigila la Application
`portfolio`, no un namespace propio.

Todas usan la misma política:

```yaml
source:
  repoURL: git@github.com:byMagg/homelab-infrastructure.git
  targetRevision: main
  path: kubernetes/apps/<app>
syncPolicy:
  automated:
    prune: true      # borra en el cluster lo que ya no está en Git
    selfHeal: true   # revierte cambios hechos a mano (kubectl edit)
  syncOptions:
    - CreateNamespace=true
```

**`selfHeal` es la pieza clave:** Git es la única fuente de verdad. Si tocas un
Deployment con `kubectl edit`, Argo lo devuelve a lo declarado. Si borras un
objeto, lo recrea. Cada app es independiente: puedes romper una sin tocar las
demás.

### Ciclo completo de un cambio

```bash
# 1. Editar el manifiesto
vim kubernetes/apps/portfolio/deployment.yaml

# 2. Commit y push
git add -A && git commit -m "feat(portfolio): subir réplicas a 4"
git push origin main

# 3. Observar (o esperar ~3 min al polling)
kubectl -n argocd get applications

# 4. Forzar la comprobación sin esperar
kubectl -n argocd annotate app portfolio \
  argocd.argoproj.io/refresh=normal --overwrite

# 5. Ver el resultado
kubectl -n portfolio get pods -w
```

Para deshacer: `git revert <commit>` y push. Argo aplica el estado anterior.

### Añadir una app

1. Crear `kubernetes/apps/<nueva>/...` y `kubernetes/argocd/<nueva>-app.yaml`.
2. Commit y push. La Application raíz `homelab-root` detecta el fichero y crea
   la `Application` sola.

`homelab-root` es un **app-of-apps**: vigila `kubernetes/argocd/` y se aplicó a
mano una única vez (`kubectl apply -f kubernetes/argocd/root-app.yaml`), igual
que `repo-homelab`. Si se borra una Application hija, se recrea; si se quita un
`*-app.yaml` de Git, se elimina la Application (sus workloads quedan huérfanos,
porque las apps hijas no llevan finalizer de cascada).

## Pipeline de nodos: manual por diseño

No hay CI ni timers. Se lanza desde el WSL, que es donde está la clave SSH:

```bash
# Fase 0 por bloques (orden obligatorio)
ansible-playbook ansible/playbooks/phase0.yml --tags base,sd,sysctl,unattended
ansible-playbook ansible/playbooks/phase0.yml --tags ssh,firewall,fail2ban
ansible-playbook ansible/playbooks/phase0.yml --tags pi

# Reiniciar (obligatorio), y después verificar
ansible-playbook ansible/playbooks/verify.yml

# Fase 1
ansible-playbook ansible/playbooks/phase1.yml
```

`Makefile` ofrece atajos (`make base`, `make security`, `make pi`, `make
verify`), pero `make` no está instalado en el WSL.

### Por qué no está automatizado

Para configurar un nodo hacen falta SSH y `sudo` sobre ese nodo. Automatizarlo
requiere un runner que viva dentro del cluster… y si lo que está roto es un
nodo, el runner tampoco ayuda. Es el problema del huevo y la gallina. Además
los cambios tocan kernel, firewall y SSH: interesa verlos y controlar el
reinicio. Decisión registrada en
[`adr-001-ansible-en-lugar-de-terraform.md`](adr-001-ansible-en-lugar-de-terraform.md).

### Alta de un nodo nuevo

1. Flashear con Raspberry Pi Imager (usuario `admin`, clave del portátil).
2. `bootstrap.yml` como `admin`: crea el usuario `ansible` con NOPASSWD.
3. Añadir el nodo a `ansible/inventory/production/hosts.yml`.
4. Fase 0 completa + reinicio + `verify.yml`.
5. Fase 1 (si es nodo del cluster).
6. Si se reconstruye `cluster0`, el agente de `cluster1` conserva token y CA
   viejos: ejecutar `/usr/local/bin/k3s-agent-uninstall.sh` en `cluster1` y
   relanzar la Fase 1.

## Inventario de pasos manuales

Lo que **hoy** requiere intervención humana, y dónde está el motivo:

| Paso | Frecuencia | Motivo |
|---|---|---|
| Flash del SO | Por nodo | No hay API de hardware |
| `bootstrap.yml` | Por nodo | Necesita la contraseña de `admin` |
| Aplicar Fase 0/1 | Cuando cambia | Decisión: control sobre cambios peligrosos |
| Reinicio tras Fase 0 | Obligatorio | Aplica EEPROM, `config.txt`, watchdog |
| `repo-homelab` (deploy key de Argo) | Solo al reconstruir Argo | Argo lo necesita para leer el repo |
| Public hostnames en Cloudflare | Al añadir host | Sin provider de Terraform; activos raíz, `lab`, `grafana`, `argocd`. Prometheus no se publica por decisión |

## Integración continua

Un workflow en `.github/workflows/`; no toca el cluster:

| Workflow | Cuándo | Qué hace |
|---|---|---|
| `ansible.yml` | PR o push a `main` que toque `ansible/` | `ansible-lint` (perfil `basic`) y `ansible-playbook --syntax-check`; no se conecta a los nodos |

Usa `ansible-core==2.22.0` y `ansible-lint==26.11.0`, e instala
`community.general` en `ansible/collections`. El mismo lint se reproduce en
local con:

```bash
.venv/bin/ansible-lint
```

## Actualización automática del tag del portfolio

`argocd-image-updater` v1.5.0 (Application `image-updater`, namespace `argocd`)
vigila GHCR cada ~2 min y actualiza la Application `portfolio`. Sin PAT, sin
webhook y sin cron de GitHub:

- GHCR es público → lectura anónima.
- `kubernetes/apps/portfolio` es Kustomize (`kustomization.yaml` con `images:`).
- `writeBackConfig.method: argocd` parchea `spec.source.kustomize.images`; no
  commitea a Git, así que no hay credenciales que rotar.
- `newest-build` + `allowTags: ^sha-[0-9a-f]{7,40}$` porque los tags son hashes
  y no se ordenan por nombre.
- El app-of-apps ignora ese campo (`ignoreDifferences`) para que su `selfHeal`
  no revierta el tag.

El detalle y la verificación están en [`fase-6.md`](fase-6.md).

El resto de actualizaciones (parches del SO, k3s, Argo CD y las imágenes que no
son del portfolio) es manual y está en
[`actualizaciones.md`](actualizaciones.md).

## Huecos conocidos

| # | Hueco | Estado |
|---|---|---|
| 1 | App-of-apps | **Resuelto**: `kubernetes/argocd/root-app.yaml` (`homelab-root`) |
| 2 | Tag de imagen manual | **Resuelto**: `argocd-image-updater` actualiza el tag en el cluster, sin credenciales |
| 3 | Sin webhook | Abierto: hasta ~3 min de polling; opcional |
| 4 | Sin CI en Ansible | **Resuelto**: `ansible.yml` (lint + sintaxis) |

Lo que **no** conviene automatizar: aplicar Ansible desde el cluster. Añade un
punto único de fallo justo cuando la infraestructura está rota.

## Verificación y diagnóstico

```bash
# Estado de las Applications
kubectl -n argocd get applications

# Detalle de una app (sync, health, última transición)
kubectl -n argocd get app portfolio -o yaml | grep -A5 status

# Forzar reconciliación inmediata
kubectl -n argocd annotate app portfolio \
  argocd.argoproj.io/refresh=normal --overwrite

# Logs del controller
kubectl -n argocd logs deploy/argocd-application-controller --tail=50
```

Estados de `sync`: `Synced` (Git y cluster coinciden) frente a `OutOfSync`
(hay diferencias; con `automated` se corrigen solas). `health` describe el
estado real de los workloads: `Healthy`, `Progressing`, `Degraded`.

### Problemas frecuentes

| Síntoma | Causa y arreglo |
|---|---|
| `OutOfSync` que no se corrige | Manifiesto inválido o recurso con dueño distinto; mira el diff en la UI |
| App `Unknown` | El repo no se puede leer: revisa la deploy key `repo-homelab` |
| `ErrImagePull` / `401 Unauthorized` | Imagen privada en GHCR; el paquete debe ser público o usar `imagePullSecret` |
| Cambio en ConfigMap que no se refleja | Montaje `subPath` no se refresca: actualiza la anotación de hash y reinicia |
| `Secret` no se recrea tras cambiar el `SealedSecret` | El controller no adopta secrets creados a mano: bórralo y espera |
| Pod `Running` pero sitio caído | La probe es demasiado laxa; usa una que valide el servicio real (`/ready`) |

## Referencias

- [`ansible-guia.md`](ansible-guia.md) — modelo mental de Ansible y comandos seguros.
- [`adr-001-ansible-en-lugar-de-terraform.md`](adr-001-ansible-en-lugar-de-terraform.md) — por qué no Terraform.
- `AGENTS.md` — gotchas verificados del entorno.
