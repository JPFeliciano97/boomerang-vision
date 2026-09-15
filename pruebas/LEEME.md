# Pruebas

```
npm test
```

Levanta el servidor en un puerto libre, abre Chromium, empareja una pantalla
con un mando **de verdad** por el código de sala, y pasa 72 comprobaciones.

- `0` — todo pasa
- `1` — algo falla
- `2` — **no se pudo ejecutar** (no hay navegador). Nunca sale en verde sin
  haberse ejecutado: una suite que pasa sin correr es peor que no tenerla.

## Hace falta Playwright

No es dependencia del proyecto a propósito: el servidor no la necesita y
arrastra un navegador de cientos de megas.

```
npm i -D playwright && npx playwright install chromium
```

Si ya hay una instalación por ahí, `PLAYWRIGHT_MODULE=/ruta/a/playwright/index.mjs`.
Es un override **estricto**: si se da y no carga, la ejecución sale con 2 en vez
de buscar en otro sitio.

## Por qué el navegador y no pruebas unitarias

Casi todo lo que esta app tiene que hacer bien es **geometría en píxeles**. Que
una letra mida 8,727 mm no se comprueba leyendo el código: se comprueba
midiendo la caja de tinta que el navegador dibuja con la fuente cargada. Varios
defectos reales de este proyecto eran **invisibles en el DOM** y solo salieron
al medir píxeles dibujados:

- La rejilla de Amsler a la que le faltaban dos lados. En el DOM estaban los
  cuatro `<line>` con sus coordenadas correctas; en la pantalla, media rejilla
  sin contorno, porque caían sobre el borde del `viewBox`.
- La primera fila de Pelli-Robson cortada en el píxel 0.
- Las líneas de la rejilla alternando grueso y fino por un paso fraccionario.

## Qué comprueba cada fichero

| | |
|---|---|
| `optotipos.mjs`   | Las 56 líneas de los cuatro modos y las seis pantallas: alto de tinta uniforme por línea y coincidente con el tamaño físico anunciado. Y el 20/20 a mano, que es la referencia de la que sale toda la escala. |
| `modulos.mjs`     | Los ocho módulos dibujan estímulo, sacan un solo panel, declaran su geometría y no desbordan a lo ancho en 412 px. Los tres de cerca traen su distancia fija y no ofrecen pasos. |
| `geometria.mjs`   | Amsler: los cuatro contornos con el grosor de las líneas interiores, la rejilla centrada, el paso en píxeles enteros del dispositivo, el cuadro a 1° de arco. Pelli: los ocho grises calculados, 11,5 altos de tabla, un cuarto de letra de margen. Schober: la invariancia de invertir colores y cambiar de ojo. |
| `regresiones.mjs` | Los cuatro defectos que ya estuvieron en producción una vez. |
| `sin-mando.mjs`   | La pantalla sola, sin móvil: los ocho módulos son alcanzables solo desde el mando, así que todo el armazón podría romper el uso más común sin que ninguna prueba de módulos lo notara. |

## Lo que NO comprueba

**El grosor alterno bajo DPR fraccionario.** El defecto se observó a DPR
fraccionario, donde el navegador cuantiza la posición a 1/64 de píxel CSS. La
sonda de píxeles rasteriza el SVG en un canvas, y eso **normaliza justo lo que
el defecto produce**: el navegador redibuja la imagen a la resolución del
canvas y las posiciones sub-píxel del compositor se pierden. Medido: con el
paso fraccionario reinyectado a propósito, la sonda da líneas perfectamente
uniformes a DPR 1, 1,5 y 2.

Lo que sí se comprueba es **el invariante que lo arregló** — que el paso sea un
número entero de píxeles del dispositivo — leyendo las coordenadas. Eso sí
falla con el defecto puesto, y la coordenada no miente.

**El color, en absoluto.** El módulo pseudoisocromático depende de lo que emita
el monitor; sin colorímetro las cromaticidades son las nominales de sRGB, que
es una suposición. La prueba comprueba que las láminas se dibujan y que el
módulo declara su geometría, no que el color sea el que dice.

## Que las pruebas pillen los defectos

Una prueba que pasa no vale nada si no falla cuando debe. Cada comprobación de
`regresiones.mjs` y las de la rejilla se validaron **reinyectando el defecto**
en `public/index.html` y comprobando que la ejecución se pone roja:

| Defecto reinyectado | Lo que falla |
|---|---|
| el generador lineal de tripletes | `los tripletes consecutivos están a nivel de azar` — 48 de 48 |
| la fila de contraste vuelve a persistir | `la fila NO se guarda en localStorage` |
| la barra se fuerza en cada repintado | dos comprobaciones de la barra |
| el CSS esconde la distancia en todo módulo | `el campo de distancia sigue a la vista` |
| la rejilla pegada al borde del `viewBox` | los dos contornos, al 50 % del grosor interior, y el centrado |
| el paso de la rejilla fraccionario | `el paso es un número entero de píxeles del dispositivo` |

Ese ejercicio encontró **tres fallos en las propias pruebas**, todos del tipo
que deja una suite en verde sin comprobar nada: una suite que petaba y bajaba
el total de 66 comprobaciones a 50 mientras el corredor decía «todas pasan»; el
juicio por pico en vez de por área, que no veía un contorno recortado; y un
recorte de la ventana de medida que rebanaba media línea exterior y acusaba una
rejilla perfecta.
