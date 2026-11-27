@AGENTS.md

# Reglas del proyecto

- Responder siempre en español.
- **Arquitectura modular obligatoria.** Antes de crear o mover código, leer `docs/ARQUITECTURA.md` y seguirla: todo lo de un módulo vive en `src/modules/<modulo>/` (core, integraciones, repo, services, api, ui, cli, tests); `core/` es puro; las rutas de `src/app` son delgadas; un módulo no importa a otro; el armazón solo importa `modulo.ts`.
- Pruebas junto al módulo (`src/modules/<modulo>/tests/`). Herramientas de terminal en `cli/` del módulo.
- No dejar scripts sueltos de un solo uso (capturas, pruebas temporales, arreglos de datos): se borran al terminar.
- Antes de dar algo por terminado: `npm test`, `npm run typecheck` y `npm run lint` en verde.
- Las migraciones de base de datos se llaman `<fecha>_<modulo>_<tema>.sql` y nunca se editan una vez aplicadas: se agrega una nueva.
