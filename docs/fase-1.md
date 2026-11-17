# Fase 1 — Cluster k3s

Fecha: 2026-11-17
Nodos: cluster0 (192.168.1.100, server), cluster1 (192.168.1.101, agent)
Versión: k3s `v1.37.2+k3s1` (Kubernetes 1.37.2)

## Objetivo

Tener un cluster funcional con el mínimo de piezas posible. Se usa k3s de
fábrica en lugar de sustituir el CNI: flannel, kube-proxy, Traefik, ServiceLB,
local-path y metrics-server. Cilium, Gateway API y LB IPAM quedan para una fase
posterior.

## Instalación

Playbook: `ansible/playbooks/phase1.yml` (rol `k3s`).

- cluster0 se instala como server con `--tls-san 192.168.1.100` para que el
  kubeconfig funcione desde WSL sin túneles SSH.
- cluster1 se une como agent usando el token del server.
- El playbook espera a la API en `6443` y a que todos los nodos estén `Ready`
  con `kubectl wait`.

No hay `/etc/rancher/k3s/config.yaml`: todo son valores por defecto salvo el
`tls-san`.

## Acceso desde WSL

```bash
mkdir -p ~/.local/bin ~/.kube
curl -fsSLo ~/.local/bin/kubectl \
  https://dl.k8s.io/release/v1.37.2/bin/linux/amd64/kubectl
curl -fsSL https://dl.k8s.io/release/v1.37.2/bin/linux/amd64/kubectl.sha256 \
  | (cd ~/.local/bin && sha256sum -c -)
chmod 0755 ~/.local/bin/kubectl

ssh ansible@192.168.1.100 'sudo cat /etc/rancher/k3s/k3s.yaml' \
  > ~/.kube/homelab.yaml
sed -i 's#https://127.0.0.1:6443#https://192.168.1.100:6443#' ~/.kube/homelab.yaml
chmod 0600 ~/.kube/homelab.yaml
```

`~/.zshrc` y `~/.bashrc` añaden `~/.local/bin` al `PATH` y exportan
`KUBECONFIG` a `~/.kube/homelab.yaml`.

## Verificación

```
kubectl get nodes
kubectl get pods -A
```

Resultado:

- cluster0 `Ready` (control-plane) y cluster1 `Ready`, ambos `v1.37.2+k3s1`.
- `coredns`, `local-path-provisioner`, `metrics-server`, `traefik` y los
  `svclb-traefik` en `Running`.
- `traefik` recibe las dos IPs de los nodos como external IP
  (`192.168.1.100,192.168.1.101`).
- `curl http://192.168.1.100` y `http://192.168.1.101` devuelven `404`, que es
  lo esperado en Traefik sin Ingress.
- DNS interno: `nslookup kubernetes.default.svc.cluster.local` desde un pod
  devuelve `10.43.0.1`.

## Gotchas

1. **BusyBox no aplica los search domains.** `nslookup kubernetes.default`
   devuelve `NXDOMAIN`; hay que consultar el FQDN
   `kubernetes.default.svc.cluster.local`. No es un fallo de CoreDNS.

2. **`kubectl run -i` falla al adjuntarse con containerd en k3s.**
   Para pruebas de un solo uso, ejecutar sin `-i` y leer los logs:
   ```bash
   kubectl run dns-test --image=busybox:1.36 --restart=Never -- \
     nslookup kubernetes.default.svc.cluster.local
   kubectl logs dns-test
   kubectl delete pod dns-test
   ```

3. **k3s 1.37 instala los CRD de Gateway API por defecto** aunque no se use
   Gateway API. No hay que borrarlos: no afectan al funcionamiento y evitan
   conflictos si se adopta más adelante.

4. **El token del nodo no se imprime.** La tarea que lo lee usa `no_log: true`;
   si falla el join, revisar el estado del servicio en el agent antes de tocar
   el playbook.

5. **UFW ya estaba preparado.** Los puertos `6443/tcp`, `10250/tcp` y
   `8472/udp` de la Fase 0 son suficientes para k3s con flannel; no hizo falta
   cambiar el firewall.
