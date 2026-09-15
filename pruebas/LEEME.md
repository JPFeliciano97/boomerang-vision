# Pruebas

```
npm test
```

Levanta el servidor en un puerto libre, abre Chromium, empareja una pantalla
con un mando **de verdad** por el código de sala, y pasa 156 comprobaciones en
unos tres minutos.

- `0` — todo pasa
- `1` — algo falla
- `2` — **no se pudo ejecutar** (no hay navegador). Nunca sale en verde sin
  haberse ejecutado: una suite que pasa sin correr es peor que no tenerla.

Corre solo en cada push y en cada pull request
(`.github/workflows/pruebas.yml`).

## Hace falta Playwright

No es dependencia del proyecto a propósito: el servidor no la necesita, arrastra
un navegador de cientos de megas, y esto se despliega en Render — meterla como
`devDependency` significa que un `npm ci` en producción se baje Chromium para
nada. El CI la instala con `--no-save`, con la versión fijada para que una
actualización de Playwright no rompa la suite un martes cualquiera.

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
| `optotipos.mjs`   | Las 56 líneas de los cuatro modos y las seis pantallas: alto de tinta uniforme por línea y coincidente con el tamaño físico anunciado. Y el 20/20 a mano, que es la referencia de la que sale toda la escala. Más el juego de números, barrido en las seis pantallas y cuatro mezclas: **ninguna saca un 0**, que con `ss01` lleva barra diagonal y a 6 m es un 8. |
| `modulos.mjs`     | El corte de estímulo: que deje la pantalla del paciente sin nada en LAS DOS capas y que al reanudar vuelva el mismo test con lo que estaba puesto. Los ocho módulos dibujan estímulo, sacan un solo panel, declaran su geometría y no desbordan a lo ancho en los tres tamaños de móvil (412×915, 360×640 y 915×412), con ningún control por debajo del mínimo táctil. Los tres de cerca traen su distancia fija y no ofrecen pasos, y el menú da el veredicto de cada test antes de entrar — con la cifra que cambia con la distancia de la sala. Y el mando como gesto: `device-width` sin ancho fijo, sin pellizco, y los tres avisos largos plegados con el título delante. Más la fuente, medida carácter a carácter en las dos páginas: ninguna letra pintada con una fuente que no la tiene. |
| `geometria.mjs`   | Color: que cada lámina —cifra o figura— tenga puntos suficientes para leerse y un color distinto del fondo, midiendo el mosaico dibujado. La luz del relax, que lo que se pide sea lo que se dibuja. Amsler: los cuatro contornos con el grosor de las líneas interiores, la rejilla centrada, el paso en píxeles enteros del dispositivo, el cuadro a 1° de arco. Pelli: los grises calculados, que **ninguno quede pegado al blanco** —el defecto que dejaba dos filas invisibles— y que el techo dibujado sea 1,00 log CS, más los altos de tabla y el margen. Worth y Schober: que dibujen la **medida estándar** sin llenar la pantalla, que Worth no ofrezca tamaños imposibles, y que los anillos que se eligen sean los que se dibujan. Y la invariancia de Schober al invertir colores y cambiar de ojo. LEA: que los cuatro símbolos tengan el anillo del mismo grosor, midiendo con una transformada de distancia el p99 frente al p50 del trazo dibujado. |
| `regresiones.mjs` | Los defectos que ya estuvieron en producción una vez: los tripletes de Pelli seguidos del alfabeto Sloan, la fila de contraste heredada del paciente anterior, la barra de calibración desplegándose sola, y la distancia de sala editable desde un test. |
| `sin-mando.mjs`   | La pantalla sola, sin móvil — incluida la tecla `N`, que la corta: los ocho módulos son alcanzables solo desde el mando, así que todo el armazón podría romper el uso más común sin que ninguna prueba de módulos lo notara. |
| `arranque.mjs`    | El recorrido de un equipo nuevo: la configuración se abre sola, pide la distancia y la medida de la pantalla, muestra el QR, y un móvil que sigue ESE código llega a los ocho módulos. Nace de medir ese camino y encontrarlo roto: el QR vivía en un panel que arranca oculto, así que la suite clínica entera era invisible al abrir la app por primera vez. |
| `caidas.mjs`      | Lo que pasa cuando la conexión se cae a media prueba — el suceso más probable de todos, porque un móvil se bloquea la pantalla a los 30 s. Lo que no puede pasar: que la pantalla del paciente se quede en blanco, que el móvil vuelva a otro módulo del que está la pantalla, o que los comandos dejen de llegar sin decirlo. |
| `calibracion.mjs` | Cuánto se puede confiar en el milímetro, y si alguien lo dice donde se lee. Siembra una calibración de tarjeta **de otra pantalla** —lo que deja un portátil desconectado del monitor de la consulta— y exige que el mando lo diga, porque dentro de un módulo la barra del PC está plegada y el pie escondido. |

## Por qué unas suites van en fila y otras a la vez

Cuatro **comparten la sesión emparejada** —la misma pantalla y el mismo móvil— y
se pisarían entre sí: `optotipos`, `modulos`, `geometria` y `regresiones` van en
fila, y en ese orden, porque cada una deja la pantalla como la siguiente la
espera.

Las otras cuatro abren su propio navegador y su propia sala, así que no se
estorban y van **a la vez**. Lo que lo hace seguro es el emparejamiento por
código de sala: cada contexto genera el suyo, el mismo mecanismo que evita que
dos consultorios se pisen.

Medido: en fila la suite tardaba 247 s; en paralelo, 178 s. `Promise.all`
conserva el orden, así que la salida sigue siendo la misma lista en la misma
secuencia — una ejecución paralela que imprime distinto cada vez es imposible
de comparar con la anterior.

## El mínimo táctil, y por qué no es «44×44 y ya»

44×44 px es la referencia (Apple HIG, WCAG 2.5.5). Exigirla tal cual marca unos
treinta controles, porque el mando entero está construido sobre filas de 33-42
px de alto y **ancho completo**. Y eso no es el problema: una fila de 387×42 px
es un objetivo fácil — el dedo tiene sitio de sobra a lo ancho. Poner 44 de alto
a todo sería rediseñar los ocho paneles, no arreglar un defecto.

La regla tiene dos partes, y cada una caza una cosa distinta:

- **área** equivalente a un 44×44 (1.936 px²) — caza el botón de volver, 40×40 =
  1.600 px²;
- **lado corto** de al menos 32 px — sin esto el área sola aprobaría una astilla
  de 200×10; caza los pasos de distancia, 30×26 px.

Las dos juntas marcaron exactamente los dos controles que eran pequeños de
verdad y dejaron en paz el lenguaje visual del resto.

Y siguen cazando: al quitar los pasos de distancia del mando se borró con ellos
el CSS de la cabecera entera, que iba pegado. El botón de volver quedó en
**8,5×19 px** —el control más usado del mando, imposible de acertar— y la
cabecera se apiló en tres líneas. No se ve en el DOM, porque el botón seguía
ahí: lo dijeron estas tres comprobaciones, una por tamaño de móvil.

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

**El ancho del brazo de cada figura de color.** Lo que decide si una silueta se
lee en un mosaico de 30 puntos no es su área sino su parte más estrecha, y eso
solo se puede medir sobre la MÁSCARA — en la lámina dibujada los puntos son
puntos y una transformada de distancia mide su geometría, no la de la silueta.
Así que las seis escalas se calibraron una vez, midiendo, y las cifras están
en el comentario de `COLOR_FIGURAS` para que nadie tenga que volver a
deducirlas. Lo que la suite sí sujeta es el área y la separación cromática, que
es lo que se puede leer de lo dibujado.

**Que el mando se parezca al diseño.** Las comprobaciones miden que los
controles existan, quepan y lleguen al dedo; que el menú tenga el azulejo del
icono de cada módulo, o que la cabecera esté maquetada como el lienzo dice, no
lo mide nada — eso se revisa mirando. Lo que sí quedó sujeto es la consecuencia
medible de que se rompa: el tamaño de los controles.

**El estado «sin calibrar».** `resolveCalibration()` cae a la estimación por
monitor, que usa `monitorInches || 24`, así que `cssPxPerMM` sale > 0 siempre y
`isCalibrated: false` **no es alcanzable por la interfaz**. El aviso que sustituye
a la pantalla en negro está escrito de todos modos —una pantalla en negro no debe
ser nunca la forma en que este sistema falla— pero no hay prueba que lo recorra,
porque no se puede llegar. Lo que sí se comprueba es el estado vecino y sí
alcanzable: la calibración de otra pantalla.

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
| los pasos de distancia de 30×26 px | `ningún control demasiado pequeño para un dedo`, en los tres tamaños |
| el mando sin la nota de calibración | `el mando avisa de que la calibración no es de esta pantalla` |
| los tres rangos de Schober | `ofrece al menos una opción posible por grupo` — 3 de 3 imposibles |
| la cartilla de Pelli de ocho filas y 0,30 log | tres comprobaciones: `la fila más tenue pide 1,00 log CS y no más` (dibujaba 2,07), `los grises dibujados son los que sale el cálculo` y `ninguna fila queda pegada al blanco` — 4 filas a menos de 8 códigos del blanco |
| el tamaño de Worth y el paso de 1Δ de Schober | cuatro comprobaciones: Worth dibujaba un cartel de «NO CABE» a 6 m, ofrecía 4 botones de tamaño, Schober llenaba el 89,9 % del lado corto y con 3, 5 o 7 anillos dibujaba 2 |
| el color sin juego de figuras, y el relax con tres luces | `el color ofrece un juego de figuras` y `la luz del relax se regula de forma continua` |
| sin corte de estímulo | `el mando puede cortar el estímulo sin salir del test` |
| la pantalla muda mientras está en negro | `un mando que se recarga se reconstruye` — las dos vistas ocultas, el mando esperando para siempre |
| la N fuera de la lista blanca de teclas | `la tecla N del PC corta el estímulo también dentro de un módulo` |
| el modo de optotipo solo por el evento | `el modo que marca el mando es el que dibuja la pantalla` — la pantalla en LEA y el mando en «Letras» |
| la capa de optotipos sin esconder | ocho comprobaciones, incluida `con el mando en el menú la pantalla no enseña nada` |
| la distancia editable desde un test | `la barra muestra la distancia sin dejar editarla` |
| el `0` de vuelta en el juego de números | `el juego de números no usa el 0` — la barra diagonal de ss01 y el 8 son el mismo borrón |
| la manzana LEA rellena de antes | `los cuatro símbolos LEA tienen el anillo de grosor uniforme` — 2,62 frente a 1,91 de p99/p50 |
| Optician Sans en los rótulos de la pantalla y del mando | `ninguna letra se pinta con una fuente que no la tiene` — «Fijación», «±», «Δ» y «·» caían a la fuente de reserva |
| el viewport fijo de 412 px del mando | dos comprobaciones: `se adapta al ancho real del móvil` y `no se puede pellizcar para ampliar` |
| los avisos del mando sin plegar | dos comprobaciones: `salen plegados, sin tapar los controles` — 93, 93 y 208 px con el texto desplegado — y `tocar el título despliega el texto entero` |

La sonda del color se estrenó con uno de esos fallos y conviene que quede
escrito: agrupaba por cromaticidad TODOS los píxeles pintados, papel de la
cartilla incluido, así que las dos medias separaban «papel» de «puntos» en vez
de figura de fondo. Daba el 47 % en dos láminas y el 3 % en otras cinco, y lo
decía con mucha seguridad. Ahora solo entra el interior de los puntos —un píxel
cuenta si sus cuatro vecinos son casi idénticos— y las cifras salen entre el
5,7 % y el 12,1 %, que es lo que miden de verdad.

Ese ejercicio encontró **tres fallos en las propias pruebas**, todos del tipo
que deja una suite en verde sin comprobar nada: una suite que petaba y bajaba
el total de 66 comprobaciones a 50 mientras el corredor decía «todas pasan»; el
juicio por pico en vez de por área, que no veía un contorno recortado; y un
recorte de la ventana de medida que rebanaba media línea exterior y acusaba una
rejilla perfecta.
