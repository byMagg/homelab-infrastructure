# Fase 3 — AdGuard Home en el cluster

Fecha: 2026-11-17
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
| Persistencia | 2 PVC `local-path`: `adguard-work` (1Gi) y `adguard-conf` (128Mi) |
| DNS | Service `adguard-dns` tipo `LoadBalancer`, puerto 53 UDP/TCP |
| UI | Service `adguard-web` + Ingress `adguard.homelab.home.arpa` |
| Upstream | Router `192.168.1.1` o DNS público, configurado en el asistente |
| DHCP | Desactivado; sigue en el router |

Se usan dos PVC porque montar el padre `/opt/adguardhome` ocultaría el binario
de la imagen. `work` guarda estadísticas y listas; `conf` el
`AdGuardHome.yaml`.

ServiceLB publica el DNS en `192.168.1.100` y `192.168.1.101`. El puerto 53
estaba libre en ambos nodos (`systemd-resolved` inactivo) y UFW ya lo permitía
desde `192.168.1.0/24`.

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

5. **No se ha cambiado el DNS de la LAN.** El router sigue entregando su DNS;
   AdGuard solo se ha probado de forma directa.

## Siguientes pasos

1. En AdGuard: **Filters → DNS rewrites** →
   `*.homelab.home.arpa` → `192.168.1.100`, para eliminar los `hosts`.
2. Apuntar el DHCP del router a `192.168.1.100` como DNS primario, dejando el
   router o `1.1.1.1` como secundario para no quedarse sin DNS si el cluster
   está apagado.
3. Cuando haya TLS, quitar `--insecure` de Argo y servir los paneles por HTTPS.
