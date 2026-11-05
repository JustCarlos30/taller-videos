#!/usr/bin/env python3
"""Efectos de sonido del taller: siempre desde la biblioteca asset-vault.

Flujo: buscar -> copiar -> registrar -> inicio (sincronía).
Nunca modifica asset-vault/library/; solo lee de ahí y escribe en projects/<slug>/.

  python3 tools/sfx.py buscar "whoosh" --max-dur 2 --limit 5
  python3 tools/sfx.py copiar library/audio/whoosh/woosh-effect-6.wav mi-video
  python3 tools/sfx.py registrar mi-video woosh-effect-6.wav --pack "SFX" --licencia "no verificada"
  python3 tools/sfx.py inicio --impacto 45 --fps 30 --peak-ms 440     # -> cuadro de inicio
"""
import argparse, json, os, re, shutil, subprocess, sys

TALLER = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VAULT = os.environ.get("ASSET_VAULT", os.path.join(os.path.dirname(TALLER), "asset-vault"))


def fail(msg):
    sys.exit(f"sfx.py: {msg}")


def project_dir(slug):
    if not re.fullmatch(r"[a-z][a-z0-9]*(?:-[a-z0-9]+)*", slug):
        fail(f"slug inválido: {slug}")
    path = os.path.join(TALLER, "projects", slug)
    if not os.path.isdir(path):
        fail(f"no existe projects/{slug}")
    return path


def vault_search(query, extra):
    if not os.path.isdir(VAULT):
        fail(f"biblioteca ausente: {VAULT}")
    cmd = [sys.executable, "-m", "vault", "search", query, *extra, "--json"]
    r = subprocess.run(cmd, cwd=VAULT, capture_output=True, text=True)
    if r.returncode:
        fail(f"vault search falló: {r.stderr.strip() or r.stdout.strip()}")
    start = r.stdout.find("[")
    try:
        return json.loads(r.stdout[start:])
    except ValueError:
        fail("respuesta de vault no es JSON")


def cmd_buscar(a):
    extra = ["--limit", str(a.limit)]
    if not a.nombre:
        extra.append("--heard")
    if a.min_score is not None:
        extra += ["--min-score", str(a.min_score)]
    if a.max_dur is not None:
        extra += ["--max-dur", str(a.max_dur)]
    if a.shape:
        extra += ["--shape", a.shape]
    if a.nombre:
        extra += ["--kind", "audio"]
    hits = vault_search(a.etiqueta, extra)
    if a.json:
        print(json.dumps(hits, ensure_ascii=False, indent=1))
        return
    for h in hits:
        an = h.get("analysis") or {}
        print(f"{h.get('planned_dest')}\n  score={h.get('score')} dur={h.get('duration')}s peak_at_ms={an.get('peak_at_ms')} "
              f"lead_ms={an.get('lead_ms')} lufs={an.get('lufs')} pack={h.get('pack')} heard={[x[0] for x in h.get('heard') or []]}")
    if not hits:
        print("sin resultados: prueba otra etiqueta/alias o --nombre")


def cmd_copiar(a):
    src = a.origen if os.path.isabs(a.origen) else os.path.join(VAULT, a.origen)
    src = os.path.realpath(src)
    lib = os.path.realpath(os.path.join(VAULT, "library"))
    if os.path.commonpath([src, lib]) != lib or not os.path.isfile(src):
        fail("el origen debe ser un archivo dentro de asset-vault/library (usa planned_dest de buscar)")
    dest_dir = os.path.join(project_dir(a.slug), "public", "audio")
    os.makedirs(dest_dir, exist_ok=True)
    name = a.nombre or os.path.basename(src)
    if not re.fullmatch(r"[\w.-]+", name):
        fail(f"nombre de destino inválido: {name} (usa letras, números, punto, guion)")
    dest = os.path.join(dest_dir, name)
    if os.path.exists(dest) and not a.forzar:
        fail(f"ya existe {dest}; usa --forzar o --nombre")
    shutil.copyfile(src, dest)
    print(f"copiado -> {dest}\nDeclara '{name}' en '- Archivos de sonido:' del brief (subcomando registrar).")


def cmd_registrar(a):
    brief = os.path.join(project_dir(a.slug), "brief.md")
    text = open(brief, encoding="utf-8").read()
    audio = os.path.join(os.path.dirname(brief), "public", "audio")
    for n in a.archivos:
        if not os.path.isfile(os.path.join(audio, n)):
            fail(f"{n} no está en public/audio/; copia primero")
    # 1) línea verificable por el candado de render
    m = re.search(r"^- Archivos de sonido:[ \t]*(.*)$", text, re.M)
    prev = [] if not m or m.group(1).strip().lower().startswith("ninguno") else [x.strip() for x in m.group(1).split(",") if x.strip()]
    todos = prev + [n for n in a.archivos if n not in prev]
    linea = "- Archivos de sonido: " + ", ".join(todos)
    text = text[:m.start()] + linea + text[m.end():] if m else text.rstrip("\n") + "\n" + linea + "\n"
    # 2) origen y licencia, añadidos a "Recursos y licencias"
    nota = f" SFX de asset-vault ({', '.join(a.archivos)}): pack {a.pack}; licencia {a.licencia}."
    r = re.search(r"^- Recursos y licencias:.*$", text, re.M)
    if r:
        text = text[:r.end()] + nota + text[r.end():]
    else:
        text = text.rstrip("\n") + f"\n- Recursos y licencias:{nota}\n"
    open(brief, "w", encoding="utf-8").write(text)
    print(f"brief.md actualizado: {linea}")


def cmd_inicio(a):
    if a.fps <= 0:
        fail("--fps debe ser > 0")
    frame = a.impacto - a.peak_ms / 1000 * a.fps
    n = round(frame)
    print(f"inicio = {n}  (exacto {frame:.2f}; impacto {a.impacto} - {a.peak_ms} ms x {a.fps} fps)")
    if n < 0:
        print(f"aviso: negativo; el pico no llega al cuadro {a.impacto}. Recorta {-n} cuadros del arranque (startFrom) o elige otro audio.")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("buscar", help="busca en la biblioteca (envuelve `python3 -m vault search`)")
    s.add_argument("etiqueta", help="una etiqueta/alias (con --nombre: texto de nombre o tag)")
    s.add_argument("--nombre", action="store_true", help="busca por nombre/tags en vez de por etiqueta acústica --heard")
    s.add_argument("--limit", type=int, default=5)
    s.add_argument("--min-score", type=float)
    s.add_argument("--max-dur", type=float)
    s.add_argument("--shape")
    s.add_argument("--json", action="store_true")
    s.set_defaults(f=cmd_buscar)
    s = sub.add_parser("copiar", help="copia un audio de library/ a projects/<slug>/public/audio/ (library queda intacta)")
    s.add_argument("origen", help="planned_dest (relativo a asset-vault) o ruta absoluta dentro de library/")
    s.add_argument("slug")
    s.add_argument("--nombre", help="nombre de destino (por defecto, el original)")
    s.add_argument("--forzar", action="store_true")
    s.set_defaults(f=cmd_copiar)
    s = sub.add_parser("registrar", help="declara archivos en el brief ('- Archivos de sonido:') y anota pack/licencia")
    s.add_argument("slug")
    s.add_argument("archivos", nargs="+", help="nombres ya presentes en public/audio/")
    s.add_argument("--pack", required=True, help="pack de origen (campo pack de la búsqueda)")
    s.add_argument("--licencia", default="no verificada", help="licencia conocida; estar en la biblioteca no la demuestra")
    s.set_defaults(f=cmd_registrar)
    s = sub.add_parser("inicio", help="cuadro donde empieza el audio para que su pico caiga en el cuadro de impacto")
    s.add_argument("--impacto", type=int, required=True, help="cuadro del evento visual")
    s.add_argument("--fps", type=float, required=True)
    s.add_argument("--peak-ms", type=float, required=True, help="analysis.peak_at_ms de la búsqueda")
    s.set_defaults(f=cmd_inicio)
    a = p.parse_args()
    a.f(a)


if __name__ == "__main__":
    main()
