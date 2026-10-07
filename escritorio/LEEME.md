# Juegos de Gonzalito para PC (Windows)

App de escritorio hecha con Electron: abre los juegos en su propia ventana, funcionan sin internet
(el modo online necesita conexión) y lo que guardás queda guardado entre una vez y otra.

- **Descargar el instalador:** https://github.com/GonzalitoDev/detector/releases/latest
- El instalador se arma solo con la tarea "Instalador de PC" (pestaña Actions de GitHub) cada vez que
  cambian los juegos en `main`, o a mano con el botón "Run workflow".
- Armarlo en tu compu: copiá los archivos del juego (`*.html`, `*.js`, `manifest.json`, `iconos/`, `vendor/`)
  adentro de `escritorio/app/`, y después `npm install` y `npm run armar` dentro de `escritorio/`.
- F11: pantalla completa.
