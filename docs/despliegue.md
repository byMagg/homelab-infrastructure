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

### Las seis Applications

Cada fichero `kubernetes/argocd/*-app.yaml` declara **una** app y la carpeta
que vigila. Desde 2026-11-21 las gestiona la Application raíz `homelab-root`
(app-of-apps); se crearon a mano durante la Fase 2.

| Application | Vigila | Namespace |
|---|---|---|
| `adguard` | `kubernetes/apps/adguard` | `adguard` |
| `cloudflared` | `kubernetes/apps/cloudflared` | `cloudflared` |
| `homepage` | `kubernetes/apps/homepage` | `homepage` |
| `observability` | `kubernetes/apps/observability` | `observability` |
| `portfolio` | `kubernetes/apps/portfolio` | `portfolio` |
| `sealed-secrets` | `kubernetes/apps/sealed-secrets` | `sealed-secrets` |

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
| Mergear el PR del tag del portfolio | Cada release | El build ocurre en otro repo; el PR se abre solo |
| `repo-homelab` (deploy key de Argo) | Solo al reconstruir Argo | Argo lo necesita para leer el repo |
| Public hostnames en Cloudflare | Al añadir host | Sin provider de Terraform; activos raíz, `lab`, `grafana`, `argocd`. Prometheus no se publica por decisión |

## Integración continua

Dos workflows en `.github/workflows/`, ambos de solo lectura sobre el cluster:

| Workflow | Cuándo | Qué hace |
|---|---|---|
| `ansible.yml` | PR o push a `main` que toque `ansible/` | `ansible-lint` (perfil `basic`) y `ansible-playbook --syntax-check`; no se conecta a los nodos |
| `portfolio-tag.yml` | diario (06:00 UTC) o manual | Lee los tags de GHCR y abre un PR con el más reciente |

`ansible.yml` usa `ansible-core==2.22.0` y `ansible-lint==26.11.0`, e instala
`community.general` en `ansible/collections`. El mismo lint se reproduce en
local con:

```bash
.venv/bin/ansible-lint
```

`portfolio-tag.yml` no usa Image Updater ni Renovate: los tags son
`sha-<commit>` (no ordenables) y el manifiesto es YAML plano, así que ninguno
encaja sin migrar a Kustomize. El script `scripts/update-portfolio-tag.py`
compara fechas de creación en el registro y propone el cambio como PR; el merge
sigue siendo manual.

## Huecos conocidos

| # | Hueco | Estado |
|---|---|---|
| 1 | App-of-apps | **Resuelto**: `kubernetes/argocd/root-app.yaml` (`homelab-root`) |
| 2 | Tag de imagen manual | **Resuelto**: `portfolio-tag.yml` abre un PR diario |
| 3 | Sin webhook | Abierto: hasta ~3 min de polling; opcional |
| 4 | Sin CI en Ansible | **Resuelto**: `ansible.yml` (lint + sintaxis) |

Lo que **no** conviene automatizar: aplicar Ansible desde el cluster. Añade un
punto único de fallo justo cuando la infraestructura está rota.

## Verificación y diagnóstico

```bash
# Estado de las seis apps
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
