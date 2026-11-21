#!/usr/bin/env python3
"""Fija el tag de la imagen del portfolio en el Deployment.

El tag llega desde el repo que construye la imagen (repository_dispatch), así
que no se consulta el registro ni se adivina cuál es el más reciente.

Uso:
    python3 scripts/set-portfolio-tag.py sha-<commit>
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

IMAGE = "ghcr.io/dbarrosourr/cv-portfolio"
MANIFEST = Path("kubernetes/apps/portfolio/deployment.yaml")
TAG_PATTERN = re.compile(r"sha-[0-9a-f]{7,40}")


def main() -> int:
    if len(sys.argv) != 2 or not TAG_PATTERN.fullmatch(sys.argv[1]):
        print(f"Uso: {sys.argv[0]} sha-<commit>", file=sys.stderr)
        return 2

    tag = sys.argv[1]
    text = MANIFEST.read_text()
    pattern = re.compile(rf"({re.escape(IMAGE)}:){TAG_PATTERN.pattern}")

    if not pattern.search(text):
        print(f"No se encontró {IMAGE} en {MANIFEST}.", file=sys.stderr)
        return 1

    updated = pattern.sub(rf"\g<1>{tag}", text)
    if updated == text:
        print(f"{MANIFEST} ya apunta a {tag}.")
        return 0

    MANIFEST.write_text(updated)
    print(f"Actualizado {MANIFEST} a {tag}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
