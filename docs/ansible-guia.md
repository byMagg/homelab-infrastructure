# Guía de Ansible para este repo

Para quien llega nuevo: **no hay que leer 1.100 líneas**. Hay que entender una
tarea y saber que las demás son iguales.

Todo el Ansible del repo (sin contar `ansible/collections/`, que es código de
terceros) son unas **1.100 líneas**: 819 de YAML y 257 de plantillas. El resto
es YAML repetido con la misma forma.

## Modelo mental: cuatro piezas

Piensa en un libro de cocina:

| Pieza | Ruta | Qué es | Analogía |
|---|---|---|---|
| **Inventario** | `ansible/inventory/production/hosts.yml` | A qué máquinas se aplica | La lista de comensales |
| **Rol** | `ansible/roles/<rol>/tasks/main.yml` | Qué se hace | La receta |
| **Playbook** | `ansible/playbooks/*.yml` | A quién y en qué orden | El menú |
| **Plantilla** | `ansible/roles/<rol>/templates/*.j2` | Ficheros de config con huecos | Ingredientes con cantidades |

Accesorios:

- **`handlers/`** — acciones que solo se ejecutan si algo cambió (reiniciar un
  servicio). Si nada cambia, no se ejecutan.
- **Variables** — `inventory/.../group_vars/all.yml` (globales) y `vars:` /
  `defaults:` dentro de cada rol (locales).

El flujo completo:

```
playbook  →  hosts: k3s_cluster  →  roles: [common, pi]
                    │                        │
            hosts.yml (3 IPs)        tasks/main.yml (30 pasos)
```

## Mapa del repo

| Ruta | Líneas | Léelo | Qué hace |
|---|---|---|---|
| `ansible/playbooks/phase1.yml` | 7 | **Sí, primero** | Instala k3s |
| `ansible/playbooks/phase0.yml` | 8 | Sí | Hardening base + ajustes de Pi |
| `ansible/playbooks/verify.yml` | 7 | Sí | Comprueba el estado real |
| `ansible/playbooks/phase7.yml` | 7 | Cuando toque | Backups del datastore |
| `ansible/playbooks/bootstrap.yml` | 49 | Solo al flashear | Crea el usuario `ansible` |
| `ansible/inventory/.../hosts.yml` | 27 | Sí | Nodos, IPs y grupos |
| `ansible/inventory/.../group_vars/all.yml` | 27 | Sí | Versión de k3s, dominio, CIDRs |
| `ansible/roles/k3s/tasks/main.yml` | 79 | **Sí** | Instala server y agents |
| `ansible/roles/pi/tasks/main.yml` | 95 | Cuando toque | cgroups, swap, watchdog, EEPROM |
| `ansible/roles/verify/tasks/main.yml` | 132 | Cuando toque | Asserts de Fase 0 |
| `ansible/roles/common/tasks/main.yml` | 265 | Por partes | Paquetes, SSH, UFW, fail2ban, journald |
| `ansible/roles/backup/tasks/main.yml` | 81 | Cuando toque | Timer y scripts de backup SQLite |
| `ansible/roles/*/templates/*.j2` | 3-119 | Cuando toque | Config con `{{ variables }}` |
| `ansible/roles/*/handlers/main.yml` | 4-20 | Cuando toque | Reinicios condicionados |
| `ansible/collections/` | miles | **Nunca** | Módulos de terceros (en `.gitignore`) |

## Anatomía de una tarea

El 90% del repo es este bloque, repetido:

```yaml
- name: Instalar paquetes base      # descripción legible
  ansible.builtin.apt:              # el MÓDULO (la herramienta)
    name: [curl, jq, ufw]           # argumentos del módulo
    state: present                  # el ESTADO deseado
  tags: [base]                      # etiqueta para ejecutar por partes
```

Solo hay tres cosas que entender:

1. **Módulo** — `apt`, `copy`, `template`, `service`, `lineinfile`, `command`,
   `ufw`… Describe *qué* lograr, no *cómo*.
2. **Argumentos** — los datos que necesita el módulo.
3. **Estado** — `present`/`absent`, `started`/`stopped`, `enabled: true`.

Los módulos usados en este repo son pocos:

| Módulo | Para qué |
|---|---|
| `apt` | Paquetes |
| `template` / `copy` | Ficheros de configuración |
| `lineinfile` / `blockinfile` | Tocar una línea de un fichero existente |
| `systemd` | Servicios |
| `command` | Ejecutar algo sin idempotencia automática |
| `ufw` (`community.general`) | Cortafuegos |
| `assert` / `debug` | Verificar y mostrar |

### Idempotencia

Un módulo declara el **estado final**. Si ya se cumple, Ansible no hace nada
(`ok`/`changed: false`). Por eso puedes ejecutar un playbook mil veces sin
romper nada. `command` es la excepción: no sabe si ya se hizo, así que se le
añade `creates:` (por ejemplo `creates: /usr/local/bin/k3s`).

### `become`

`become: true` significa "ejecuta con `sudo`". En `ansible.cfg` está activado
por defecto, así que las tareas van como root. Verás `become: true` en los
playbooks porque es explícito, no porque haga falta repetirlo.

## Tags: ejecutar por partes

`phase0.yml` no se lanza de golpe en la práctica. Se usan etiquetas:

| Tag | Qué toca |
|---|---|
| `base` | Paquetes, hora, /etc/hosts |
| `sd` | journald en RAM, coredumps |
| `sysctl` | Módulos y parámetros del kernel |
| `unattended` | Actualizaciones automáticas |
| `ssh` | Hardening de `sshd` |
| `firewall` | UFW |
| `fail2ban` | Jail de SSH |
| `pi` | cgroups, swap, watchdog, EEPROM |

Orden obligatorio de la Fase 0: `base,sd,sysctl,unattended` →
`ssh,firewall,fail2ban` → `pi` → **reiniciar** → `verify`.

## Cómo leer un rol (ejemplo: `k3s`)

1. Mira el `playbook` que lo llama: `phase1.yml`, `hosts: k3s_cluster`.
2. Abre `roles/k3s/tasks/main.yml` de arriba abajo. Son 79 líneas y van en
   orden: descargar el instalador, instalarlo como **server** solo en
   `k3s_server`, esperar la API, leer el token, instalarlo como **agent** solo
   en `k3s_agents`, y aplicar etiquetas/taints.
3. Los `when:` son la única lógica: `when: inventory_hostname in
   groups['k3s_server']` significa "solo en cluster0".

## Comandos seguros (no cambian nada)

```bash
ansible all -m ping                     # conectividad
ansible-inventory --graph              # ver grupos y hosts
.venv/bin/ansible-lint                 # mismas reglas que el CI (no toca nodos)
ansible-playbook ansible/playbooks/phase0.yml --syntax-check
ansible-playbook ansible/playbooks/phase0.yml --list-tasks
ansible-playbook ansible/playbooks/phase0.yml --list-tags
ansible-playbook ansible/playbooks/phase1.yml --list-hosts
```

## Simular antes de aplicar

```bash
ansible-playbook ansible/playbooks/phase0.yml \
  --check --diff --limit cluster2 --tags base
```

- `--check` → simula; no aplica.
- `--diff` → muestra qué líneas cambiarían.
- `--limit cluster2` → solo al nodo de 2 GB.
- `--tags base` → solo un bloque.

Quitar `--check` para aplicar de verdad. Ojo: `--check` no es fiable en tareas
`command` que dependen de ejecuciones anteriores.

## Detalles del entorno

- Ansible está en el sistema (`/usr/bin/ansible`) y también en `.venv/`
  (`ansible-core` 2.22.0). `ansible.cfg` usa rutas relativas: **ejecuta siempre
  desde la raíz del repo**.
- `make` no está instalado en el WSL; el `Makefile` existe como atajo, pero usa
  `.venv/bin/ansible-playbook` directamente.
- `community.general` (módulo `ufw`) vive en `ansible/collections`, que está
  ignorado por Git. Si falta:
  `.venv/bin/ansible-galaxy collection install community.general -p ansible/collections`
- No cambies `stdout_callback` a `yaml`: no existe en ansible-core 2.22. Ya
  está configurado como `default` + `result_format = yaml`.

## Errores típicos al empezar

| Síntoma | Causa habitual |
|---|---|
| `UNREACHABLE` | Nodo apagado, IP cambiada o falta la clave SSH |
| `Permission denied (publickey)` | Estás usando `admin` en vez de `ansible` |
| `sudo: a password is required` | El usuario no tiene NOPASSWD; revisa `bootstrap.yml` |
| `MODULE FAILURE` en `ufw` | Falta `community.general` en `ansible/collections` |
| Un cambio no se aplica | Falta el `handler` o el servicio no se reinició |
| `changed: false` y esperabas cambios | La tarea es idempotente: ya estaba así |

## Plan de 30 minutos

1. Lee `playbooks/phase1.yml` (7 líneas) e `inventory/.../hosts.yml`.
2. Lee `roles/k3s/tasks/main.yml` entero, sin prisa.
3. Ejecuta `--list-tasks` y `--check --limit cluster2 --tags base`.
4. Cuando algo no cuadre, pregunta por **esa tarea concreta**.

El objetivo no es entender las 1.100 líneas: es entender **una tarea** y saber
que las demás son iguales.

## Glosario

| Término | Significado |
|---|---|
| **Playbook** | Fichero que dice a qué hosts se aplica qué rol |
| **Rol** | Carpeta con tareas, plantillas, handlers y variables |
| **Tarea** | Una llamada a un módulo con un estado deseado |
| **Handler** | Tarea que solo corre si otra cambió algo |
| **Inventario** | Lista de hosts y grupos |
| **Fact** | Dato del nodo que Ansible recoge (`ansible_architecture`, etc.) |
| **Tag** | Etiqueta para ejecutar solo una parte |
| **Idempotente** | Ejecutarlo dos veces da el mismo resultado que una |
| **Agentless** | No instala nada en el nodo: usa SSH |
