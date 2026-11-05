---
name: sonido
description: Sonido de los videos del taller (taller-videos/projects/<slug>): efectos, golpes, whooshes, mezcla y sincronía. Úsala solo al trabajar un video del taller en Remotion; los efectos salen siempre de la biblioteca asset-vault, nunca se sintetizan ni se descargan. No aplica fuera de taller-videos.
---

# Sonido del taller

Regla: **todo efecto de sonido sale de asset-vault** (`/home/carlosj/Carlos_World/asset-vault`).
Solo la base musical (kick, bajo, hats, acordes, clics) se sintetiza en código (`tools/synth.py` de
cada proyecto). `render` se niega si el brief no declara los archivos de `public/audio/` que existen.
Antes: `MOTION.md#Sonido` (un efecto por evento con causa visible) y la skill `sound-library` de la biblioteca.

## Flujo

1. **Lista de eventos.** Del contrato de motion: cada golpe, vuelo, giro o aterrizaje con causa visible
   y su cuadro de impacto. Sin causa visible no hay efecto.
2. **Buscar** (una etiqueta o alias por consulta, haz varias para capas):
   `python3 tools/sfx.py buscar "whoosh" --max-dur 2 --limit 5` (añade `--json` para ver todo).
   Sin escuchar, no afirmes cómo suena: la etiqueta es una propuesta de CLAP. Si hay reproducción,
   preescucha con `ffplay -nodisp -autoexit <ruta>`.
3. **Copiar** el elegido (usa `planned_dest`): `python3 tools/sfx.py copiar library/audio/... <slug>`.
   Nunca edites `asset-vault/library/`. Si un golpe se repite, elige otra muestra.
4. **Registrar** en el brief: `python3 tools/sfx.py registrar <slug> a.wav b.wav --pack "<pack>" --licencia "..."`.
   Escribe la línea `- Archivos de sonido: a.wav, b.wav` (o `ninguno` para video mudo) y anota pack y
   licencia en "Recursos y licencias". Estar en la biblioteca no demuestra licencia: si no se conoce, escribe "no verificada".
5. **Sincronía.** El pico del audio (`analysis.peak_at_ms`) cae en el cuadro del impacto, no el inicio:
   `python3 tools/sfx.py inicio --impacto 45 --fps 30 --peak-ms 440` → cuadro donde monta el
   `<Sequence from=...>`. Si da negativo, recorta el arranque del audio u otro efecto.
   Ajusta el sonido después de fijar la imagen.
6. **Mezcla.** Un `<Audio>` por efecto dentro de `<Sequence durationInFrames>` con la cola justa.
   Referencia (opus-5s): sumando todo picaba 0 dB; con música ×0.6 y SFX ×0.55 quedó en -15,2 LUFS,
   pico -1,8 dB. Mide el MP4 final (`ffmpeg -i out.mp4 -af ebur128=peak=true -f null -`) y
   baja el conjunto si el pico supera -1 dB.
7. **Candado.** Antes de renderizar, el brief debe tener `- Archivos de sonido:` con cada archivo
   presente en `public/audio/`. Detalle en `MOTION.md#Sonido`.

## No hagas

- Sintetizar o descargar efectos, o usar audio fuera de la biblioteca.
- Copiar a ojo toda una categoría: solo lo que tiene evento.
- Reanalizar, instalar modelos o usar la red para buscar.
- Editar otros proyectos.
