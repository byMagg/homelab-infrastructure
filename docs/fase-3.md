# Fase 3 — AdGuard Home en el cluster

Fecha: 2026-11-17
Estado: completada 2026-11-21 (DNS de la LAN apuntando a AdGuard)
Imagen: `adguard/adguardhome:v0.107.80`
Namespace: `adguard`
UI: `http://adguard.homelab.home.arpa`
DNS: `192.168.1.100:53` (UDP/TCP) vía ServiceLB

## Objetivo

Sustituir el AdGuard Home que corría en el Pi de 2 GB por una instancia
gestionada por Argo CD, con persistencia y sin tocar todavía el DNS de la LAN.

## Diseño

| Pieza | Decisión |
|---|---|
| Réplicas | 1, estrategia `Recreate` (hay un solo escritor de configuración) |
| Nodo | `nodeSelector` a cluster0: `externalTrafficPolicy: Local` solo anuncia `.100` si el pod está allí |
| Persistencia | 2 PVC `local-path` de cluster0: `adguard-work` (1Gi) y `adguard-conf` (128Mi) |
| DNS | Service `adguard-dns` tipo `LoadBalancer`, puerto 53 UDP/TCP |
| UI | Service `adguard-web` + Ingress `adguard.homelab.home.arpa` |
| Upstream | Router `192.168.1.1` o DNS público, configurado en el asistente |
| DHCP | Desactivado; sigue en el router |

Se usan dos PVC porque montar el padre `/opt/adguardhome` ocultaría el binario
de la imagen. `work` guarda estadísticas y listas; `conf` el
`AdGuardHome.yaml`.

ServiceLB publica el DNS en la IP del nodo que ejecuta el pod. Con el
`nodeSelector` actual siempre es `192.168.1.100`. El puerto 53 estaba libre en
los nodos (`systemd-resolved` inactivo) y UFW ya lo permitía desde
`192.168.1.0/24`.

## Asistente inicial

En `http://adguard.homelab.home.arpa`:

- interfaz: **All interfaces**;
- puerto web: se dejó en **80**;
- puerto DNS: **53**;
- upstream: router;
- DHCP: desactivado;
- lista de bloqueo por defecto activada (≈190k reglas).

## Verificación

```bash
curl -I http://adguard.homelab.home.arpa        # 302 -> /login.html
nslookup example.com 192.168.1.100               # responde
```

Consulta directa y bloqueo:

```
example.com      -> 104.20.23.154, 172.66.147.243
doubleclick.net  -> 0.0.0.0
```

También responde desde Windows con `nslookup example.com 192.168.1.100`.

## Contraseña del panel

AdGuard Home v0.107 no ofrece cambio de contraseña en la UI: el usuario y su
hash bcrypt viven en `/opt/adguardhome/conf/AdGuardHome.yaml` (clave `users`).
La contraseña no está en Git; si hay que cambiarla, se edita el hash en el PVC
con AdGuard parado para que no sobrescriba el YAML al apagarse.

## Reinstalación con PVC nuevos

Si se recrean los PVC (por ejemplo, al reconstruir el cluster), AdGuard vuelve
al asistente en el puerto **3000**, pero los probes apuntan a 80 y kubelet lo
reinicia en bucle. Procedimiento:

1. Pausar el auto-sync de la Application y quitar los probes temporalmente:
   ```bash
   kubectl -n argocd patch application adguard --type merge \
     -p '{"spec":{"syncPolicy":{"automated":null}}}'
   kubectl -n adguard patch deploy adguard --type=json -p='[
     {"op":"remove","path":"/spec/template/spec/containers/0/livenessProbe"},
     {"op":"remove","path":"/spec/template/spec/containers/0/readinessProbe"}]'
   kubectl -n adguard port-forward deploy/adguard 3000:3000
   ```
2. Completar el asistente por API (la contraseña no se guarda en Git):
   ```bash
   curl -X POST http://127.0.0.1:3000/control/install/configure \
     -H 'Content-Type: application/json' -d '{
       "web":{"ip":"0.0.0.0","port":80,"status":"","can_autofix":false},
       "dns":{"ip":"0.0.0.0","port":53,"status":"","can_autofix":false},
       "username":"admin","password":"<password>"}'
   ```
3. Con AdGuard ya en el puerto 80, añadir la reescritura y reactivar Argo:
   ```bash
   kubectl -n adguard port-forward deploy/adguard 8080:80
   curl -u admin:<password> -X POST http://127.0.0.1:8080/control/rewrite/add \
     -H 'Content-Type: application/json' \
     -d '{"domain":"*.homelab.home.arpa","answer":"192.168.1.100"}'
   kubectl -n argocd patch application adguard --type merge \
     -p '{"spec":{"syncPolicy":{"automated":{"prune":true,"selfHeal":true}}}}'
   ```
   Argo vuelve a poner los probes en 80; el pod queda `Ready`.

## Gotchas

1. **El puerto web del asistente manda.** Se configuró en 80, pero los
   manifiestos apuntaban a 3000. El pod nunca quedaba `Ready`, ambos Services
   se quedaban sin endpoints y el DNS parecía caído aunque AdGuard estuviera
   escuchando. Al cambiar de puerto en la UI hay que actualizar
   `containerPort`, probes y Service.

2. **Los dos puertos del pod no son intercambiables.** El readiness probe
   usa HTTP en el puerto web; si apunta mal, kubelet reinicia el contenedor y
   se pierde el DNS. El liveness usa TCP para no depender de redirecciones.

3. **AdGuard necesita privilegios para el 53.** La imagen corre como root y
   enlaza `0.0.0.0:53`; no se le puede aplicar el `securityContext` restrictivo
   de `whoami` sin añadir `NET_BIND_SERVICE` y permisos de escritura.

4. **El Ingress es HTTP.** La sesión del panel viaja sin cifrar dentro de la
   LAN. Se resolverá cuando Traefik termine TLS con cert-manager.

5. **Windows prefiere el DNS IPv6 del router.** Mientras el router anunciaba
   resolvers públicos IPv6 (`2a0c:…`, `fe80::1`), Windows los consultaba antes
   que a AdGuard y `home.arpa` devolvía `NXDOMAIN` autoritativo. El arreglo
   temporal era una regla NRPT en el cliente (requiere administrador):

   ```powershell
   Add-DnsClientNrptRule -Namespace '.homelab.home.arpa' -NameServers 192.168.1.100
   Clear-DnsClientCache
   # revertir: Get-DnsClientNrptRule | Remove-DnsClientNrptRule -Force
   ```

   **Ya retirada** (2026-11-21): el router entrega `192.168.1.100` también en
   IPv6, así que Windows y WSL2 resuelven sin reglas locales.

6. **El DNS de la LAN ya apunta a AdGuard.** El router entrega
   `192.168.1.100` como DNS primario, IPv4 e IPv6; AdGuard es el resolver real
   de la LAN y no solo una prueba directa.

## Siguientes pasos

Hecho la reescritura `*.homelab.home.arpa` → `192.168.1.100` en AdGuard
(**Filters → DNS rewrites**); los `hosts` ya no son necesarios.

Completado:

1. ~~Apuntar el DHCP del router a `192.168.1.100` como DNS primario, **también
   en IPv6** (o desactivar el anuncio de DNS IPv6), dejando el router o
   `1.1.1.1` como secundario.~~ *(hecho 2026-11-21)*
2. ~~Quitar la regla NRPT de los clientes Windows cuando el router ya entregue
   AdGuard.~~ *(hecho 2026-11-21)*

Pendiente:

3. Cuando haya TLS, quitar `--insecure` de Argo y servir los paneles por HTTPS.
