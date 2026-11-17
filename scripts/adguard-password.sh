#!/usr/bin/env bash
# Cambia la contraseña del usuario `admin` de AdGuard Home.
#
# AdGuard Home v0.107 no permite cambiarla desde la UI: solo existe el hash
# bcrypt en AdGuardHome.yaml. Este script la pide en local (sin echo), la
# convierte a bcrypt y la escribe en el PVC montando un pod temporal.
#
# Uso:
#   bash scripts/adguard-password.sh
#
set -euo pipefail

NAMESPACE=adguard
APP=adguard
PVC=adguard-conf
TMP_POD=adguard-pass

export KUBECONFIG="${KUBECONFIG:-$HOME/.kube/homelab.yaml}"

command -v kubectl >/dev/null || { echo "ERROR: kubectl no está en el PATH."; exit 1; }
python3 -c 'import bcrypt' 2>/dev/null || {
  echo "ERROR: falta el módulo Python bcrypt (sudo apt install python3-bcrypt)."
  exit 1
}

read -rsp 'Nueva contraseña de AdGuard: ' PASS1; echo
read -rsp 'Repite la contraseña: ' PASS2; echo

if [ "$PASS1" != "$PASS2" ]; then
  echo "ERROR: las contraseñas no coinciden."
  exit 1
fi
if [ "${#PASS1}" -lt 8 ]; then
  echo "ERROR: usa al menos 8 caracteres."
  exit 1
fi

HASH=$(python3 - "$PASS1" <<'PY'
import bcrypt
import sys

print(bcrypt.hashpw(sys.argv[1].encode(), bcrypt.gensalt(prefix=b"2a")).decode())
PY
)
unset PASS1 PASS2

TMPFILE=""

cleanup() {
  if [ -n "$TMPFILE" ]; then rm -f "$TMPFILE"; fi
  kubectl -n "$NAMESPACE" delete pod "$TMP_POD" --ignore-not-found --wait=false >/dev/null 2>&1 || true
  kubectl -n "$NAMESPACE" scale deploy "$APP" --replicas=1 >/dev/null 2>&1 || true
  kubectl -n argocd patch application "$APP" --type merge \
    -p '{"spec":{"syncPolicy":{"automated":{"prune":true,"selfHeal":true}}}}' \
    >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "Pausando Argo CD y parando AdGuard..."
kubectl -n argocd patch application "$APP" --type merge \
  -p '{"spec":{"syncPolicy":{"automated":null}}}' >/dev/null
kubectl -n "$NAMESPACE" scale deploy "$APP" --replicas=0 >/dev/null
kubectl -n "$NAMESPACE" wait --for=delete pod \
  -l app.kubernetes.io/name=adguard --timeout=120s >/dev/null

echo "Montando el PVC en un pod temporal..."
kubectl -n "$NAMESPACE" delete pod "$TMP_POD" --ignore-not-found >/dev/null 2>&1 || true
cat <<EOF | kubectl apply -f - >/dev/null
apiVersion: v1
kind: Pod
metadata:
  name: $TMP_POD
  namespace: $NAMESPACE
spec:
  restartPolicy: Never
  containers:
    - name: shell
      image: adguard/adguardhome:v0.107.80
      command: ["sh", "-c", "sleep 300"]
      volumeMounts:
        - name: conf
          mountPath: /conf
  volumes:
    - name: conf
      persistentVolumeClaim:
        claimName: $PVC
EOF
kubectl -n "$NAMESPACE" wait --for=condition=Ready pod/"$TMP_POD" --timeout=120s >/dev/null

TMPFILE=$(mktemp)
chmod 600 "$TMPFILE"
kubectl -n "$NAMESPACE" exec "$TMP_POD" -- cat /conf/AdGuardHome.yaml > "$TMPFILE"

python3 - "$TMPFILE" "$HASH" <<'PY'
import re
import sys

path, new_hash = sys.argv[1], sys.argv[2]
with open(path, encoding="utf-8") as fh:
    text = fh.read()

text, count = re.subn(
    r"(?m)^(\s*password:\s*)\S+",
    lambda match: match.group(1) + new_hash,
    text,
    count=1,
)
if count != 1:
    sys.exit("ERROR: no se encontró la línea password en AdGuardHome.yaml")

with open(path, "w", encoding="utf-8") as fh:
    fh.write(text)
PY

kubectl -n "$NAMESPACE" exec -i "$TMP_POD" -- \
  sh -c 'cat > /conf/AdGuardHome.yaml' < "$TMPFILE"

echo "Restaurando AdGuard..."
kubectl -n "$NAMESPACE" delete pod "$TMP_POD" --wait=true >/dev/null
kubectl -n "$NAMESPACE" scale deploy "$APP" --replicas=1 >/dev/null
kubectl -n "$NAMESPACE" rollout status deploy/"$APP" --timeout=180s

echo "Listo: contraseña de AdGuard actualizada."
