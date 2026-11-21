# ADR-001 — Ansible en lugar de Terraform para aprovisionar los nodos

- **Estado:** aceptada
- **Fecha:** 2026-11-21
- **Decisores:** maintainer del homelab
- **Relacionado:** `docs/fase-0.md`, `docs/fase-1.md`, `docs/despliegue.md`

## Contexto

La infraestructura son tres Raspberry Pi 4 físicas (`cluster0`, `cluster1`,
`cluster2`) en la LAN de casa, con Raspberry Pi OS Lite 64-bit y k3s. No hay
hipervisor, ni BMC, ni API de cloud: el hardware se compra, se flashea con
Raspberry Pi Imager y se conecta a la red. A partir de ahí todo el trabajo es
**configurar máquinas que ya existen**: paquetes, kernel, firewall, SSH, swap,
cgroups y la instalación de k3s.

Se plantea si Terraform debería sustituir a Ansible.

## Decisión

Se usa **Ansible** para los nodos. Terraform **no** se adopta en esta fase.

La capa declarativa del cluster no la cubre Ansible, sino **Argo CD** (GitOps),
que ya reconcilia `kubernetes/apps/` de forma continua.

| Capa | Herramienta | Motivo |
|---|---|---|
| Hardware y red física | Manual | Una vez por nodo; no hay API |
| Nodos (SO, kernel, k3s) | **Ansible** | Configuración de hosts existentes por SSH |
| Cluster (apps, Ingress, secretos) | **Argo CD** | Estado declarativo con reconciliación continua |

## Motivos

1. **No hay recursos que crear.** Terraform gestiona el ciclo de vida de
   recursos a través de una API (VMs, buckets, DNS). Aquí no existe ese
   endpoint: el "recurso" es una Raspberry que ya está encendida.
2. **SSH es el único canal disponible.** Ansible es agentless y usa SSH por
   defecto. Terraform sobre bare metal acabaría usando `null_resource` +
   `remote-exec`, que es Ansible con peor ergonomía y sin idempotencia real.
3. **El trabajo es convergencia, no creación.** Aplicar `cmdline.txt`,
   reiniciar, comprobar `cgroup.controllers` y repetir es un flujo de
   convergencia con verificación (`verify.yml`). Terraform no tiene un
   equivalente útil para "comprobar el estado efectivo del kernel".
4. **Raspberry Pi OS rompe la declaratividad pura.** El firmware inyecta
   `cgroup_disable=memory`, `/boot/firmware` es FAT (backups de Ansible
   fallan), `rpi-eeprom-update` devuelve 1 cuando hay actualización y el
   reinicio es obligatorio. Son parches procedimentales y ordenados: encajan
   en tareas Ansible, no en un grafo de recursos.
5. **Evitar una tercera capa declarativa.** Con Ansible (nodos) y Argo CD
   (cluster) ya hay dos fuentes de verdad con dueños claros. Añadir
   `terraform.tfstate` obliga a versionarlo, bloquearlo y protegerlo, sin
   resolver nada que no esté resuelto.
6. **Coste/beneficio para portfolio.** Terraform demuestra más valor
   aprovisionando cloud real que simulando bare metal con providers
   comunitarios.

## Consecuencias

**Positivas**

- Un solo mecanismo (SSH + Ansible) para todo el ciclo de vida del nodo.
- Idempotencia y verificación por tags, con ejecución parcial segura.
- Sin estado remoto ni bloqueo que mantener.
- El mismo rol sirve para reconstruir un nodo desde cero.

**Negativas**

- El despliegue de nodos es **manual** (se lanza desde el portátil). Se acepta
  a cambio de control sobre cambios peligrosos (kernel, firewall, SSH).
- No hay historial nativo de "quién aplicó qué y cuándo" en los nodos; se
  suple con Git y la disciplina de commits.

## Cuándo se revisaría

Terraform (o OpenTofu) pasaría a tener sentido si:

- se añade un hipervisor (Proxmox) o VMs en cloud para el cluster;
- se gestionan recursos con API: DNS y túneles de Cloudflare, buckets R2 del
  backup de la Fase 7;
- el número de nodos crece hasta hacer inviable el inventario manual.

En ese escenario el reparto canónico sería: **Terraform crea**, **Ansible
configura**, **Argo CD despliega**.

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Terraform + `remote-exec` | Reinventa Ansible sin idempotencia; el estado no refleja la realidad del SO |
| Terraform provider de k3s | Duplicaría lo que Argo CD ya reconcilia |
| NixOS / imagen inmutable | Cambio de SO y mucha curva; no aporta a esta fase |
| Scripts de shell ad hoc | Sin idempotencia, sin inventario, sin ejecución selectiva |
