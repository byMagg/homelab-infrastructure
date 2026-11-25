#!/usr/bin/env bash
#
# Bootstrap de Argo CD. Es lo único que no puede vivir en Git: Argo CD no puede
# instalarse a sí mismo desde cero. El resto (versión, `server.insecure`,
# componentes) lo gestiona la Application `argocd`.
#
# Uso:
#   scripts/bootstrap-argocd.sh
#   ARGOCD_SSH_KEY=~/.ssh/otra_clave scripts/bootstrap-argocd.sh
#
# Idempotente: se puede relanzar tras reconstruir cluster0. Lo que ya existe no
# se toca (el namespace, el Secret `repo-homelab` y la app raíz se reaplican sin
# efecto).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NAMESPACE="argocd"
REPO_URL="git@github.com:byMagg/homelab-infrastructure.git"
SSH_KEY="${ARGOCD_SSH_KEY:-$HOME/.ssh/argocd_homelab}"

command -v kubectl >/dev/null 2>&1 || {
  echo "error: kubectl no está en PATH (en el portátil vive en ~/.local/bin)" >&2
  exit 1
}

cd "$REPO_ROOT"

echo "==> Namespace $NAMESPACE"
kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

echo "==> Argo CD desde kubernetes/apps/argocd (base remota v3.6.1 + parches)"
# Server-side: el CRD de ApplicationSet supera el límite de client-side apply.
# --force-conflicts adopta sin pelear los recursos creados antes a mano.
kubectl apply -n "$NAMESPACE" --server-side --force-conflicts \
  -k kubernetes/apps/argocd

echo "==> Esperando a los componentes"
kubectl -n "$NAMESPACE" rollout status deploy/argocd-server --timeout=300s
kubectl -n "$NAMESPACE" rollout status deploy/argocd-repo-server --timeout=300s
kubectl -n "$NAMESPACE" rollout status statefulset/argocd-application-controller --timeout=300s
kubectl -n "$NAMESPACE" rollout status deploy/argocd-applicationset-controller --timeout=300s

echo "==> Deploy key de solo lectura ($REPO_URL)"
if kubectl -n "$NAMESPACE" get secret repo-homelab >/dev/null 2>&1; then
  echo "    repo-homelab ya existe; no se toca"
else
  if [[ ! -f "$SSH_KEY" ]]; then
    echo "error: falta la clave $SSH_KEY" >&2
    echo "       pásala con ARGOCD_SSH_KEY=/ruta/a/la/clave" >&2
    exit 1
  fi
  kubectl -n "$NAMESPACE" create secret generic repo-homelab \
    --from-literal=type=git \
    --from-literal=url="$REPO_URL" \
    --from-file=sshPrivateKey="$SSH_KEY"
  kubectl -n "$NAMESPACE" label secret repo-homelab \
    argocd.argoproj.io/secret-type=repository --overwrite
fi

echo "==> App-of-apps"
kubectl apply -f kubernetes/argocd/root-app.yaml

cat <<EOF

Listo. Argo CD se adopta a sí mismo con la Application 'argocd' y crea el
resto de apps de kubernetes/argocd/. Sigue el progreso con:

  kubectl -n $NAMESPACE get applications
EOF
