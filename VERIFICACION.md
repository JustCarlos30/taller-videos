# Verificación del taller

Fecha: 27 de octubre de 2026.

- `npm test`: 9 pruebas aprobadas, ninguna fallida.
- `npm run typecheck`: aprobado.
- `docker compose config --quiet`: aprobado.
- `npm run video -- list`: proyectos `demo` y `segundo`, puertos reservados 3100 y 3101.
- `npm run video -- status`: ambos Studios detenidos al entregar.

La prueba de integración dejó sus resultados en
`verification/13ffd1f3-334d-46ce-abe1-a0fb712184f5.json`:

- Imagen Docker construida y registrada con su identificador.
- Dos Studios accesibles por HTTP, con puertos localhost independientes.
- Repetir el arranque conserva el Studio; detener uno conserva el otro.
- Un recurso añadido en vivo solo aparece en su propio proyecto.
- Exportación real a MP4, con propietario y grupo del usuario del anfitrión.
- `ffprobe`: H.264, yuv420p, 960×540, 30 fps, 90 fotogramas, 3 segundos.
- Imagen de inicio, mitad y final: `verification/demo-inicio-mitad-final.png`.

Exportación registrada:

```text
projects/demo/exports/2026-10-27T14-37-28-044Z-ccec63d1.mp4
```

Para repetir la integración: `node tests/docker-check.mjs`. Construye la imagen
si corresponde, comprueba los dos ejemplos, genera una nueva exportación y deja
sus Studios detenidos. No elimina entregas ni volúmenes.

La demo es muda y usa texto y geometría propios. No verifica audio, transcripción,
generación de voz, recursos externos ni compatibilidad editorial con redes sociales.
La investigación en `reports/` documenta esas ampliaciones; sus propuestas no son
resultados de ejecución. Para los comandos y carpetas implementados, usar `README.md`.
