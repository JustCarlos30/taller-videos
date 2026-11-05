# Voz y subtítulos

Pipeline: `python3 -I tools/voz.py <paso|todo|entregar> <slug> [opciones]`
(python3, numpy, ffmpeg, whisper-cli con `~/.cache/whisper/ggml-small.bin`). No añade dependencias al proyecto.
Trabaja en `projects/<slug>/.work/voz/` (o `--work carpeta`). Los archivos llevan el número del paso.

## Orden de pasos
| # | paso | genera | qué revisar |
|---|------|--------|-------------|
| 0 | `entrada --entrada x.aup3` (o audio) | 00-entrada.f32/.wav | canal elegido (el de más RMS; `--canal N` para forzar) |
| 1 | `limpiar` | 01-eq.f32/.wav | **escucha 01-eq.wav** |
| 2 | `silencios` | 02-silencios.txt, 02-tramos.txt | nº de tramos razonable |
| 3 | `transcribir` | 03-whisper.json | — |
| 4 | `palabras [--fix]` | 04-palabras.json, 04-texto.txt | **compara el texto impreso con el guion** |
| 5 | `ajustar` | 05-palabras.json | lista de palabras con poca energía (< -45 dB) |
| 6 | `cortar` | 06-corte.f32, 06-cortes.json, 06-palabras.json | nº de cortes y segundos quitados |
| 7 | `masterizar` | 07-final.wav | **escucha 07-final.wav**; duración, LUFS (≈ -15), pico (≈ -1,2) |

`todo` corre 0..7 (`todo <slug> --entrada x.aup3 --fix ...`). Mejor: pasos 0-4, revisar texto, corregir con `--fix`, seguir.
Los .aup3 deben tener un solo waveclip por pista y float32.

## --fix
Objeto JSON `{"mal": "bien"}`, texto inline o ruta a un archivo. `mal` se compara palabra a palabra sin la
puntuación final; conserva la puntuación del final. Si una clave no aparece, el paso falla. Un `mal` de varias
palabras puede pasar a más o menos palabras: el tiempo se reparte en partes iguales.

## Entregar
`python3 -I tools/voz.py entregar <slug> [--nombre voz-x] [--reemplazar]` copia `07-final.wav` a
`public/<nombre>.wav` y `06-palabras.json` a `src/<nombre>.palabras.json` (nombre por defecto `voz-<slug>`).
Sin `--reemplazar` no sobrescribe nada, ni siquiera uno de los dos archivos.

## Uso en Remotion
Referencia: `projects/dia-2/src/Dia2.tsx` ~490-510 (componente `Captions`). `props.captions` es una lista de
líneas que consumen en orden las palabras del JSON (mismo nº de palabras en total, si no lanza error). Una línea
entre [corchetes] se oye pero no se muestra. Copia el componente a tu proyecto; nunca importes entre proyectos.

## Límites
- Tiempos con precisión de ±0,1 s.
- Whisper puede omitir o añadir frases, o cambiar puntuación: verifica siempre contra el guion.
- `-dtw` no sirve con el modelo small (t_dtw = -1).
- Whisper por tramos con `-ml 1` da offsets inservibles (todo al final del tramo).
- Whisper no es determinista entre corridas/versiones: un `--fix` viejo puede dejar de aplicar.
