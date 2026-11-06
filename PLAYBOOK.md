# Playbook para videos con piezas cortas

Cuenta la historia con voz, capturas, referencias y cortes sencillos. Genera motion para explicar una idea o conectar dos momentos concretos. Conserva el humor y la energía de Día 1.

El ahorro se busca cerrando decisiones antes de programar, reutilizando piezas aprobadas y corrigiendo un tramo delimitado. Un clip corto también puede acumular muchas revisiones: `tokens-intro` tiene 24 exports de 2–7 segundos.

## Qué producir

| Material | Uso | Trabajo del agente |
|---|---|---|
| Voz y captura real | Problema, prueba y resultado | Ordenar y recortar; conservar una toma aprobada |
| Referencia o chiste | Dar contexto o personalidad | Elegir uno que sirva al momento; registrar procedencia |
| Puente de 1–2 s | Cambio de idea con relación visible | Reutilizar una pieza o crear solo el movimiento necesario |
| Explicación animada de 2–6 s | Mostrar algo difícil de capturar | Un protagonista y una acción que explique |
| Montaje final | Unir las piezas con la voz | Colocación y ajustes de tiempos; conservar clips aprobados |

**Piloto para un video de 45–60 s:** hasta dos puentes de 1–2 s y una explicación breve, con unos 6–10 s de motion total. Es una hipótesis de trabajo, no una regla universal de duración. Usa un corte directo cuando basta; poner una transición de dos segundos entre todas las frases recrearía la saturación.

## Primero cerrar la historia

Se puede entrar por idea, voz existente o sketchbook; no es obligatorio recorrer
todas las etapas. El sketchbook se conversa por secuencias en el chat y conserva
las decisiones. Las guías están en `../canal/workflows/` y las notas en `../canal/piezas/`. Los tiempos son provisionales hasta cerrar
la voz; la composición puede explorarse antes de grabar.

1. Escribe una frase: «quiero que quien vea esto entienda ___ porque ___».
2. Recoge cómo Carlos cuenta el asunto y elige una estructura acorde: observación y contraste, pregunta y demostración, comparación, explicación o proceso. Problema → intento → descubrimiento es una opción, no una obligación. Identifica los ejemplos hipotéticos; no inventes experiencias.
3. Graba una voz provisional. Marca dónde va una captura, un chiste y la única explicación que necesita animación.
4. Diseña cuadros clave con texto real para las secuencias que lo necesiten; acuerda foco, encuadre y materialidad. Haz un borrador con voz e imágenes quietas. Carlos revisa si se entiende, despierta curiosidad y suena a él. Una idea o composición elegida no equivale a aprobar el ritmo del montaje.
5. Ajusta el guion y cierra la voz antes de programar. Una corrección factual puede reabrirlo; entonces actualiza solo las piezas afectadas.

Ejemplo para tokens: plantear que una conversación larga ocupa contexto; mostrar el chat; representar cómo crece lo que debe procesarse; cerrar con la consecuencia práctica. La explicación técnica se comprueba antes de animarla. La captura lleva la historia y el motion revela lo que la interfaz no muestra.

## Ficha mínima por pieza

Se guarda en el brief del proyecto que la produce, junto al contrato de [MOTION.md](MOTION.md).

```text
Pieza y slug acordado:
Idea que debe entenderse:
Frase exacta de la voz y tramo en el montaje:
Duración, fps y dimensiones:
Cuadro de entrada → acción → cuadro de salida:
Recursos locales y procedencia:
Referencia visual elegida y qué tomamos de ella:
Qué permanece fijo: voz, paleta, tipografía, archivos aprobados.
Hecho si: legible en celular, conexión A→B clara, audio revisado.
```

La gramática de motion dirige las piezas animadas. El montaje de capturas y voz puede usar cortes directos. Estudia referencias como NullMotion para decidir atención y continuidad; escoge una técnica concreta y llévala al tema propio. Una skill entra cuando resuelve una necesidad definida por esta ficha.

## Producir con el Docker existente

Acuerda un slug nuevo para cada pieza nueva. Ejecuta desde `taller-videos/`; sustituye `pieza-slug` por ese nombre.

```bash
npm run video -- new pieza-slug
npm run video -- studio pieza-slug
```

Completa `brief.md`, `video.json` y `props.json`; implementa dentro de `projects/pieza-slug/`. Para 1–2 segundos a 30 fps, usa `durationInFrames` de 30–60 y una composición que respete esa configuración. Copia únicamente recursos necesarios a `public/`; no importes código desde otro proyecto.

Revisa en Studio entrada, acción y salida. Usa el punto de atención final de A como entrada del puente y termina cerca del foco de B. Si la transición necesita ver A y B, incluye sus imágenes o clips locales en la pieza y registra sus tiempos.

```bash
npm run typecheck
npm run video -- render pieza-slug
npm run video -- stop pieza-slug
npm run video -- status pieza-slug
```

El render conserva entradas y verifica el MP4. Después hay que verlo y escucharlo. Guarda la ruta exacta del export aprobado, duración, entrada/salida y recursos en su brief y ficha de bitácora.

El lanzador actual exporta la composición completa en **H.264 opaco**. Una pieza de dos segundos es un proyecto de dos segundos; no existe un argumento de rango en esta CLI. No ofrece transparencia para superponerla sobre cualquier captura. Con este flujo entrega un puente de cuadro completo, o integra sus imágenes A/B dentro del puente. Exportar con alfa requeriría un cambio aparte.

Editar `src`, props o recursos mantiene el mismo runtime; el taller solo construye una imagen si falta la correspondiente. No reconstruyas dependencias para cambiar un texto. Respeta los límites actuales de Docker y detén el Studio de la pieza al terminar.

## Revisar sin rehacer el video

- Primera pasada: movimiento y legibilidad con recursos provisionales.
- Carlos agrupa comentarios por segundo: «0.6 s, texto pequeño; 1.2 s, salida brusca». Una lista por revisión.
- Una pasada de correcciones y una de acabado como objetivo inicial. Si persiste el problema, vuelve a la ficha y decide qué cambiar antes de otro intento.
- Congela la pieza aprobada. Un comentario del montaje modifica el corte o la pieza indicada; no reabre escenas vecinas automáticamente.
- El montaje completo sigue siendo necesario para continuidad, ritmo y audio. Se arma con clips aprobados y capturas; la IA no necesita reescribir todas sus animaciones.

Reutiliza primero un MP4 si el contenido coincide. Si cambia el texto o dato, copia la pieza aprobada al proyecto nuevo mediante el flujo del taller y ajusta props. Si cambia el significado, revisa también la acción: cambiar etiquetas no vuelve apropiada cualquier animación.

## Encargo compacto al agente

```text
Trabaja en projects/<slug-acordado>/.
Lee AGENTS, el brief y MOTION; después solo archivos necesarios del proyecto.
Resuelve esta pieza de <duración>, que comunica <idea>.
Entrada: <A>. Acción: <causa>. Salida: <B>.
Usa <recurso aprobado>. Conserva <voz, paleta, tipografía y partes aprobadas>.
Primero revisamos la pieza en Studio; renderiza cuando se solicite.
Agrupa cambios y entrega defectos con segundo, sin rediseñar el resto del video.
```

Mantén la sesión mientras siga siendo útil y respeta los límites del host. Para un relevo, transmite la ficha, archivos afectados, export vigente y siguiente cambio. El tamaño del clip no exige una sesión nueva ni un subagente nuevo. Evita recargar el video completo, catálogos de skills o logs extensos para corregir una pieza. Este playbook no cambia modelos, esfuerzo ni topes globales.

## Comprobar el ahorro

Registra al iniciar y terminar cada bloque: cliente, sesión, modelo, entrada nueva, escritura y lectura de caché, salida y razonamiento cuando se reporten. Conserva sus categorías originales: algunos clientes incluyen caché en entrada o razonamiento en salida. Deduplica mensajes y usa diferencias entre acumulados; no sumes cada captura del contador.

En la bitácora del siguiente video añade:

| Bloque | Sesión | Tokens iniciales/finales por categoría | Intentos | Export aprobado | Segundos usados |
|---|---|---|---|---|---|
| Guion y voz | | | | | |
| Puente A | | | | | |
| Explicación | | | | | |
| Montaje | | | | | |

Separa infraestructura reutilizable, producción y análisis posterior. Compara piezas de dificultad similar, con el mismo cliente/modelo y un criterio de calidad común. El piloto gana si baja consumo e intentos y conserva comprensión, energía y continuidad. Los porcentajes de ahorro y los dólares quedan pendientes de esa medición; la factura es una fuente distinta del contador de tokens.
