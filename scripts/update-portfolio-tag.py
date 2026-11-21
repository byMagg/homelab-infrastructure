#!/usr/bin/env python3
"""Mantiene actualizado el tag de la imagen del portfolio.

Lee los tags ``sha-*`` publicados en GHCR, elige el más reciente por fecha de
creación del manifiesto y lo escribe en el Deployment. Pensado para CI: sale
con 0 y solo modifica el fichero si hay un tag nuevo. El paquete de GHCR debe
ser público (se usa el token anónimo del registro).

Uso:
    python3 scripts/update-portfolio-tag.py
"""

from __future__ import annotations

import json
import os
import re
import sys
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path

IMAGE_REPO = "dbarrosourr/cv-portfolio"
IMAGE = f"ghcr.io/{IMAGE_REPO}"
MANIFEST = Path("kubernetes/apps/portfolio/deployment.yaml")

ACCEPT_INDEX = (
    "application/vnd.oci.image.index.v1+json,"
    "application/vnd.docker.distribution.manifest.list.v2+json"
)
ACCEPT_MANIFEST = (
    "application/vnd.oci.image.manifest.v1+json,"
    "application/vnd.docker.distribution.manifest.v2+json"
)


class _NoAuthOnRedirect(urllib.request.HTTPRedirectHandler):
    """No manda el token de GHCR a otro host (las blobs redirigen a un CDN)."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        new = super().redirect_request(req, fp, code, msg, headers, newurl)
        if new is not None:
            same_host = urllib.parse.urlparse(newurl).netloc == urllib.parse.urlparse(
                req.full_url
            ).netloc
            if not same_host:
                new.remove_header("Authorization")
        return new


_opener = urllib.request.build_opener(_NoAuthOnRedirect)


def fetch(url: str, token: str | None = None, accept: str | None = None) -> bytes:
    req = urllib.request.Request(url)
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    if accept:
        req.add_header("Accept", accept)
    with _opener.open(req, timeout=30) as response:
        return response.read()


def fetch_json(url: str, token: str | None = None, accept: str | None = None):
    return json.loads(fetch(url, token, accept))


def main() -> int:
    token = fetch_json(
        f"https://ghcr.io/token?scope=repository:{IMAGE_REPO}:pull&service=ghcr.io"
    )["token"]

    tag_list = fetch_json(
        f"https://ghcr.io/v2/{IMAGE_REPO}/tags/list", token
    ).get("tags") or []
    tags = [t for t in tag_list if re.fullmatch(r"sha-[0-9a-f]{7,40}", t)]

    if not tags:
        print(f"No hay tags sha-* en {IMAGE}; nada que hacer.")
        return 0

    newest_tag = ""
    newest_epoch = 0.0

    for tag in tags:
        raw = fetch_json(
            f"https://ghcr.io/v2/{IMAGE_REPO}/manifests/{tag}", token, ACCEPT_INDEX
        )

        if "manifests" in raw:
            manifests = raw["manifests"]
            arm64 = [
                m
                for m in manifests
                if (m.get("platform") or {}).get("architecture") == "arm64"
            ]
            digest = (arm64 or manifests)[0]["digest"]
            config_digest = fetch_json(
                f"https://ghcr.io/v2/{IMAGE_REPO}/manifests/{digest}",
                token,
                ACCEPT_MANIFEST,
            )["config"]["digest"]
        else:
            config_digest = raw["config"]["digest"]

        created = fetch_json(
            f"https://ghcr.io/v2/{IMAGE_REPO}/blobs/{config_digest}", token
        ).get("created")
        if not created:
            continue

        epoch = datetime.fromisoformat(created.replace("Z", "+00:00")).timestamp()
        if epoch > newest_epoch:
            newest_epoch = epoch
            newest_tag = tag

    text = MANIFEST.read_text()
    match = re.search(rf"{re.escape(IMAGE)}:(sha-[0-9a-f]{{7,40}})", text)
    current_tag = match.group(1) if match else ""

    print(f"Tag actual: {current_tag or 'ninguno'}")
    print(f"Tag remoto: {newest_tag or 'ninguno'}")

    if not newest_tag or newest_tag == current_tag:
        print("Sin cambios.")
        return 0

    if not current_tag:
        print(f"No se encontró un tag de {IMAGE} en {MANIFEST}.", file=sys.stderr)
        return 1

    MANIFEST.write_text(
        text.replace(f"{IMAGE}:{current_tag}", f"{IMAGE}:{newest_tag}")
    )
    print(f"Actualizado {MANIFEST} a {newest_tag}.")

    github_output = os.environ.get("GITHUB_OUTPUT")
    if github_output:
        with open(github_output, "a", encoding="utf-8") as handle:
            handle.write(f"changed=true\ntag={newest_tag}\n")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
