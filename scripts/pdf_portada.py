#!/usr/bin/env python3
"""Extrae la primera página de un PDF como JPEG para usarla de portada/preview.

Uso:
    python3 scripts/pdf_portada.py <entrada.pdf> <salida.jpg> [--ancho 480] [--calidad 82]

Imprime una línea JSON en stdout: {"ok": true, "salida": "...", "bytes": 12207}
o {"ok": false, "error": "..."} con código de salida 1.

ponytail: usa poppler (pdftoppm) por CLI en vez de PyMuPDF; el servidor no tiene
pip y sí trae poppler 25.03. Si algún día se instala PyMuPDF, sustituir _render_poppler.
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile

TIMEOUT_S = 20


def _fallo(mensaje):
    print(json.dumps({"ok": False, "error": mensaje}))
    sys.exit(1)


def _validar_pdf(ruta):
    if not os.path.isfile(ruta):
        _fallo(f"No existe el archivo: {ruta}")
    with open(ruta, "rb") as fh:
        if fh.read(5) != b"%PDF-":
            _fallo("El archivo no es un PDF válido")


def _render_poppler(entrada, destino_sin_ext, ancho, calidad):
    """pdftoppm -singlefile escribe exactamente <destino_sin_ext>.jpg."""
    cmd = [
        "pdftoppm",
        "-jpeg",
        "-jpegopt", f"quality={calidad}",
        "-f", "1", "-l", "1",
        "-singlefile",
        "-scale-to-x", str(ancho),
        "-scale-to-y", "-1",  # conserva la proporción original
        entrada,
        destino_sin_ext,
    ]
    subprocess.run(cmd, check=True, capture_output=True, timeout=TIMEOUT_S)


def _render_ghostscript(entrada, destino, ancho, calidad):
    """Respaldo si no hay poppler. Ghostscript no escala por ancho, usa DPI."""
    cmd = [
        "gs", "-q", "-dNOPAUSE", "-dBATCH", "-dSAFER",
        "-sDEVICE=jpeg",
        f"-dJPEGQ={calidad}",
        "-dFirstPage=1", "-dLastPage=1",
        f"-r{max(36, min(150, ancho // 4))}",
        f"-sOutputFile={destino}",
        entrada,
    ]
    subprocess.run(cmd, check=True, capture_output=True, timeout=TIMEOUT_S)


def main():
    parser = argparse.ArgumentParser(description="Genera la portada (página 1) de un PDF.")
    parser.add_argument("entrada", help="Ruta del PDF de origen")
    parser.add_argument("salida", help="Ruta del JPEG a generar")
    parser.add_argument("--ancho", type=int, default=480, help="Ancho en píxeles (por defecto 480)")
    parser.add_argument("--calidad", type=int, default=82, help="Calidad JPEG 1-100 (por defecto 82)")
    args = parser.parse_args()

    if not args.salida.lower().endswith((".jpg", ".jpeg")):
        _fallo("La salida debe terminar en .jpg")
    ancho = max(64, min(2000, args.ancho))
    calidad = max(1, min(100, args.calidad))

    _validar_pdf(args.entrada)

    destino_dir = os.path.dirname(os.path.abspath(args.salida))
    os.makedirs(destino_dir, exist_ok=True)

    # Render a temporal y luego mover: evita dejar un JPEG a medias si el proceso muere.
    with tempfile.TemporaryDirectory() as tmp:
        tmp_sin_ext = os.path.join(tmp, "portada")
        tmp_jpg = f"{tmp_sin_ext}.jpg"
        try:
            if shutil.which("pdftoppm"):
                _render_poppler(args.entrada, tmp_sin_ext, ancho, calidad)
            elif shutil.which("gs"):
                _render_ghostscript(args.entrada, tmp_jpg, ancho, calidad)
            else:
                _fallo("No se encontró pdftoppm ni gs en el servidor")
        except subprocess.TimeoutExpired:
            _fallo(f"El render superó los {TIMEOUT_S}s")
        except subprocess.CalledProcessError as err:
            detalle = (err.stderr or b"").decode("utf-8", "replace").strip()[:200]
            _fallo(f"Falló el render de la portada: {detalle or 'error desconocido'}")

        if not os.path.isfile(tmp_jpg) or os.path.getsize(tmp_jpg) == 0:
            _fallo("El render no produjo ninguna imagen")

        shutil.move(tmp_jpg, args.salida)

    print(json.dumps({
        "ok": True,
        "salida": args.salida,
        "bytes": os.path.getsize(args.salida),
    }))


if __name__ == "__main__":
    main()
