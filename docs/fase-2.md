# Fase 2 — Argo CD y primera app

Fecha: 2026-11-17
Argo CD: `v3.6.1`
App: `traefik/whoami:v1.12.0` en el namespace `demo`

## Objetivo

Introducir GitOps con el mínimo de piezas: Argo CD sincroniza un directorio
del repo y despliega la primera aplicación con Ingress de Traefik.

## Instalación de Argo CD

```bash
kubectl create namespace argocd
kubectl apply -n argocd -f \
  https://raw.githubusercontent.com/argoproj/argo-cd/v3.6.1/manifests/install.yaml
```

El primer `kubectl apply` falla al crear el CRD `applicationsets.argoproj.io`
por el límite de tamaño de la anotación `last-applied-configuration`. Se
resuelve repitiendo el apply en modo server-side:

```bash
kubectl apply --server-side --force-conflicts -n argocd -f \
  https://raw.githubusercontent.com/argoproj/argo-cd/v3.6.1/manifests/install.yaml
```

Resultado: 6 deployments `Available` y 7 pods en `Running` (el controller y
varios componentes caen en cluster1).

## Acceso al repositorio

Argo CD usa una deploy key **de solo lectura** (`~/.ssh/argocd_homelab`),
registrada en GitHub y guardada en el Secret `repo-homelab` del namespace
`argocd`. La clave privada nunca está en Git.

```bash
kubectl -n argocd create secret generic repo-homelab \
  --from-literal=type=git \
  --from-literal=url=git@github.com:byMagg/homelab-infrastructure.git \
  --from-file=sshPrivateKey=$HOME/.ssh/argocd_homelab \
  --dry-run=client -o yaml | kubectl apply -f -
kubectl -n argocd label secret repo-homelab \
  argocd.argoproj.io/secret-type=repository --overwrite
```

Comprobación de la clave sin pasar por Argo:

```bash
GIT_SSH_COMMAND="ssh -i ~/.ssh/argocd_homelab -o IdentitiesOnly=yes" \
  git ls-remote git@github.com:byMagg/homelab-infrastructure.git
```

## Primera aplicación

Manifiestos en `kubernetes/apps/whoami/`:

- `namespace.yaml`: namespace `demo`.
- `deployment.yaml`: 2 réplicas, límites de memoria y `securityContext`
  restrictivo.
- `service.yaml`: ClusterIP en el puerto 80.
- `ingress.yaml`: host `whoami.homelab.home.arpa`, clase `traefik`.

La Application vive en `kubernetes/argocd/whoami-app.yaml` y se aplica una
sola vez con `kubectl` (bootstrap). A partir de ahí Argo sincroniza con
`prune` y `selfHeal` activados.

```bash
kubectl apply -f kubernetes/argocd/whoami-app.yaml
kubectl -n argocd get application whoami
```

Resultado: `Synced` / `Healthy`, dos pods `whoami` repartidos entre los nodos
que toleran el taint de cluster2 (hoy cluster1 y cluster2).

## DNS local

Entradas en WSL (`/etc/hosts`):

```
192.168.1.100 whoami.homelab.home.arpa
192.168.1.100 argocd.homelab.home.arpa
```

Windows (`C:\Windows\System32\drivers\etc\hosts`, requiere administrador):

```
192.168.1.100 whoami.homelab.home.arpa
192.168.1.100 argocd.homelab.home.arpa
```

Las entradas apuntan solo a cluster0. Si cluster0 cae, se cambian a
`192.168.1.101` o se añade un VIP con kube-vip en otra fase.

## Verificación

```bash
curl http://whoami.homelab.home.arpa
curl -H 'Host: whoami.homelab.home.arpa' http://192.168.1.100
curl -H 'Host: whoami.homelab.home.arpa' http://192.168.1.101
```

Los tres devuelven el nombre del pod, su IP y las cabeceras reenviadas por
Traefik.

## Acceso a la UI de Argo

`argocd-server` sirve HTTPS y redirige HTTP a HTTPS en el mismo puerto, así que
Traefik no puede terminar TLS sin tocar el servidor. Para el homelab se arranca
en modo HTTP y Traefik enruta por el puerto 80:

```bash
kubectl -n argocd patch deploy argocd-server --type=json \
  -p='[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--insecure"}]'
kubectl apply -f kubernetes/argocd/ingress.yaml
```

Abrir `http://argocd.homelab.home.arpa` con usuario `admin`. La contraseña
inicial:

```bash
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath='{.data.password}' | base64 -d
```

Conviene cambiarla desde la UI (User Info → Update Password); el secreto
inicial se puede borrar después. El `--insecure` es temporal: cuando se
instale cert-manager, Traefik terminará TLS y se podrá quitar.

Como alternativa sin Ingress:

```bash
kubectl -n argocd port-forward svc/argocd-server 8080:80
# http://localhost:8080
```

## Gotchas

1. **CRD demasiado grande para `kubectl apply`.** El CRD de ApplicationSet
   supera el límite de la anotación de client-side apply. Usar
   `--server-side --force-conflicts`.

2. **La API de Argo no acepta basic auth.** Para probar el login:
   ```bash
   curl -s -X POST http://argocd.homelab.home.arpa/api/v1/session \
     -H 'Content-Type: application/json' \
     -d '{"username":"admin","password":"..."}'
   ```
   Devuelve un token; la UI lo usa igual.

3. **El `sudo` de WSL pide contraseña.** Para tareas locales de root no
   interactivas (por ejemplo `/etc/hosts`) se puede usar
   `wsl.exe -u root -e sh -c '...'`.

4. **El hosts de Windows no lo lee WSL ni al revés.** Hay que añadir la
   entrada en los dos sitios. En Windows requiere UAC; desde WSL se puede
   lanzar un PowerShell elevado con `Start-Process -Verb RunAs`.

5. **ServiceLB publica en todas las IPs de los nodos.** El Ingress muestra
   `192.168.1.100,192.168.1.101`; el DNS local apunta a `.100` por simplicidad.

6. **`--insecure` no está en `install.yaml`.** Si se reaplica el manifiesto de
   Argo CD, el deployment vuelve a arrancar en modo TLS y el Ingress deja de
   funcionar. Hay que repetir el `kubectl patch` después de reinstalar.
