# Fase 6 — Dominio público con Cloudflare Tunnel

Fecha: 2026-11-19
Estado: preparado en el repo; el túnel no existe hasta tener dominio.
Imagen: `cloudflare/cloudflared:2026.11.1`
Namespace: `cloudflared`

## Objetivo

Publicar una muestra de los servicios del cluster en Internet con un dominio
propio, sin abrir puertos en el router y sin depender de una IP pública fija.
El caso de uso es un portfolio: el sitio y las demos son públicos, los paneles
de administración quedan detrás de Cloudflare Access.

## Diseño

```
Internet ──► Cloudflare edge (TLS, WAF, Access)
                 │  túnel saliente QUIC  (el cluster inicia la conexión)
                 ▼
          cloudflared ×2  (namespace cloudflared)
                 │  http://traefik.kube-system.svc.cluster.local:80
                 ▼
              Traefik ──► Ingress por Host ──► portfolio / homepage / grafana / ...
```

| Pieza | Decisión | Motivo |
|---|---|---|
| Entrada | Cloudflare Tunnel | Sin port forwarding, funciona detrás de CGNAT, sin IP fija |
| TLS | Borde de Cloudflare | No hace falta cert-manager ni Let's Encrypt en el cluster |
| DNS público | Zona en Cloudflare | CNAME proxied automático al crear cada public hostname |
| DNS interno | AdGuard (`*.homelab.home.arpa`) | Sigue siendo el DNS de la LAN; no se toca |
| Enrutado de apps | `Ingress` por `Host` | Único sitio donde vive la configuración, versionado en Git |
| Paneles admin | Cloudflare Access (OTP por email) | Gratis hasta 50 usuarios; no hay que tocar las apps |
| Réplicas | 2, una por nodo de 4 GB | Cada réplica abre su propia conexión QUIC |

La pieza clave: **cada public hostname apunta al mismo origen**, el Service de
Traefik. `cloudflared` no sabe nada de servicios concretos; quien decide es el
`Ingress`. Añadir un servicio nuevo es añadir su `Ingress` en Git y una entrada
en el túnel.

## Lo que NO hace falta

- Abrir 80/443 en el router (ni tocar UFW: sus reglas siguen siendo para la LAN).
- IP pública fija ni DDNS: el túnel es una conexión saliente.
- cert-manager, Let's Encrypt ni secretos ACME.
- Redirigir HTTP→HTTPS en Traefik: el redirect lo hace Cloudflare; el origen es
  HTTP y Traefik tiene el entrypoint `web` sin redirección.

## Prerrequisitos

1. Un dominio registrado (Cloudflare Registrar o cualquiera que permita cambiar
   los nameservers).
2. El dominio **activo en Cloudflare** (nameservers apuntando a Cloudflare) y el
   plan gratuito basta.
3. Cuenta de Cloudflare Zero Trust creada (se activa sola al entrar en
   *Zero Trust*; el plan gratuito incluye túneles y Access hasta 50 usuarios).

## Pasos

### 1. Registrar el dominio y delegarlo a Cloudflare

En el registrador, cambiar los nameservers por los que indique Cloudflare. La
zona tarda desde minutos hasta unas horas en pasar a `Active`.

### 2. Crear el túnel

*Zero Trust → Networks → Tunnels → Create a tunnel → Cloudflared*.

- Nombre: `homelab`.
- Guardar el **token** que muestra el asistente (solo se muestra ahí).

### 3. Public hostnames

En la pestaña *Public Hostname* del túnel, una entrada por servicio:

| Subdomain | Domain | Path | Service |
|---|---|---|---|
| *(vacío)* | `dbarroso.dev` | | `http://traefik.kube-system.svc.cluster.local:80` |
| `lab` | `dbarroso.dev` | | `http://traefik.kube-system.svc.cluster.local:80` |
| `grafana` | `dbarroso.dev` | | `http://traefik.kube-system.svc.cluster.local:80` |
| `prometheus` | `dbarroso.dev` | | `http://traefik.kube-system.svc.cluster.local:80` |
| `argocd` | `dbarroso.dev` | | `http://traefik.kube-system.svc.cluster.local:80` |

La raíz sirve el portfolio (`kubernetes/apps/portfolio`). Todos los hosts ya
tienen su regla en el `Ingress` correspondiente, con el host interno al lado.

El dashboard crea el CNAME proxied hacia `<uuid>.cfargotunnel.com`. **El
Host header se conserva**, así que el `Ingress` de Kubernetes debe declarar ese
mismo host público (o, mejor, se añade el host público junto al interno en el
mismo `Ingress`).

No usar el puerto 443 ni `https://` en *Service*: el tramo cluster→Traefik es
HTTP.

### 4. Crear el Secret del token

El token no se commitea. Tras el primer sync de Argo (que crea el namespace):

```bash
kubectl -n cloudflared create secret generic cloudflared-token \
  --from-literal=token='<token>'
kubectl -n cloudflared rollout restart deploy/cloudflared
```

Sin el Secret, el pod queda en `CreateContainerConfigError`; es esperado la
primera vez y Argo no se queja porque el Secret no está gestionado por él.

### 5. Desplegar

```bash
kubectl apply -f kubernetes/argocd/cloudflared-app.yaml
kubectl -n cloudflared get pods -w
```

### 6. Proteger los paneles con Access

*Zero Trust → Access → Applications → Add an application → Self-hosted*, una
por hostname sensible (`argocd`, `grafana`, y el de AdGuard si algún día se
publica). Política: `Emails` = tu correo. El resto se deja sin aplicación de
Access.

## Verificación

```bash
kubectl -n cloudflared logs deploy/cloudflared | grep -i "Registered tunnel connection"
# 4 conexiones (2 por réplica) = túnel sano
curl -I https://lab.dbarroso.dev        # 200 y certificado válido de Cloudflare
curl -H 'Host: homepage.homelab.home.arpa' http://192.168.1.100/   # sigue igual
```

## Gotchas

- **`/ready` es la única probe fiable.** El proceso puede estar vivo y sin
  conexión registrada; con un TCP check el pod parecería sano y el sitio caído.
- **El token no se refresca en caliente.** Rotarlo exige actualizar el Secret y
  hacer `rollout restart`.
- **Wildcard en public hostnames**: el dashboard pide hosts explícitos. Si algún
  día se quieren muchos subdominios, hay que pasar a un túnel gestionado en
  local (`config.yml` con regla `*.dbarroso.dev` + credenciales JSON en un
  Secret) o usar Terraform. Para 4-5 servicios no compensa.
- **Hairpin**: desde la LAN, `https://lab.dbarroso.dev` sale a Internet y
  vuelve por el túnel. Funciona, pero añade latencia; si molesta, un rewrite en
  AdGuard a `192.168.1.100` sirve el mismo `Ingress` (el TLS del navegador
  fallaría, así que solo tiene sentido para HTTP interno o con el host interno).
- **No activar "No TLS Verify"** en el origen: el tramo al cluster es HTTP
  plano, no TLS.
- **Los nombres internos no cambian**: `*.homelab.home.arpa` sigue resolviendo
  por AdGuard. El dominio público es una zona aparte.
- Si el sitio público pesa (vídeo, descargas grandes), revisa la política de
  uso de Cloudflare: el túnel no está pensado como CDN de medios.

## Rollback

```bash
kubectl delete application cloudflared -n argocd
kubectl delete ns cloudflared
```

Después, borrar el túnel y los CNAME en el dashboard. El cluster queda como
estaba; no hay nada que revertir en el router ni en UFW.

## Publicación de la imagen del portfolio

El sitio (`dbarrosourr/dbarrosourr.github.io`) es un Astro estático. El workflow
`image.yaml` construye una imagen `linux/arm64` y la publica en
`ghcr.io/dbarrosourr/cv-portfolio:sha-<commit>`; el Deployment de
`kubernetes/apps/portfolio` fija ese tag a mano.

El paquete tiene que ser **público**, y aquí hay una trampa: `dbarrosourr` es una
organización, así que el botón *Change visibility → Public* falla con "los
organizadores no permiten paquetes públicos" hasta que un owner habilita
*Organization settings → Packages → Package Creation → Public*. El síntoma en el
cluster es `ErrImagePull` con `401 Unauthorized` al pedir el token anónimo; el
kubelet reintenta con backoff de hasta 5 minutos, así que tras cambiar la
visibilidad conviene borrar los pods para no esperar.

```bash
kubectl -n portfolio delete pods -l app.kubernetes.io/name=portfolio
```

## Pendiente

- Sealed Secrets para dejar de crear el token a mano.
- Argo CD Image Updater (o un workflow que abra PR) para no tener que subir a
  mano el tag de `ghcr.io/dbarrosourr/cv-portfolio` en cada cambio del CV.
