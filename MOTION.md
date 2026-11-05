# Gramática de motion

Léela antes de escribir el contrato del brief. Probada solo en un tramo de 6.5 s (`projects/dia-x-b`); los números son heurística.
La meta no es esconder la IA: es que se note el criterio. Ni circo ni sutilezas.

## Regla base

Nada aparece ni desaparece. Cada objeto llega desde otro y se va por una causa.
Cada movimiento causa algo o es consecuencia de algo. Si no es ninguna, se borra.

## Cada momento

1. Un protagonista hace la acción grande.
2. Uno o dos vecinos reaccionan: los empuja, tapa, arrastra o rompe; después y con menos fuerza.
3. Lo demás se queda quieto. Tras cada llegada, 12–24 cuadros de quietud.

Solo un texto a la vez: el titular no compite con el subtítulo.

## Transiciones: las decide la voz

| Si la voz dice | Relación | Qué pasa en pantalla |
|---|---|---|
| "porque", "entonces" | Causa | Un objeto golpea o empuja, y eso crea lo siguiente |
| "pero", "en cambio" | Contraste | Corte seco: lo mismo se voltea o se invierte |
| "y", "además" | Suma | Sin transición: se agrega algo al mismo cuadro |
| "es decir", "por ejemplo" | Detalle | La cámara entra al objeto y seguimos adentro |
| "en resumen" | Cierre | Todo lo anterior se comprime en un solo objeto |
| Tema nuevo | Salto | Un objeto del video sale y arrastra a la escena nueva |

El último punto de atención de una escena es el primero de la siguiente.
Las transiciones usan el material del tema. En un video de tokens, las fichas.

## Énfasis

1. **Normal:** solo subtítulo.
2. **Palabra clave:** el objeto actúa lo que significa la palabra: "crece" crece, "olvida" borra.
3. **Idea central:** pantalla completa, máximo 3 por video, con un respiro antes.

El gesto empieza unos cuadros antes de la palabra y el impacto cae justo en ella.

## Principios

- **Anticipación:** avisa antes del golpe; lo que va a soltarse primero se comprime.
- **Puesta en escena:** una sola cosa manda por momento.
- **Acción solapada:** lo golpeado reacciona unos cuadros después.
- **Peso:** lo pesado tarda en arrancar y frenar; no todo usa el mismo `spring`.
- **Exageración:** solo en los golpes de nivel 3.

## Sonido

- Un efecto por evento con causa visible.
- El impacto cae cuando el objeto se fija, no cuando arranca.
- Si un golpe se repite, usa otra muestra.
- El sonido se ajusta después de fijar la imagen.
- **Los efectos siempre salen de asset-vault** (skill `.claude/skills/sonido/SKILL.md`, `tools/sfx.py`). Solo la base musical se sintetiza.
- **Candado (proyectos con contrato):** el contrato lleva la línea `- Archivos de sonido: a.wav, b.wav` (nombres sueltos de `public/audio/`, separados por comas) o `- Archivos de sonido: ninguno` en un video mudo. `render` se niega si falta la línea, está vacía o algún archivo no existe. `tools/sfx.py registrar` la escribe.
- El pico del audio (`peak_at_ms`) cae en el cuadro del impacto: `tools/sfx.py inicio`.

## Prohibido por defecto

- Repetir el mismo revelado en varios titulares.
- Desenfoque y fundido como salida común.
- Adornos que no cambian nada.
- Efectos a pantalla completa sin motivo escrito en el contrato.

## Revisión

Antes de aprobar: míralo en celular a velocidad normal y anota los defectos por segundo en `bitacora.md`.
