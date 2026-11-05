---
name: motion
description: Movimiento de los videos del taller (taller-videos/projects/<slug>) en Remotion: contrato de motion, spring/interpolate por cuadro, causalidad, énfasis, quietud y revisión. Úsala solo al trabajar un video del taller en Remotion; no aplica fuera de taller-videos.
---

# Motion del taller

Aplica y amplía `MOTION.md` (no lo contradice; si dudas, manda MOTION.md). Fuentes: `MOTION.md`,
`reports/Awesome Opus para el taller.md` (siete fichas, citadas como «ficha X») y el catálogo
`research_notes/awesome-opus5-5-videos/data/videos.json`. Las reglas marcadas **(criterio propio)** no
vienen de una fuente.

## Cuándo usarla

Al escribir o cambiar animación de un video del taller, y antes de llenar el "Contrato de motion" del brief.
Para sonido usa la skill `sonido`; MOTION.md#Sonido manda en eventos y candado.

## Flujo

1. Cierra primero la historia y la voz (PLAYBOOK). Sin frase de voz no hay relación de transición.
2. Llena el **Contrato de motion** del `brief.md`: idea de autor, objeto causante, golpes (máx. 3),
   transiciones (voz → relación → qué pasa), énfasis, llegadas/salidas, sonido. `render` se niega si queda una línea vacía.
3. Escribe el código desde el contrato: un evento por línea del contrato, con su cuadro.
4. Revisa cuadros de entrada, acción y salida en Studio; luego reproducción continua (ficha verbove: un contacto
   detecta composición, no legibilidad temporal). Después, el sonido.

## Reglas (con porqué y fuente)

- **Nada aparece ni desaparece**: cada objeto llega desde otro y sale por una causa. Si un movimiento no causa
  nada ni es consecuencia, se borra. (MOTION.md, regla base)
- **Un protagonista, uno o dos vecinos, el resto quieto**; tras cada llegada 12–24 cuadros de quietud. Un solo texto
  a la vez. (MOTION.md; el 12–24 es heurística probada solo en `dia-x-b`)
- **La voz decide la transición** (causa, contraste, suma, detalle, cierre, salto: tabla de MOTION.md). En video
  mudo decide la música y el contrato, como en opus-5s.
- **Un recipiente fijo y una magnitud activa** para explicar una acumulación; di que es metáfora, no
  funcionamiento literal. (ficha Ror_Fly; solo se vieron 12 muestras de un preview)
- **Un objeto enlaza dos estados con una causa visible** en 1-2 s; sin exigir "never cut" ni loop si el montaje
  avanza. (ficha twoclipping; resultado visual no comprobado)
- **Datos reales y texto con espacio propio**: entrada y salida de cada contenido separadas para que no se solapen;
  acuerda texto, dato y momento de lectura antes de programar. (ficha verbove)
- **El beat es variable, no mandato**: un impacto alineado con la palabra importante, no actividad en cada beat.
  Compara con una versión sin efecto. (ficha prasenx; la ventaja del sonido sintetizado es hipótesis)
- **Personaje en estados**: anticipa, actúa, se recupera; el humor va en la consecuencia, no en partículas.
  (ficha zacxbt; MOTION.md: anticipación y acción solapada)
- **3D o cámara solo si revela una relación**: trayectoria fija y un único descubrimiento; si una captura o un
  esquema lo dice igual de claro, sin 3D. (ficha LexnLin)
- **Compón antes de generar**: reserva el lugar del texto y revisa el video completo. El export es H.264 opaco:
  sin overlays con alfa. (ficha anabology)
- **Énfasis en 3 niveles** (subtítulo / el objeto actúa lo que dice la palabra / pantalla completa, máx. 3 por
  video, con respiro). El gesto empieza unos cuadros antes y el impacto cae en la palabra. (MOTION.md)
- **Peso**: no todo usa el mismo `spring`; lo pesado arranca y frena más lento. (MOTION.md)

## Patrones Remotion

Todo depende solo de `useCurrentFrame()`: nada de reloj, `setTimeout`, `Date.now`, `Math.random` sin semilla,
CSS transitions/animations ni estado acumulado (ficha zacxbt: no copiar el bucle `rAF`).

```tsx
const f = useCurrentFrame(); const {fps} = useVideoConfig();
// llegada con rebote: spring relativo a su cuadro de inicio
const s = spring({frame: f - 120, fps, config: {damping: 7, stiffness: 140, mass: 0.7}});
// tramo lineal acotado
const t = interpolate(f, [100, 118], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
```

- Gancho pesado (opus-5s): `spring` con `damping: 14, stiffness: 120, mass: 0.8`; escala `2.4 + (1 - 2.4) * s`.
- Anticipación: comprime o echa hacia atrás con un `interpolate` unos cuadros antes del impacto.
- Reacción solapada del vecino: la misma curva con `f - (inicio + 3..6)` y menos amplitud **(criterio propio)**.
- Rebote tras impacto (opus-5s): `amp * Math.exp(-d / 5) * Math.sin(d * 0.9)` con `d = f - impacto`.
- Quietud: tras la llegada, `interpolate` con `clamp` deja el valor final; no sigas animando.
- Escenas: `<Sequence from durationInFrames>`; dentro, `useCurrentFrame()` ya es relativo.
- Sacudida u oscilación: funciones puras de `f`, nunca estado.

## Prohibido

- Aparecer o desaparecer por opacidad sin causa; desenfoque y fundido como salida común.
- Repetir el mismo revelado en varios titulares; adornos que no cambian nada.
- Efectos a pantalla completa sin motivo escrito en el contrato; más de 3 golpes de nivel 3.
- Importar de una referencia más que la técnica pedida (ocho estados, loop, mundo navegable, APIs, presupuesto abierto).
- Decir que una técnica del catálogo "funciona" o es viral: son 703 registros (369 motion, 117 3D, 116 explainer,
  101 interactivo), un catálogo y no un ranking, sin métricas. Las etiquetas frecuentes (canvas 267, svg 183,
  threejs 131) indican herramientas de origen web, no calidad, y no son el stack del taller (Remotion).

## Checklist antes de render

- [ ] Contrato de motion completo; cada golpe del contrato tiene su cuadro en el código.
- [ ] Nada aparece sin llegar de otra cosa; 12-24 cuadros de quietud tras cada llegada.
- [ ] Un solo texto a la vez, sin solapes; legible en celular.
- [ ] Máx. 3 golpes de nivel 3, cada uno con motivo escrito.
- [ ] Animación solo por cuadro (sin reloj ni estado): mismo cuadro, mismo resultado.
- [ ] Revisados cuadros de entrada, acción y salida, y luego la reproducción continua.
- [ ] Sonido ajustado al final (skill `sonido`); defectos por segundo anotados en `bitacora.md`.
