# Monitor externo del homelab

Fecha: 2026-11-22
Workflow: [`.github/workflows/uptime.yml`](../.github/workflows/uptime.yml)
Cadencia: cada 30 minutos

## Por qué

Prometheus, Alertmanager y ntfy viven **dentro** del cluster. Si se cae
cluster0, la red de casa o el túnel de Cloudflare, las alertas internas no
salen: el propio sistema que avisa es el que está roto.

El monitor externo corre en GitHub Actions, fuera del homelab. Comprueba los
endpoints públicos por HTTPS y, si no responden, abre un incidente y manda un
aviso a ntfy.

```
GitHub Actions (fuera de casa) ──HTTPS──► Cloudflare ──túnel──► cluster
        │
        ├─ ¿200 en /, /live/healthz, /live y lab?
        ├─ ¿certificado de dbarroso.dev > 14 días?
        │
        └─ fallo ──► issue "🚨 Homelab inaccesible" + ntfy (prioridad 5)
           ok    ──► cierra el issue + ntfy "✅ recuperado" (prioridad 3)
```

## Qué comprueba

| Comprobación | Qué detecta |
|---|---|
| `https://dbarroso.dev/` | Portfolio y entrada pública |
| `https://dbarroso.dev/live/healthz` | Observatorio y BFF |
| `https://dbarroso.dev/live/` | Estáticos y túnel completos |
| `https://lab.dbarroso.dev/` | Homepage |
| Certificado TLS de `dbarroso.dev` | Caducidad a menos de 14 días |

Cada URL se reintenta 3 veces (15 s de timeout y 5 s entre intentos) para no
confundir un fallo puntual con una caída. Si cualquiera falla, hay incidente.

## Avisos

- **Issue de GitHub** con la etiqueta `incident`. Solo se abre uno: los
  siguientes runs no duplican el aviso. Al recuperarse, se comenta y se cierra.
- **ntfy** (opcional pero recomendado): usa el mismo topic que Alertmanager.
  Se lee del Secret `observability/ntfy-topic` y se guarda como **secret de
  GitHub** llamado `NTFY_TOPIC`:

  ```bash
  kubectl -n observability get secret ntfy-topic \
    -o go-template='{{index .data "topic.tmpl" | base64decode}}'
  ```

  Copia solo el valor del topic (`homelab-...`) en *Settings → Secrets and
  variables → Actions → New repository secret*. Si no existe, el workflow sigue
  funcionando y solo abre el issue.

El run se marca en rojo mientras dure el incidente; en verde al recuperarse.

## Probarlo sin romper nada

1. *Actions → uptime → Run workflow*.
2. Marca `simulate_failure` y ejecuta.
3. Debe abrir el issue `🚨 Homelab inaccesible` y mandar el aviso de prioridad
   alta (si `NTFY_TOPIC` está configurado).
4. Vuelve a lanzarlo sin marcar la casilla: cierra el issue y manda el aviso de
   recuperación.

También se puede lanzar desde `gh`:

```bash
gh workflow run uptime.yml -f simulate_failure=true
gh run list --workflow uptime.yml --limit 3
```

## Límites y alternativa de 5 minutos

- GitHub no garantiza el minuto exacto: un `schedule` puede retrasarse varios
  minutos en horas punta. Con 30 min de cadencia, la detección puede tardar
  hasta ~45 min.
- El repo es privado: cada run consume como mínimo un minuto de Actions. Con
  `7,37 * * * *` son ~1.440 min/mes, dentro de los 2.000 del plan Free.
- Si GitHub está caído, el monitor también. Es el precio de no tener otra
  infraestructura externa.
- No comprueba servicios internos (Prometheus, AdGuard, Argo): para eso están
  las alertas internas.

Para una detección de ~5 minutos, crea un monitor HTTP en **UptimeRobot**
(gratis) apuntando a `https://dbarroso.dev/live/healthz` y otro a
`https://dbarroso.dev/`, con alertas por email. Es independiente de GitHub y no
consume minutos; el workflow de GitHub queda como segunda opinión y para el
historial de incidentes. Si tu plan de UptimeRobot permite webhooks, puedes
apuntarlo a ntfy y unificar el canal.

## Seguridad

- Solo se consultan URLs **públicas**; no se envían tokens ni datos internos.
- El topic de ntfy es un secreto de GitHub y se enmascara en los logs.
- El workflow solo tiene permiso de escritura sobre issues.
- Los incidentes no incluyen IPs, logs ni configuración del cluster.
