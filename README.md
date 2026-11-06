# Taller de videos

Taller local para producir videos cortos con [Remotion](https://www.remotion.dev/),
con React y TypeScript, animados cuadro por cuadro. Cada video es un proyecto
independiente con su propio Studio en Docker. El render es reproducible y la voz se
procesa con Whisper local. Todo corre en tu máquina: **sin API keys, sin servicios
de pago y sin render en la nube**.

Está pensado para trabajar junto a un agente de código (Claude Code u OpenCode), que
sigue las reglas de [`AGENTS.md`](AGENTS.md), y también se puede usar a mano desde la CLI.

```text
idea / guion  →  voz (grabación + whisper)  →  proyecto Remotion  →  Studio  →  render MP4
 canal/piezas/        tools/voz.py              projects/<slug>/     Docker     exports/
```

> **Nota:** el repositorio no incluye audio ni video (`.wav`, `.mp3`, `.mp4`, proyectos
> de Audacity) ni los exports. El proyecto de ejemplo `demo` es mudo; los videos
> reales de Carlos viven en un repo privado aparte (ver «Proyectos en otra carpeta»).

---

## Requisitos

### Imprescindibles (Studio y render)

| Herramienta | Versión | Para qué |
|---|---|---|
| Linux x86_64 | — | Probado en Arch. macOS/WSL no verificados. |
| [Docker Engine](https://docs.docker.com/engine/install/) + Compose v2 | Compose con `up --wait` | Studio y render corren en contenedor (Chrome, ffmpeg y Remotion dentro de la imagen). |
| [Node.js](https://nodejs.org/) | 22.23.4 (ver `.nvmrc`) | CLI del taller, tests y typecheck en el host. |
| npm | el que trae Node | `npm ci`. **No usar sudo.** |
| Internet | solo la primera vez | Descargar dependencias, la imagen base de Debian y Chrome headless. |

Recursos por contenedor: 2 CPU, 4 GiB de RAM y 512 MiB de memoria compartida. Dos
Studios abiertos pueden llegar a 8 GiB, y cada render suma hasta 4 GiB.

Tu usuario debe poder usar Docker sin sudo (`docker info` tiene que funcionar). La CLI
no cambia grupos, servicios ni permisos del sistema.

### Opcionales: voz y subtítulos (`tools/voz.py`)

Solo hacen falta si vas a procesar grabaciones de voz y generar subtítulos sincronizados.

| Herramienta | Para qué | Instalación orientativa |
|---|---|---|
| Python 3.10+ | Ejecutar el pipeline | `pacman -S python` / `apt install python3` |
| numpy | Análisis de energía y cortes | `pacman -S python-numpy` / `pip install numpy` |
| ffmpeg + ffprobe | Limpieza, EQ, normalización a ≈ -14 LUFS | `pacman -S ffmpeg` / `apt install ffmpeg` |
| [whisper.cpp](https://github.com/ggml-org/whisper.cpp) (`whisper-cli` en el `PATH`) | Transcripción local con tiempos por palabra | Paquete de tu distro (`whisper.cpp` en AUR) o compilarlo desde el repositorio |
| Modelo `ggml-small.bin` | Modelo de Whisper, en español | Descárgalo a `~/.cache/whisper/ggml-small.bin` (o usa `--modelo ruta`) |
| Audacity *(opcional)* | Grabar y exportar `.aup3` | `--entrada` acepta `.aup3` o cualquier audio que lea ffmpeg |

Descargar el modelo:

```bash
mkdir -p ~/.cache/whisper
curl -L -o ~/.cache/whisper/ggml-small.bin \
  https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin
```

Para comprobar que tienes todo:

```bash
python3 -c "import numpy; print('numpy', numpy.__version__)"
ffmpeg -version | head -1
whisper-cli --help | head -1
ls ~/.cache/whisper/ggml-small.bin
```

### Opcionales: efectos de sonido (`tools/sfx.py`)

`sfx.py` busca y copia efectos desde una biblioteca local **asset-vault**, que no forma
parte de este repositorio. Por defecto la busca en `../asset-vault`, junto al taller;
para otra ubicación define `ASSET_VAULT=/ruta/a/asset-vault`. Esa biblioteca debe
exponer `python3 -m vault search` y una carpeta `library/`. Sin ella, el resto del
taller funciona igual.

---

## Inicio rápido

```bash
git clone https://github.com/JustCarlos30/taller-videos.git
cd taller-videos
npm ci

npm run video -- studio demo        # primer arranque: construye la imagen (tarda unos minutos)
```

Abre la URL `http://127.0.0.1:31xx` que imprime el comando. Para crear tu propio video:

```bash
npm run video -- new mi-video       # copia la plantilla y reserva un puerto
npm run video -- studio mi-video    # Studio con recarga en vivo
# edita projects/mi-video/src, props.json y video.json
npm run typecheck
npm run video -- render mi-video    # MP4 en projects/mi-video/exports/
npm run video -- stop mi-video
```

`demo` y `segundo` son ejemplos mudos, sin recursos externos, que sirven para comprobar
la instalación.

---

## Comandos

Todos se ejecutan con `npm run video -- <comando>`:

| Comando | Qué hace |
|---|---|
| `new slug` | Copia la plantilla y reserva un puerto libre entre 3100 y 3999. Rechaza duplicados y slugs inseguros. No necesita Docker. |
| `studio slug` | Arranca el Studio en segundo plano y espera a que responda. Si ya está activo, devuelve la misma URL. |
| `render slug` | Congela `src`, `public`, la configuración, las props y el brief en `.work/renders/<fecha-uuid>/` y renderiza H.264 (yuv420p, CRF 18). Después valida el resultado con ffprobe y guarda `<nombre>.mp4.json`. Nunca sobrescribe un export. |
| `list [slug]` | Muestra los proyectos, sus puertos y cuántos MP4 tiene cada uno. Funciona sin Docker. |
| `status [slug]` | Indica qué Studios están activos y su nombre en Compose. |
| `stop slug` | Detiene solo ese Studio. Conserva el código, los exports y los volúmenes. |

Los comandos se serializan con un lock local. Si llega un segundo comando durante una
operación, devuelve un error claro: repítelo cuando termine la primera.

> Para renderizar usa `npm run video -- render`, no el botón Render del Studio. La CLI
> congela las entradas, aísla la salida y valida el MP4.

### Voz y subtítulos

```bash
python3 -I tools/voz.py todo mi-video --entrada grabacion.aup3   # pasos 0–7
python3 -I tools/voz.py entregar mi-video                        # copia la voz y las palabras al proyecto
```

El pipeline va paso a paso (entrada → limpiar → silencios → transcribir → palabras →
ajustar → cortar → masterizar), y conviene revisar cada etapa. La documentación completa,
incluido cómo corregir la transcripción con `--fix`, está en [`VOZ.md`](VOZ.md).

### Efectos de sonido

```bash
python3 tools/sfx.py buscar "whoosh" --max-dur 2 --limit 5
python3 tools/sfx.py copiar library/audio/whoosh/archivo.wav mi-video
python3 tools/sfx.py registrar mi-video archivo.wav --pack "SFX" --licencia "..."
```

`render` exige que los efectos usados estén declarados en el brief del proyecto.

---

## Estructura

```text
bin/video.mjs            entrada de la CLI
lib/workshop.mjs         proyectos, puertos, Docker y snapshots
runtime/                 lanzador del contenedor y configuración de Remotion
Dockerfile, compose.yaml imagen compartida y servicios por slug
template/                plantilla que copia `new` (los videos nunca la importan)
tools/voz.py             pipeline de voz y subtítulos (Whisper)
tools/sfx.py             efectos de sonido desde asset-vault
projects/<slug>/
  brief.md               objetivo, guion, contrato de motion, licencias y aprobación
  video.json             composición: tamaño, fps y duración
  props.json             textos y datos iniciales
  src/                   composiciones React del video
  public/                recursos propios, usados con staticFile()
  exports/               MP4 y metadatos de ffprobe (no versionados)
.claude/skills/          skills del taller: motion, sonido, voz-whisper y cuestionar-guion
PLAYBOOK.md              cómo planear y producir por piezas
MOTION.md                gramática de movimiento (obligatoria antes de renderizar)
VOZ.md                   detalle del pipeline de voz
tests/                   tests de la CLI y verificación real con Docker
```

### Proyectos en otra carpeta

Por defecto los proyectos viven en `projects/`. Para guardarlos en otro sitio (por
ejemplo, un repo privado con tus videos) crea `taller.local.json` en la raíz:

```json
{"projects": "../mis-videos/episodios"}
```

La ruta puede ser relativa a la raíz del taller y debe ser una carpeta real, no un
enlace simbólico. La variable `VIDEO_PROJECTS` tiene prioridad sobre el archivo.
`taller.local.json` está ignorado por git. Las skills genéricas, sin rutas del taller,
están en [skills-videos-cortos](https://github.com/JustCarlos30/skills-videos-cortos).

---

## Cómo trabaja el contenedor

- Solo se monta el proyecto elegido, en modo lectura. Durante el render se monta además
  su carpeta de salida, con escritura.
- `node_modules` y Chrome viven dentro de la imagen, en `/app/node_modules`.
- El contenedor corre con tu UID/GID, `no-new-privileges` y sin acceso al socket de
  Docker. El puerto se publica solo en `127.0.0.1`.
- El nombre de la imagen depende del contenido del Dockerfile, el lockfile, el runtime y
  `tsconfig.json`. Si alguno cambia, detén y vuelve a arrancar los Studios.
- El aislamiento está pensado para trabajos de confianza. **No es un sandbox para
  código hostil.**

## Comprobaciones

```bash
npm test                     # tests de la CLI con un motor Docker simulado
npm run typecheck
docker compose config --quiet
node tests/docker-check.mjs  # verificación real: build, Studio, aislamiento y render
```

Para ver los logs de un Studio, usa el nombre que muestra `status`:

```bash
docker compose -p NOMBRE logs --tail=100 studio
```

Problemas frecuentes:

- **Docker deniega acceso:** revisa `docker info`. La CLI no cambia grupos ni servicios del sistema.
- **El primer build tarda:** está descargando Debian, Chrome y las dependencias. No está esperando nada de ti.
- **Falta un recurso:** revisa que esté en `public/`, su nombre y la llamada a `staticFile()`. Los enlaces simbólicos se rechazan.
- **H.264 falla:** las dimensiones deben ser pares y los fps y la duración, enteros positivos.
- **Quedó un lock tras una caída:** el siguiente comando lo retira solo si su PID ya no existe. Nunca limpies con `down --volumes`.

## Uso con agentes de código

[`AGENTS.md`](AGENTS.md) es la fuente común de reglas para Claude Code y OpenCode, y
`CLAUDE.md` la importa. Inicia la sesión desde la raíz del taller e indica el slug del
proyecto. Las skills de `.claude/skills/` son texto legible y cualquier agente puede
seguirlas. Si existe `AGENTS.local.md` (ignorado por git), se carga como notas personales.

## Licencias

- **Remotion** tiene [licencia propia](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md):
  es gratuito para personas y equipos pequeños elegibles, y las empresas que no lo son
  necesitan una Company License. Renderizar en local no equivale a una licencia comercial gratuita.
- React (MIT), TypeScript (Apache-2.0) y Node, FFmpeg y Chrome, con sus propias condiciones.
- Las fuentes tipográficas incluidas en `projects/*/public/` llevan su licencia al lado
  (por ejemplo `Archivo-OFL.txt`, SIL Open Font License).
- Los efectos de sonido de asset-vault no se distribuyen aquí. Revisa la licencia de cada
  pack antes de publicar un video.
