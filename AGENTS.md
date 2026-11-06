# Trabajar en el taller

Fuente compartida para Claude Code y OpenCode. Inicia la sesión en esta carpeta.

## Dónde vive cada cosa

Este repo es solo el motor de producción y se publica. Lo de Carlos vive en el repo
privado `../canal/`: episodios (`canal/episodios/<slug>/`), bitácora, piezas y
sketchbooks, identidad visual, dirección creativa e investigación. `taller.local.json`
(ignorado por git) apunta la carpeta de proyectos a `../canal/episodios`, así que
`npm run video -- list|new|studio|render` trabaja sobre esos episodios. Sin ese
archivo, el taller usa su `projects/` local, donde solo está `demo`.

## Trabajo por módulos y sketchbook

Carlos pidió entrar por idea, guion, voz, subtítulos, sketchbook visual o producción
sin recorrer todas las etapas. Los workflows están en `../canal/workflows/`; lee solo
el necesario.

Para explorar ideas y diseñar secuencias en el chat no hace falta slug ni Docker.
Trabaja por cuadros clave y conserva las decisiones; no describas cada fotograma
salvo que se pida esa precisión. Acuerda slug al crear o editar un proyecto técnico.
Procesar solo voz o preparar texto de subtítulos tampoco requiere Studio.
Arranca Studio pronto al implementar o revisar visualmente una pieza; al terminar,
detén únicamente el Studio que abriste para ella, no uno ajeno a esta sesión.
La revisión editorial no autoriza renderizar ni reescribir el video completo.

La lista 1–8 de abajo regula producción técnica dentro del taller, con las
excepciones de alcance de este apartado. Las notas y bocetos del sketchbook
se guardan en `../canal/piezas/` sin crear un proyecto. El código y los recursos de
producción permanecen en la carpeta del episodio (`projects/<slug>/` en este texto
equivale a `../canal/episodios/<slug>/` con la configuración local de Carlos).

Para producción nueva, lee `PLAYBOOK.md`: historia y voz primero, piezas cortas con
alcance definido, revisiones agrupadas y reutilización de exports aprobados. En una
corrección puntual, conserva el brief y limita los cambios al tramo solicitado.

1. Selecciona explícitamente un slug con el usuario. Consulta `npm run video -- list`.
   Si falta, créalo con `npm run video -- new slug`; nunca reutilices otro video.
2. Lee `projects/<slug>/brief.md`, `video.json` y `props.json` antes de editar.
   Completa objetivo, público, guion, tiempos, formato y criterio de aprobación.
   Lee `MOTION.md` y llena "Contrato de motion" en el brief antes del código: sin él no renderiza.
3. Escribe solamente dentro de `projects/<slug>/`. Conserva trabajo existente.
   No edites otros proyectos, template, runtime, dependencias, investigación ni informes
   salvo encargo explícito de mantenimiento del taller. Una sesión por video.
4. Arranca pronto `npm run video -- studio slug` y entrega su URL localhost.
   El comando gestiona Docker, construcción y espera HTTP; no pidas `npm start`.
   Edita src, props y recursos locales mientras Studio sigue activo.
5. Recursos exclusivos en public; referencia con `staticFile()`. Animación por frame,
   sin reloj, aleatoriedad sin semilla ni assets remotos. Documenta licencias en brief.
6. Renderiza cuando se solicite: `npm run video -- render slug`. No uses el botón Render
   de Studio: el lanzador congela entradas, aísla salidas y valida mediante ffprobe.
7. Ejecuta `npm run typecheck`; revisa inicio, mitad y final y reproduce el MP4.
   Entrega ruta exacta de exports, comprobaciones realizadas y pendientes reales.
8. Si abriste Studio para la pieza en esta sesión, al terminar ejecuta `npm run video -- stop slug`, luego `npm run video -- status`.
   No detengas otro proyecto, borres exports/volúmenes ni cambies configuración global.

No hacen falta API keys, servicios de pago ni configuración de proveedores.
Skills del taller, como texto legible (Claude Code y OpenCode las siguen): `.claude/skills/sonido/SKILL.md`
(sonido, mezcla, sincronía) y `.claude/skills/motion/SKILL.md` (gramática de movimiento).
Para cuestionar un guion antes de grabar o comparar episodios, usa
`.claude/skills/cuestionar-guion/SKILL.md` (promesa, claridad, humor, recompensa y potencial de alcance).
Regla: los efectos de sonido siempre salen de asset-vault con `tools/sfx.py`; `render` exige declararlos en el brief.
Estas instrucciones no sustituyen los permisos Docker ni aíslan código hostil.

Voz o subtítulos de un video: usa `.claude/skills/voz-whisper/SKILL.md`, sigue `VOZ.md` y usa `tools/voz.py`.

## Preferencias de Carlos para los guiones

Viven en `../canal/direccion.md` (se cargan vía `AGENTS.local.md`). Resumen: hablar de
asuntos e ideas sin atribuir vivencias al espectador, sin aperturas prefabricadas ni
historia personal de fracaso por defecto; una idea central por video y la voz de Carlos.

## Notas locales

Si existe `AGENTS.local.md` en esta carpeta, léelo también: importa la dirección
creativa de `../canal/direccion.md`. Ni ese archivo ni `taller.local.json` se publican.
