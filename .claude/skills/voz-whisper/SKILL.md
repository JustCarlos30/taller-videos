---
name: voz-whisper
description: Prepara una grabación en español para video con limpieza, transcripción local con whisper.cpp, cortes de silencios y masterización. Conserva la toma y revisa palabras y cortes antes de entregar; no genera ni clona voces.
---

# Voz con Whisper

Whisper transcribe; FFmpeg procesa el audio. El script incluido implementa un preset de voz, no una mejora garantizada para cualquier micrófono. Compara la entrada y la salida a volumen parecido; si aparecen siseos, bombeo o pérdida de consonantes, conserva la entrada y ajusta el procesamiento al caso antes de seguir.

## Preparar

Lee `VOZ.md` y usa `tools/voz.py` desde la raíz del taller. Requiere Python 3 con NumPy, FFmpeg/ffprobe y `whisper-cli` de whisper.cpp en PATH; modelo GGML local compatible, por ejemplo small multilingüe. No descarga modelos ni instala dependencias. Identifica faltantes antes de procesar. El reconocimiento está configurado en español.

Usa el slug acordado del taller y lee su brief. El proyecto debe existir; el script trabaja dentro de `projects/<slug>/`. Usa `--work` nuevo para conservar intentos anteriores.

## Procesar por etapas

Ejemplo desde la raíz del taller, sustituyendo las rutas:

```bash
python3 -I tools/voz.py entrada mi-video --entrada /ruta/toma.wav
python3 -I tools/voz.py limpiar mi-video
python3 -I tools/voz.py silencios mi-video
python3 -I tools/voz.py transcribir mi-video --modelo /ruta/ggml-small.bin
python3 -I tools/voz.py palabras mi-video
```

Escucha `01-eq.wav`. Coteja `04-texto.txt` con lo realmente grabado y el guion: la grabación manda si cambió el texto. Whisper puede inventar u omitir palabras. Corrige con `palabras --fix /ruta/correcciones.json`, objeto `{"mal": "bien"}`; sustituye la primera coincidencia exacta de cada clave y falla si no aparece. No uses el texto aprobado para ocultar una palabra que nunca se grabó. No pases correcciones vacías.

Después del cotejo ejecuta, con el mismo slug , `ajustar`, `cortar` y `masterizar`. Inspecciona las palabras de poca energía y los cortes. No uses `todo` para saltarte esta revisión en una toma nueva.

El corte usa silencios medidos por energía, no fronteras de Whisper: conserva 120/140 ms de margen y aplica rampas de 8 ms. Puede afectar pausas expresivas; escucha cada unión y conserva pausas importantes para el humor o la intención. Los tiempos ajustados son aproximados, no alineación fonética exacta. No aceleres ni elimines frases sin encargo.

## Entregar

Escucha completo `07-final.wav`; verifica inicio/final, consonantes, respiraciones, pausas y sincronía de `06-palabras.json`. Reporta duración, LUFS y pico medidos; el preset no garantiza un objetivo exacto. Para el true peak usa FFmpeg `ebur128=peak=true`.

`entregar` copia WAV a `public/voz-<slug>.wav` y palabras a `src/voz-<slug>.palabras.json`; admite `--nombre`. Sin `--reemplazar` rechaza archivos existentes. No reemplaces tomas aprobadas por defecto. Entrega rutas, cambios realizados y escucha pendiente si no pudiste reproducirlo; métricas no equivalen a escucha.

## Límites de entrada

WAV y otros audios se convierten a mono. `--canal` solo selecciona pista de AUP3; en audio convencional se mezclan canales. Si hay voz en un canal y ruido en otro, extrae el canal correcto a un archivo nuevo antes de procesarlo. El lector AUP3 soporta un waveclip float32 por pista; para proyectos complejos exporta WAV desde Audacity. Conserva siempre el original.
