# Notas para trabajar en este repo

## Pull requests

**Antes de empujar a una rama que tiene una PR abierta, comprobar si esa PR ya
se fusionó.** Una PR fusionada no se puede volver a fusionar, así que los
commits que llegan después quedan colgados en la rama sin que nadie los vea —
ha pasado dos veces (#4 y #5, las dos fusionadas a los pocos minutos de
abrirse, mientras el trabajo seguía).

Cuando ya está fusionada: `main` contiene el último commit de esa PR, así que
la base común con la rama es ese commit y **una PR nueva desde la misma rama
muestra solo lo posterior**, sin duplicados. No hace falta rebase ni
force-push.

No abrir PRs sin que se pidan.

## Pruebas

```
npm test
```

Levanta el servidor en un puerto libre, abre Chromium y empareja una pantalla
con un mando de verdad por el código de sala. Sale con `0` si todo pasa, `1` si
algo falla y `2` si **no pudo ejecutarse**. Detalle en `pruebas/LEEME.md`.

**Playwright no es dependencia del proyecto y no debe añadirse.** El servidor
no la necesita, arrastra un navegador de cientos de megas, y esto se despliega
en Render: un `npm ci` allí se bajaría Chromium para nada. El CI la instala con
`--no-save` y con la versión fijada.

**Una comprobación nueva se escribe antes del arreglo y se ve fallar** contra
el código de antes. Una prueba que pasa no vale nada si no falla cuando debe;
ese ejercicio ya encontró tres fallos en las propias pruebas.

## Lo que este proyecto es

Una herramienta para **tomar** los test, no para registrarlos. No hay historial
ni exportación, y no se van a añadir.

Casi todo lo que tiene que hacer bien es **geometría en píxeles**: cada módulo
declara su estímulo en grados de arco y comprueba si cabe de verdad en la
pantalla, a la distancia de la sala. Los defectos más caros han sido invisibles
en el DOM — la rejilla de Amsler tenía sus cuatro `<line>` con las coordenadas
correctas y en pantalla le faltaban dos lados. Por eso se mide lo dibujado.

**La distancia de la sala se PIDE una vez y se corrige en el panel.** La
configuración inicial se abre sola la primera vez —sin calibrar— y no vuelve a
plantarse; después la distancia se edita en el panel del PC, en el grupo «La
sala».

Esta regla ha cambiado tres veces y conviene saber qué se conserva. Primero
hubo dos pasos de ±0,5 m en el mando; después se quitaron enteros, con el
criterio de que la distancia es una propiedad de la SALA y no un mando por
test; y ahora vuelve a ser editable, porque tenerla solo detrás del diálogo
obligaba a pasar por él para corregir un número.

**Lo que se conserva es lo único que de verdad importaba: que un cambio no sea
invisible.** Editarla nunca fue el riesgo; el riesgo era editarla sin que la
geometría lo dijera. Al cambiarla se rehace la escala y se repinta, así que la
cifra que el test declara cambia delante de quien la toca, y hay una
comprobación que lo exige: al acercar medio metro, el 20/20 tiene que medir
menos en la misma proporción. **El mando del móvil sigue sin tocarla**, y eso
también está sujeto.

**Un módulo no ofrece opciones imposibles.** Si ninguna cabe a la distancia de
la sala, o no hay opción que dar, o hay que dar una que sí. Worth ofrecía
1,25°, 2° y 3° y a 6 m los tres decían «no cabe»; se arregló primero con un
«máx» y después quitando la elección entera: ahora Worth y Schober dibujan una
**medida estándar** —el 80 % del lado corto de la pantalla— que cabe por
construcción, y lo que se dice es la cifra que sale de ella (el ángulo del
punto, el rango en Δ). En Schober lo que se elige son los anillos visibles, y
todos se dibujan: el plato fija el RANGO y los anillos la RESOLUCIÓN.

Y la pantalla del paciente **nunca** se queda en negro sin explicación.

**Lo que la pantalla no puede emitir no se pide.** El Pelli-Robson llegaba a
2,10 log CS en ocho filas de 0,30 y las dos últimas salían en código 253 y 254
sobre un blanco de 255 — un contraste que ningún panel dibuja. El paciente
«fallaba» un contraste que nunca se pintó. Va de 0 a 1,00 log en cinco filas, y
el gris más tenue queda a doce códigos del blanco.

## Las cartillas de Ishihara

No se reproducen, ni se trazan, ni se extraen de ninguna fuente. El módulo de
color implementa el método publicado de las líneas de confusión del CIE 1931,
con numeración propia, y dice en el propio mando lo que no es: criba, no
clasifica, y el color depende de lo que emita ese monitor.

Hay dos juegos de láminas: cifras y **figuras**, para el niño que no dice
«veintiséis». Es la misma prueba con otra máscara. Las seis siluetas están
**calibradas**, no puestas a ojo: escala que deja el área en el 20 % del disco
y brazo más estrecho por encima de tres puntos del mosaico, medido con una
transformada de distancia. La tabla con las cifras está en el comentario de
`COLOR_FIGURAS`. Una silueta fina no es una silueta: la estrella y la cruz
salieron en 2,6 y 2,5 puntos y hubo que engordarlas.

**El tamaño de la cifra depende de cuántos dígitos son.** En consulta costaba
distinguir el 6 del 5, que es lo que pasa cuando al trazo le faltan puntos del
mosaico. Un dígito solo cabe mucho más grande — a media altura la cuerda del
disco es el diámetro entero — y dos ocupan el doble de ancho: `UN_DIGITO` 0,82 y
`DOS_DIGITOS` 0,64 del disco. Medido sobre la lámina dibujada, las cifras pasan
del 5,7–12,1 % de los puntos al 10,6–14,5 %.

Y lo que sujeta ese tamaño es el **margen**: la figura no puede llegar al borde
del disco, porque ahí deja de tener dónde esconderse y se lee por su contorno
aunque no se distinga el color. Se mide el punto de la figura más lejano del
centro frente al radio, y el mínimo es el 6 % — dos puntos del mosaico. Medido:
cifras del 28 al 51 %, figuras del 13 al 53 %.

**La figura tiene que poder NOMBRARLA un niño de cuatro años.** Es lo que se
mide aquí: no si la ve, sino si la dice. El rombo y la casa se cayeron por eso
—en consulta el niño no tiene la palabra, y el que calla cuenta como fallo
cromático sin serlo—; quedan círculo, cuadrado, triángulo, estrella, corazón y
**luna**. Una figura nueva se calibra igual que las otras y se elige por el
nombre, no por el dibujo.

## La fuente

Optician Sans tiene **111 glifos**: las letras, las cifras y poco más. No tiene
ni una vocal acentuada, ni la ñ, ni «·», ni «±», ni «Δ» — leído del `cmap` del
WOFF, no supuesto. Así que se usa **solo donde es el optotipo**: las letras y
las cifras de la cartilla, y el rótulo BOOMERANG VISION. Todo lo demás —los
nombres de módulo, las notas de geometría, las cifras de los rótulos— va en la
fuente de la interfaz (`--ui`) o en la monoespaciada (`--num`). Escribir
«Fijación» con ella sale con seis letras de una fuente y una de otra, y eso pasó.

Se comprueba **midiendo**: el ancho de cada carácter pedido con la fuente frente
al ancho pedido con una familia que no existe. Si miden lo mismo, el glifo lo
puso la fuente de reserva.

**El cero de los números es la letra O, y el «1» no va.** La barra diagonal
que hace el cero indistinguible de un ocho la pone **`ss01`, no el glifo**:
medido pintando el 0 en el DOM con los dos juegos y leyendo la tinta del
centro — base 0 % (óvalo limpio), ss01 100 % (la barra). Así que hubo una
versión que dibujaba el 0 con el glifo base, fuera de `ss01`, y funcionaba:
sin barra y con el alto exacto.

Lo que no funcionaba era **parecerse a los demás**. Con el resto de la cartilla
en `ss01` —dígitos cuadrados, de esquinas rectas— un óvalo del juego base se
lee como un carácter de otra fuente, y en consulta eso es justo lo que no se
quiere. `NUMBERS` empieza por la **`O` de las letras**, que sí es `ss01`, tiene
la barra de ningún sitio y el mismo dibujo que el 8 y el 0 de al lado. Con eso
se fueron `sinSS01()` y `BASE_METRICAS`, que existían solo para el glifo base:
**una sola excepción menos en toda la maquinaria**.

Conviene no repetir el error de razonamiento que hubo en medio: se quitó el
carácter entero por «un 4 %, media línea de la escala», y la maquinaria ya
compensaba —`spanOptotipo` calcula el tamaño como `h_css / ratio`, así que un
alto de tinta mayor da una fuente más pequeña que dibuja exactamente el alto
pedido—. Y medir las métricas en vivo tampoco valía: `actualBoundingBox*` sale
del rasterizado y da 0,520 / 0,535 / 0,532 según el tamaño de la sonda.

El que se va es el **1**: en `ss01` es una bandera inclinada sin base y en el
juego base lleva serif de pie — dos dibujos distintos del mismo carácter, y en
los dos un trazo casi vertical que no aporta nada que reconocer. `NUMBERS` va de
la O y del 2 al 9.

Hay una comprobación que barre las pantallas y las mezclas para que el conjunto
sea ese, y otra que lee la **tinta del centro de la O dibujada** con otro dígito
de la misma línea como control: el centro de la O sale al 0 % y el del vecino por
encima del 85 %, con el mismo alto de tinta en los dos.

## Los símbolos LEA

Los cuatro son contornos del mismo grosor de trazo — 7,5 de 60, que es el
detalle que la prueba mide — y eso manda sobre parecerse a un dibujo concreto.

**La manzana está medida contra la referencia, no puesta a ojo.** De la imagen
que dio quien usa esto se extrajo el perfil del contorno columna a columna y se
persiguieron cinco cifras; la elección salió de una rejilla por mínimo error:

| | referencia | dibujada |
|---|---|---|
| aspecto (ancho/alto) | 1,052 | 1,067 |
| escotadura de arriba, exterior | 14,0 % del alto | 14,7 % |
| techo del hueco interior | 38,6 % | 36,9 % |
| escotadura de abajo | 6,0 % | 5,3 % |
| altura del ancho máximo | 32,1 % | 31,1 % |

Es **simétrica a propósito**: la referencia está trazada a mano y su asimetría
es temblor, no diseño. El `viewBox` es 63×60 porque la manzana es más ancha que
alta y el alto es lo que fija los 5′ de arco.

## El mando

**No se pellizca y no se va de lado.** El viewport declara `device-width` —no un
ancho fijo, que en un móvil de 360 px obliga al navegador a encoger la página
entera de entrada— con `user-scalable=no` y `touch-action: pan-y`: solo se
desplaza arriba y abajo. Aquí no hay nada que ampliar, y un pellizco con prisa
deja la interfaz desplazada y al operador buscando el botón.

**`touch-action` y `overscroll-behavior` van SOLO en el `<html>`, que es el que
desplaza.** Ponerlos también en el `body` se llevó por delante el
desplazamiento entero: con un `overflow` distinto de `visible` el `body` se
convierte en scroll container, y uno sin nada que desplazar se queda el gesto
del dedo; con `overscroll-behavior: none` ni lo encadena hacia arriba. Las
opciones de abajo quedaron inalcanzables en el móvil. Para recortar a lo ancho
sin crear un scroll container, `overflow-x: clip` en el `body`.

El dedo **no es medible** en las pruebas: el gesto sintético de CDP no respeta
`touch-action` —desliza incluso con `none`— y el que sí lo respeta no mueve
nada en headless. Y la rueda del ratón no delata el defecto, porque Chromium la
encadena con otras reglas. Así que lo que se comprueba es el invariante:
**entre los controles y el que desplaza no puede haber un scroll container sin
nada que desplazar.**

**Los avisos largos van plegados.** Tres paneles llevan un párrafo que hay que
poder leer pero que se lee una vez; el del color medía 208 px de los 1.447 del
panel. El **título sigue delante** —la advertencia no se esconde— y el
desarrollo se abre al tocarlo.

## El panel del PC

Los ocho módulos nacieron alcanzables **solo desde el móvil**. El panel del PC
(`#panel-pc` en `public/index.html`, tecla `P`, `Esc` para cerrar) abre el otro
camino: un consultorio con un PC, un teclado y un ratón.

**No reimplementa nada.** Se pinta con `construirEspejo()` —el mismo objeto que
se le manda al móvil— y despacha por `aplicarComando()` —el mismo vocabulario
de comandos—. Las dos funciones se extrajeron para esto: antes el espejo se
construía dentro del envío y el despachador vivía dentro del
`socket.on('comando')`, así que un panel local habría tenido que reimplementar
los dos. Dos rutas para la misma orden es como se separan dos interfaces que
deben hacer lo mismo. Hay una comprobación que compara los `data-cmd` del panel
contra las 30 familias de comando del mando.

Lo que sí es distinto, y debe serlo, es la presentación: el móvil es un pulgar a
30 cm y esto es un ratón. Grupos de 2 a 4 opciones como botones, todos a la
vista; lo que no cabe —nueve figuras, siete láminas, cinco filas— plegado en un
desplegable.

**Se superpone y no re-maqueta.** Si el panel empujara la maqueta, el estímulo
cambiaría de tamaño al abrirlo y la geometría dejaría de ser la declarada sin
que nada lo delate. Una comprobación mide la caja de lo dibujado con el panel
abierto y cerrado y exige que no se mueva **ni un píxel**.

**Nace cerrado, y dice que está abierto.** Esta pantalla es la que mira el
paciente: un panel que asome al arrancar le enseña los controles, y mientras
está abierto le tapa parte de la cartilla. Con un solo monitor eso no tiene
arreglo, así que se dice en la cabecera del propio panel en vez de disimularlo.
El flujo es elegir y cerrar.

La distancia de la sala **no** se toca desde aquí: se declara una vez, en la
configuración inicial, como en todos los demás sitios.

### El teclado, en todos los test

Sin móvil el teclado tiene que llegar a todo, y hasta la PR #10 solo llegaba a
optotipos: en los otros siete las flechas no hacían nada.

**Los números `1`–`8` son los ocho test**, en el orden del menú, con el `0`
para dejar la pantalla sin estímulo. Valen en **cualquier** módulo, igual que la
`N` y la `P`: una tecla, un significado. Dentro del Pelli el `3` podría querer
decir «fila 3», y esa ambigüedad es justo lo que no puede pasar — hay una
comprobación que lo sujeta para que nadie lo «arregle» más tarde en el otro
sentido.

**Las flechas mueven lo que cada test ordena:**

| | |
|---|---|
| `↑ ↓` | lo que el test **ordena**: pantalla, fila de contraste, lámina, anillos, luz, figura. `↓` avanza |
| `← →` | **remezclar**, o la otra elección cuando la hay: caracteres nuevos, letras nuevas, puntos nuevos, velocidad |

Con una excepción, y es la que cualquiera espera: en el relax la luz es una
**magnitud**, no una lista, así que `↓` la baja y `↑` la sube. Un nivel al que
la flecha abajo le SUBE el valor está mal hecho.

Worth no tiene eje ordenado — el filtro es un conmutador — así que ahí las
flechas no hacen nada. Mejor que la tecla no haga nada que hacer algo que no se
espera.

La tabla vive en `EJES_FLECHA` y de ella sale **también** el rótulo que el panel
enseña, así que no puede decir una cosa y hacer otra. Y un atajo que no está
anunciado no existe: los números van delante de cada test en el desplegable, el
eje de las flechas en el propio panel, y todo en el panel de la `?`.

**Al cerrar el panel, el foco tiene que SALIR de él.** Si se queda dentro de un
control ya escondido, la guarda «el teclado es del panel» se cumple para
siempre y el teclado queda muerto con el panel cerrado: ni números, ni flechas,
ni `N`.

### La barra de arriba ya no existe

Llevaba la distancia, ⚙ CONFIGURACIÓN, el botón ▲, el rótulo del módulo y la
cifra de px/mm, y estaba a la vista del paciente todo el rato gastando alto de
pantalla — que es lo que este sistema gasta en el estímulo. Todo se ha ido al
panel, **agrupado por lo que es**: arriba lo que se toca en cada test, abajo
«La sala» — la distancia y la medida de la pantalla, que se declaran una vez —
y al final el emparejamiento.

**El corte se explica ahora en la propia pantalla**, tenue y abajo
(`.corte-aviso`). Antes lo decía esa barra; sin ella, el paciente se habría
quedado delante de un negro sin una palabra, que es la regla que este proyecto
no se salta. El rótulo del operador (`#modulo-nombre`) vive en el panel, que
puede estar cerrado, así que no sirve para esto.

Y la `H`, que replegaba la barra, abre y cierra el panel: una tecla anunciada
que no hace nada es peor que una tecla que no existe.

### Lo que el panel se llevó de la barra

La barra del PC tenía siete chips — los cuatro optotipos, «Fondo claro»,
«Resaltar» e «Individual» — y se han ido al panel, que los tiene todos con su
rótulo y su estado. Dos sitios para la misma orden es como se separan dos
interfaces, y estos además estaban a la vista del paciente todo el rato. Las
pruebas eligen el modo con `elegirModo()` (`pruebas/ayuda.mjs`), que hace lo que
hace una persona: abre el panel, pulsa y **cierra siempre** — una sonda de
píxeles con el panel abierto mide el panel.

**Y el panel de la «?» tampoco existe.** Llevaba el mapa de teclas y el QR, y
era un tercer sitio de donde sacar cosas: se cerraba solo a los siete segundos,
se abría con un botón rotulado «Mostrar atajos» que no dice nada de un móvil, y
mientras estaba ahí nadie movía el mapa de teclas — llegó a decir «Navegar
pantallas» cuando las flechas ya movían seis ejes. Los atajos están ahora en el
panel de control, plegados, y salen de la tabla **`ATAJOS`** más el eje de
`EJES_FLECHA` del test en curso, así que no pueden decir una cosa y hacer otra.
`?` y `H` abren el panel, igual que `P`.

Al quitarlo se rompieron dos cosas, y las dos merecen recordarse:

- `pintarEmparejamiento()` se quedó colgando de la configuración inicial, que
  solo se abre la primera vez — así que en un equipo ya configurado el código de
  sala se quedaba en su «…» para siempre y el QR sin dibujar. **Se pinta en el
  arranque**: emparejar es el camino a los otros siete test y no puede depender
  de haber pasado por ningún sitio.
- La regla que esconde el pie dentro de un módulo (`body.en-modulo #footer`)
  escondía también ese botón. Al quitarlo de la lista quedó un selector colgando
  de una coma, el `display:none` se fue con él y **el pie volvió a asomar en los
  siete módulos**, a la vista del paciente y gastando alto. Hay una comprobación
  que lo mide.

El QR de emparejamiento vive en el panel, plegado, con el código de sala a
la vista en el título. Y hay un botón que abre **el mando en su propia ventana**,
ya emparejado por el código en la URL: se arrastra al segundo monitor y la
pantalla del paciente se queda limpia. Es el arreglo de lo único que el panel
compromete.

**El teclado es del panel SOLO en un desplegable o un deslizador**, donde las
flechas mueven la opción. Sobre un botón no: el foco se queda ahí después de
pulsarlo, y quien pulsa un botón y luego aprieta ↓ espera pasar de pantalla. La
primera versión cubría todo el panel y dejaba el teclado muerto tras cada clic.

**Y los mandos no viajan disfrazados de tecla.** El despachador reparte un
`KeyboardEvent` para los atajos de optotipos, y al pulsarlos en el panel el foco
se queda en el botón: la guarda de arriba se los comía, y bicromático, resaltar,
un solo carácter y las flechas de pantalla no hacían nada. Están en
`atajoOptotipos()`, que usan el teclado y el panel.

**El estado se anuncia, no solo se pinta**: `aria-pressed` en todo lo que es
selección o conmutador — y en nada que sea una acción, que no está «pulsada» —
y `aria-live` en la línea de geometría, que cambia sola.

## Las figuras de fijación infantil

Nueve figuras y cuatro movimientos, **elegidos por separado**: la figura es lo
que le interesa al niño y el movimiento es lo que se quiere medir, y atarlos
—el rebote era siempre la pelota— dejaba sin la mariposa rebotando y obligaba a
inventar un movimiento por cada figura nueva.

Y cada figura tiene además su **gesto**, que mueve sus partes y no la figura
entera: la mariposa bate las alas, el pez mueve la cola, la llama del cohete
tiembla, la carita parpadea. Un niño de dos años mira lo que hace algo, y una
silueta que solo se desplaza se agota antes.

Tres reglas, y las tres están comprobadas midiendo:

- **Cuelgan todas de `svg.inf-viva`**, la clase que la pantalla pone solo cuando
  la figura no está congelada. Congelar quita la clase y con ella los nueve
  gestos de una vez, sin tener que acordarse de apagarlos uno por uno. Congelado
  es congelado: el rótulo dice que el niño mira a un punto fijo, y una figura
  que sigue agitándose por dentro no lo es.
- **La duración sale de `--inf-dur`**, que es la velocidad elegida en el mando,
  así que «Lenta» es lenta también por dentro.
- **Ninguna saca tinta del cuadro declarado.** El cuadro es el tamaño en grados
  de arco, y el `<svg>` recorta: un gesto que se pasa no aparece fuera, aparece
  **cortado** — un ala a medias, que es peor que un ala quieta. Se mide la tinta
  dibujada en doce fases del ciclo, poniéndole el `currentTime` a las
  animaciones en vez de esperar al reloj; con el muestreo por espera el parpadeo
  de la carita, que dura un 16 % del ciclo, se escapaba casi siempre.

Y que ANIME no basta: se exige que **la pantalla cambie** de una fase a otra. La
primera versión contaba píxeles de tinta y acusaba a la carita de estar quieta
mientras parpadeaba delante de ella — los ojos son dos óvalos oscuros DENTRO de
la cara, así que la silueta no cambia ni un píxel. Se compara una firma de todos
los píxeles.

Las miniaturas del mando y del panel **no se animan**, a propósito: la regla pide
`#modulo-area`, y nueve siluetas agitándose a la vez en un móvil son ruido. El
gesto que hará la pantalla se dice en el título del botón y en el rótulo del
módulo.

Una figura nueva se calibra como las demás —se elige por el nombre, que un niño
de cuatro años tiene que poder decir— y llega con su clase `g-…` y su regla. Si
se olvida la regla, la comprobación la acusa de estar quieta por dentro.

## Cortar el estímulo

La pantalla del paciente se puede dejar en negro **sin salir del test**, desde
el mando o con la tecla `N`. Volver al menú también la deja sin estímulo, pero
pierde lo que había elegido — los anillos, la lámina, el ojo en examen — y
taparle la cartilla un momento es de las cosas que más se hacen en una
consulta. El corte apaga LAS DOS capas: esconder el estímulo y dejar los
optotipos detrás es un defecto que ya apareció una vez, y en negro no se ve
hasta que se reanuda. No se guarda: es un momento, no una preferencia.

## El lienzo de diseño

Hay un lienzo publicado que describe la suite, con sus ficheros de trabajo
fuera del repo. Cuando un cambio deja obsoleta una cifra o una decisión suya,
**hay que sincronizarlo**: los dos artefactos se separaron una vez y costó una
sesión volver a juntarlos.
