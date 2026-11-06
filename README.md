# homelab-infrastructure

Primera fase de infraestructura como código para `cluster0` (Raspberry Pi 5, servidor K3s y NVMe) y `cluster1` (Raspberry Pi 4, futuro agente K3s y DNS doméstico AdGuard Home). K3s todavía no se instala; la versión prevista es `v1.37.2+k3s1` y se revisará antes de desplegarla. El almacenamiento NVMe y el arranque real se comprobarán en una fase posterior.

## Preparación del equipo de control

Ejecuta Ansible desde Debian/Ubuntu en WSL o Linux, con Python compatible con ansible-core 2.22, SSH y acceso a ambos nodos. Desde la raíz del repositorio:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
ansible-galaxy install -r ansible/requirements.yml
```

El inventario usa `cluster0.local` y `cluster1.local` por defecto. Indica los usuarios reales y, si hace falta, las direcciones reales en tu sesión; los valores son ejemplos:

```bash
export CLUSTER0_HOST=192.0.2.10 CLUSTER0_USER=usuario0
export CLUSTER1_HOST=192.0.2.11 CLUSTER1_USER=usuario1
```

Utiliza un agente SSH o configura `IdentityFile`, puerto y opciones por host en `~/.ssh/config`; también puedes pasar `--private-key` a Ansible. Verifica las huellas SSH por un canal fiable. No guardes claves, contraseñas ni tokens en Git. El inventario admite ajustes por host; los secretos futuros deben almacenarse fuera del repositorio o cifrados con Ansible Vault, con su contraseña fuera de Git.

## Paso 1: diagnóstico de solo lectura

```bash
ansible-inventory --graph
ansible-playbook ansible/playbooks/preflight.yml
```

La conexión confirma acceso SSH y el diagnóstico muestra el usuario efectivo, SO, arquitectura y estado de la unidad `AdGuardHome`, además de puertos en escucha. Si AdGuard está en un contenedor o usa otro nombre de unidad, comprueba su estado y una consulta DNS real por separado; un puerto abierto por sí solo no demuestra que el servicio funcione. Comparte los resultados y revisa que las cuentas y ARM64 sean correctos. Ningún playbook de cambios debe ejecutarse antes de esa revisión y de la aprobación explícita del usuario.

## Paso 2: revisión y ejecución controlada

Una vez aprobados los cambios concretos, empieza por un solo nodo y revisa el modo de comprobación. Este modo es una previsión, no garantiza que todos los módulos puedan simularse:

```bash
ansible-playbook ansible/playbooks/bootstrap.yml --limit cluster0 --check --diff -e confirm_node_changes=true
ansible-playbook ansible/playbooks/bootstrap.yml --limit cluster0 -e confirm_node_changes=true
ansible-playbook ansible/playbooks/k3s.yml --limit cluster0 --check --diff -e confirm_node_changes=true
ansible-playbook ansible/playbooks/updates.yml --limit cluster0 --check --diff -e confirm_node_changes=true
```

Los playbooks de cambios requieren la variable de confirmación y procesan un nodo a la vez. Los tres excluyen el grupo `dns_nodes`: preparar o actualizar `cluster1` requiere diseñar y aprobar primero una alternativa DNS y una ventana de mantenimiento. Ningún playbook programa reinicios. Los paquetes del sistema los selecciona APT según los repositorios configurados; solo las herramientas de control y la versión prevista de K3s están fijadas, no las versiones de cada paquete APT.

El rol `security` mantiene el endurecimiento SSH desactivado por defecto. Antes de habilitar `security_ssh_hardening_enabled` y `security_ssh_key_verified`, comprueba la clave, los accesos de todos los administradores y la configuración efectiva de SSH; mantén una sesión de recuperación. El rol `k3s` instala únicamente dependencias básicas: quedan pendientes la configuración del sistema, la instalación y unión del agente, y la evaluación del impacto en DNS.

## Validación local y CI

```bash
ansible-lint
ansible-playbook ansible/playbooks/preflight.yml --syntax-check
ansible-playbook ansible/playbooks/bootstrap.yml --syntax-check
ansible-playbook ansible/playbooks/updates.yml --syntax-check
ansible-playbook ansible/playbooks/k3s.yml --syntax-check
```

GitHub Actions ejecuta `ansible-lint` en cada push y pull request. El flujo se activará cuando el repositorio se suba a GitHub. Antes de publicar, revisa `git status` y que no haya secretos ni inventarios privados preparados para commit.

## Claves SSH administradas con Ansible

Genera una clave Ed25519 en tu equipo y añade únicamente el contenido del archivo
`.pub` a `ansible/inventory/group_vars/raspberry.yml`. Puedes incluir una segunda
clave pública para recuperación y guardar su parte privada cifrada fuera del portátil.
Para retirar una clave administrada, cambia su estado a `absent`.
El playbook conserva las demás claves que ya tenga la cuenta.

Con la huella SSH verificada y registrada en el entorno que ejecutará Ansible,
usa la contraseña de la cuenta en la primera ejecución. Desde WSL:

```bash
export CLUSTER1_HOST=192.168.1.100
ansible-playbook ansible/playbooks/preflight.yml --limit cluster1 --ask-pass
ansible-playbook ansible/playbooks/ssh-access.yml --limit cluster1 --ask-pass --check --diff
```

Después de revisar la vista previa y recibir aprobación, ejecuta:

```bash
ansible-playbook ansible/playbooks/ssh-access.yml --limit cluster1 --ask-pass -e confirm_node_changes=true
```

Comprueba el acceso con la nueva clave en una segunda sesión antes de retirar
la anterior. En futuras ejecuciones puedes omitir `--ask-pass` si la clave ya funciona.
La protección de `cluster1` en los playbooks de mantenimiento sigue vigente.
