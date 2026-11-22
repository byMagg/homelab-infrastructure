# Fase 4 — Secretos (y TLS interno pendiente)

Fecha: 2026-11-21
Estado: **secretos completados** con Sealed Secrets; TLS interno pendiente.
Versión: `sealed-secrets v0.41.2`
Namespace: `sealed-secrets`

## Objetivo

Dejar de crear `Secret` a mano (`kubectl create secret ...`) y que Argo CD
gestione los secretos desde Git **cifrados**. El primer caso es el token del
túnel de Cloudflare; después vendrán el admin de Grafana, ntfy y las
credenciales de R2.

TLS interno se separa de esta fase: Cloudflare ya termina el TLS público y el
tráfico de la LAN puede esperar a que haya SSO/Authentik o a que molesten los
avisos del navegador.

## Diseño

| Pieza | Decisión | Motivo |
|---|---|---|
| Cifrado | Sealed Secrets `v0.41.2` | Un solo controller, GitOps puro, sin dependencias externas |
| Controller | 1 réplica en `sealed-secrets` | ~50 MB; sobra en los nodos de 4 GB |
| Clave privada | Secret `sealed-secrets-key*` en el cluster | Nunca sale de Kubernetes; se respalda aparte |
| Manifiestos | `kubernetes/apps/sealed-secrets` | Controller + CRD versionados, sin Helm |
| Aplicación | `kubernetes/argocd/sealed-secrets-app.yaml` | Argo lo sincroniza como el resto |
| Ámbito de cifrado | `strict` (namespace + nombre) | Un `SealedSecret` no se puede mover de sitio |
| Alternativa | SOPS + age | Más portable entre clusters, pero exige plugin en Argo |

Flujo:

```
kubeseal (portátil)                  cluster
┌──────────────────┐        ┌──────────────────────────┐
│ Secret plano     │        │ Controller               │
│  token: xxx      │──cifra►│  clave privada           │
└──────────────────┘        │  (Secret en sealed-secrets)│
                            └────────────┬─────────────┘
SealedSecret (Git) ──Argo──► SealedSecret ┴──► Secret ──► Pod
```

## Instalación

El controller se instaló primero a mano para probar y después Argo adopta los
mismos recursos:

```bash
kubectl apply -f kubernetes/apps/sealed-secrets/
kubectl apply -f kubernetes/argocd/sealed-secrets-app.yaml
kubectl -n sealed-secrets rollout status deploy/sealed-secrets-controller
```

Comprobación:

```bash
kubectl -n sealed-secrets get pods,secret
kubectl get crd sealedsecrets.bitnami.com
```

## Sellar un secreto

```bash
# Clave pública del controller (no es secreta; se puede volver a pedir)
kubeseal --controller-namespace sealed-secrets \
  --controller-name sealed-secrets-controller \
  --fetch-cert > pub-cert.pem

# Crear el SealedSecret sin escribir el valor en claro en disco
kubectl create secret generic mi-secreto -n mi-namespace \
  --from-literal=password='...' \
  --dry-run=client -o yaml \
  | kubeseal --controller-namespace sealed-secrets \
      --controller-name sealed-secrets-controller \
      --cert pub-cert.pem --format yaml \
  > kubernetes/apps/mi-app/sealedsecret.yaml
```

Se commitea el `SealedSecret`, Argo lo aplica y el controller crea el `Secret`
normal. El Deployment no cambia: sigue referenciando `secretKeyRef`.

Para rotar un valor se repite el proceso, se commitea y se reinicia el
consumidor si no recarga el secreto en caliente:

```bash
kubectl -n cloudflared rollout restart deploy/cloudflared
```

## Migración del token de Cloudflare

El token ya existía como `Secret` manual. Se selló directamente desde el
cluster, sin volver a copiarlo a un fichero:

```bash
kubectl -n cloudflared get secret cloudflared-token -o yaml \
  | kubeseal --controller-namespace sealed-secrets \
      --controller-name sealed-secrets-controller \
      --cert pub-cert.pem --format yaml \
  > kubernetes/apps/cloudflared/sealedsecret.yaml
```

Gotcha de la migración: el controller **no adopta** un `Secret` que ya existía
y no creó él. El estado queda:

```
failed update: Resource "cloudflared-token" already exists and is not managed by SealedSecret
```

Hay que borrar el `Secret` manual; el controller lo recrea con su
`ownerReference`. Si no reintenta solo, `rollout restart` del controller o un
cambio de anotación en el `SealedSecret` lo fuerzan:

```bash
kubectl -n cloudflared delete secret cloudflared-token
kubectl -n cloudflared get sealedsecret cloudflared-token -o jsonpath='{.status.conditions}'
kubectl -n cloudflared get secret cloudflared-token \
  -o jsonpath='{.metadata.ownerReferences[*].kind}/{.metadata.ownerReferences[*].name}'
# SealedSecret/cloudflared-token
```

Los pods de `cloudflared` no se reinician al borrar el `Secret`; siguen con la
variable de entorno ya cargada.

## Backup de la clave privada

Es el punto crítico: si se reconstruye cluster0 y se pierde la clave, **todos
los `SealedSecret` del repo dejan de descifrarse**.

```bash
mkdir -p ~/.config/homelab && chmod 700 ~/.config/homelab
kubectl -n sealed-secrets get secret \
  -l sealedsecrets.bitnami.com/sealed-secrets-key -o yaml \
  > ~/.config/homelab/sealed-secrets-key.yaml
chmod 600 ~/.config/homelab/sealed-secrets-key.yaml
```

Ese fichero está **fuera del repo** y hay que copiarlo al gestor de contraseñas
y/o al backup de R2. Para restaurar, se aplica el Secret en `sealed-secrets`
antes de arrancar el controller (o se aplica y se reinicia el controller).

## El huevo y la gallina de Argo CD

Argo necesita el Secret `repo-homelab` (deploy key de solo lectura) para leer
el repo. Si ese Secret fuese un `SealedSecret` dentro del propio repo, Argo no
podría sincronizarlo hasta tener acceso.

Por eso `repo-homelab` sigue siendo un **bootstrap manual** documentado en
`docs/fase-2.md`. Una vez el cluster está en marcha se podría sellar también,
pero en un cluster nuevo habría que crearlo a mano igualmente.

## Qué queda

1. **TLS interno** con CA propia (cert-manager o `mkcert`/step-ca). Pendiente
   hasta que haya SSO o se quieran quitar los avisos del navegador.
2. **Admin de Grafana**: la contraseña se cambió a mano, pero vive solo en el
   PVC. Pasarla a un `SealedSecret` con `existingSecret` exige cuidado porque el
   PVC ya tiene la contraseña actual.
3. **R2** (fase 7) y **ntfy** (fase 5): ya usan `SealedSecret` desde el
   principio.
4. **AdGuard**: su configuración vive en un PVC, no es un `Secret` de
   Kubernetes; no entra en este flujo.

## Verificación

```bash
kubectl -n sealed-secrets get pods
kubectl get sealedsecrets -A
kubectl -n cloudflared get sealedsecret cloudflared-token \
  -o jsonpath='{.status.conditions[*].status} {.status.conditions[*].message}'
kubectl -n cloudflared get secret cloudflared-token \
  -o jsonpath='{.metadata.ownerReferences[*].kind}/{.metadata.ownerReferences[*].name}'
```

El `SealedSecret` debe estar `True`/`Synced` y el `Secret` debe tener como
dueño al `SealedSecret`.

## Gotchas

- **`kubeseal` y el controller deben ser compatibles**; usa la misma versión
  (`v0.41.2`) o al menos la misma minor.
- **El cifrado está atado a namespace + nombre**. Renombrar o mover un
  `SealedSecret` obliga a re-sellarlo.
- **`kubectl get secret -o yaml` no es cifrado**: es base64. No lo commitees.
- **El controller rota su clave** periódicamente y conserva las antiguas para
  descifrar; el backup debe incluir todas las claves etiquetadas.
- **Borrar la Application de Argo no borra la clave privada**, pero borrar el
  CRD sí elimina los `SealedSecret` y sus `Secret` asociados.
- **El Secret de la clave no lo gestiona Argo**; no lo metas en Git.
