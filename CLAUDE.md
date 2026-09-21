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

Y lo mismo vale para la RESOLUCIÓN, que es el caso que faltaba. El detalle
crítico de un optotipo es 1/5 de su altura, y una pantalla no dibuja un trazo
más fino que su propia rejilla: el tamaño en mm sale correcto y la letra sale
hecha un borrón gris. Medido a 6 m en un 24″ de 1600×900:

| | trazo |
|---|---|
| 20/20 | 5,3 px |
| 20/15 | 3,9 px |
| **20/10** | **2,6 px** |

El aviso estaba en **2 px y no saltaba nunca** — la cartilla pedía 2,6. Está en
`TRAZO_MIN_PX = 4`, que es el mínimo con el que el antialiasing deja
reconocible un carácter de Sloan, y dice QUÉ líneas no resuelve la pantalla.
Aquí no se quitan líneas como en el Pelli: cuáles no se resuelven depende del
monitor y de la distancia, así que se avisa y se declara en vez de decidir por
el optometrista.

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
abre el otro camino: un consultorio con un PC, un teclado y un ratón.

**Es una barra arriba con los ocho test, y el menú de cada uno cuelga de su
ítem** (`#barra-test` y `#panel-pc` en `public/index.html`; `P` para sacarlo,
`Esc` para recogerlo). Antes era un cajón lateral con un desplegable de ocho
test dentro, y eso obligaba a abrir el cajón, buscar en la lista y cerrar; los
ocho están ahora a un gesto. Lo que **no** cambió es la maquetación de los
controles de cada test: sigue siendo la columna que ya tenían, que es la que
cabe. En «La sala» cuelga lo que se declara una vez por sala — la distancia, el
móvil, la configuración y los atajos—: no son controles de un test y repetirlos
ocho veces sería decir ocho veces lo mismo.

Cómo se esconde, por qué, y qué no se puede romper: en «La barra de arriba: ida
y vuelta», más abajo.

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
`<details>`, con los mismos botones dentro. **Plegado, no un `<select>`**: el
botón enseña el dibujo de la figura y su estado, y un desplegable nativo
esconde las dos cosas. Hubo un `ppSelect()` para eso que no llamaba nadie, y se
barrió con su CSS; lo que se conserva es el `SELECT` de las guardas del
teclado, que es la regla de qué controles se quedan las flechas y no un apaño
para un elemento que existía.

**Una sola declaración, y la escribe el módulo.** El rótulo del operador y la
caja de geometría eran el mismo texto en dos líneas —`ppGeo()` sacaba la
segunda de la primera con un `split`— y la de arriba conservaba las reglas que
tenía en la barra (`white-space: nowrap`, versalitas): en la columna de 363 px
del panel se salía entre 182 y 495 px, o sea hasta el 58 % del texto fuera. El
rótulo ES ahora la región viva (`#panel-geo` lleva dentro `#modulo-nombre`): se
pliega, se anuncia y se escribe en un sitio.

**Y los ocho declaran, optotipos incluido.** `renderScreen()` vaciaba el rótulo
en optotipos, así que el módulo por el que existe toda la calibración era el
único que no decía su geometría. Declara modo, pantalla, rango de líneas, el
20/20 en mm y el trazo de la línea más fina, y el aviso de que algo no cabe o
no se resuelve **viaja en el espejo hasta el mando**: vivía solo en el panel
del PC, y el camino original de esta suite es el móvil.

**El menú es un armazón, no una lista larga.** Cuando era un cajón de pantalla
completa gastaba 829 px de cabecera, rótulos y pie para 137–491 px de controles
del test, y el campo de la distancia caía por debajo del pliegue. Lo que se
desplaza es **solo `#panel-cuerpo`**, que es lo único que crece con el módulo;
lo demás se queda a la vista. Lo que tiene que estar ahí sin desplazar nada, y
está comprobado a 900 y a 768 px: **el corte de estímulo** en el menú de cada
test —es lo más usado del examen— y **la distancia** en el de «La sala».

Con el desplazamiento dentro, la última fila queda cortada por el borde y una
barra superpuesta no lo dice, así que **se mide y se dice** («hay más abajo»), y
se va al llegar al fondo. Una fila a medias sin explicación es el mismo defecto
con otra forma.

**Se superpone y no re-maqueta.** Si el panel empujara la maqueta, el estímulo
cambiaría de tamaño al abrirlo y la geometría dejaría de ser la declarada sin
que nada lo delate. Una comprobación mide la caja de lo dibujado con el panel
abierto y cerrado y exige que no se mueva **ni un píxel**.

**Nace cerrado, y dice que está abierto.** Esta pantalla es la que mira el
paciente: un panel que asome al arrancar le enseña los controles, y mientras
está abierto le tapa parte de la cartilla. Con un solo monitor eso no tiene
arreglo, así que se dice en la cabecera del propio panel en vez de disimularlo.
El flujo es elegir y cerrar.

La distancia de la sala **sí** se corrige aquí, en el menú de «La sala»: se
pide una vez en la configuración inicial y después se edita ahí. Esta línea
decía lo contrario —era la regla de antes— y se quedó contradiciendo a la de
arriba durante dos PR. Lo que se conserva sigue siendo lo mismo: que el cambio
no sea invisible.

**Y los iconos de módulo viven en un solo sitio.** `ICONO_MOD` está en
`index.html`, junto a `MODULOS`, y viaja en el espejo: los pinta la barra del PC
y los pinta el menú del móvil. Estaban solo en `remote.html`, y al necesitarlos
la barra habría habido dos copias — la misma trampa que ya tuvieron las figuras
de fijación infantil: añadir un módulo sería editar dos ficheros y acordarse de
los dos.

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
anunciado no existe: los números van **delante de cada test en la barra**, el
eje de las flechas en el propio menú, y la tabla entera en el bloque «Atajos de
teclado», plegado. Ahí va también el GESTO —«acerque el ratón al borde de
arriba»—, porque una barra que aparece sola y que nadie sabe cómo sacar es peor
que un atajo sin anunciar. El panel de la `?` ya no existe — más abajo está por
qué.

**Al cerrar el panel, el foco tiene que SALIR de él.** Si se queda dentro de un
control ya escondido, la guarda «el teclado es del panel» se cumple para
siempre y el teclado queda muerto con el panel cerrado: ni números, ni flechas,
ni `N`.

### La barra de arriba: ida y vuelta, y qué se conserva

La barra vieja llevaba la distancia, ⚙ CONFIGURACIÓN, el botón ▲, el rótulo del
módulo y la cifra de px/mm, y se quitó entera porque **estaba a la vista del
paciente todo el rato gastando alto de pantalla** — que es lo que este sistema
gasta en el estímulo. Todo se fue al panel.

**Y ahora hay barra otra vez, porque se esconde sola.** Esa es la única
diferencia, y es la que importa: la objeción que la mató no era «una barra
arriba está mal», era «una barra que el paciente tiene delante todo el rato está
mal». Una que asoma al acercar el ratón al borde de arriba y se va a los cinco
segundos no tiene ese defecto.

Lo que se conserva, y lo que hay que romper para volver al defecto:

- **Se esconde sola.** Si deja de hacerlo, vuelve la barra vieja con otro
  nombre. Hay una comprobación que lo mide esperando seis segundos y medio.
- **Se superpone y no re-maqueta.** Si empujara la maqueta, el estímulo
  cambiaría de tamaño cada vez que la barra asoma y la geometría dejaría de ser
  la declarada sin que nada lo delate.
- **El centro de la pantalla no la saca.** Sale del borde de arriba, no de un
  `mousemove` global: señalarle algo al paciente con el ratón no tiene por qué
  enseñarle los controles.
- **No se esconde debajo de quien la usa, y «usarla» es MOVER el ratón.** Un
  menú que se va mientras lees la línea de geometría es peor que no tenerlo,
  así que cada `pointermove` por encima reinicia el reloj. Lo que NO cuenta es
  el puntero apoyado y quieto, ni un botón con el foco: **los dos vetos que
  había —`:hover` y «hay algo enfocado dentro»— se cumplen para siempre justo
  después de usarla**, porque quien pulsa un test deja el puntero encima del
  ítem y el foco en ese botón. Con eso la barra no se escondía NUNCA, y eso es
  la barra vieja con otro nombre; lo reportó quien usa esto, no una prueba —
  las tres que había apartaban el ratón Y quitaban el foco antes de esperar, o
  sea medían una barra que nadie acababa de usar. Es la misma trampa que ya
  tuvo la guarda del teclado, que por eso cuenta los campos y no los botones.
  Del veto del foco queda lo único que el ratón no puede decir: un **campo o un
  desplegable** enfocado — el de la distancia es el caso vivo, y ahí las
  flechas son suyas—, porque un desplegable nativo abierto se queda el puntero
  y no manda ni `pointermove` ni `mouseleave`.
- **Con la medida de otra pantalla no se esconde nunca.** Es el único estado en
  el que hay que verla sí o sí, y sin móvil no lo dice nadie más.

**Asoma sola la primera vez** que se abre el programa en un equipo, y una sola
vez. Sin eso, quien lo abre por primera vez ve una cartilla y nada más: es el
mismo defecto que tuvo el QR cuando vivía escondido y dejó invisible la suite
entera.

Los ocho test van con **su número, su icono y su nombre**. El número es el
atajo, y un atajo que no se anuncia no existe. Cuando los ocho no caben con su
nombre —un portátil de 1366— se quedan con el número y el icono, y eso lo
decide una **medida** (`ajustarBarra()`) y no un ancho escrito a mano: lo que
ocupan los rótulos depende de la fuente de ese equipo. El del test puesto
conserva su nombre, que en compacto es lo único que dice qué está en la pantalla
del paciente.

Y hay dos marcas distintas, que son dos cosas distintas: `aria-expanded` es «su
menú está abierto» y `aria-current` es «este test está en la pantalla del
paciente». Con solo la primera, al cerrar el menú no quedaba ninguno marcado y
la barra enseñaba ocho botones iguales.

**Pantalla completa**, en la barra y con la tecla `F`. Lo que gana no es
estética: el navegador se queda con 80-120 px de barras que aquí son alto de
estímulo. Y lo que no puede cambiar es el tamaño físico de lo dibujado — los
milímetros salen de la calibración y de la distancia, no del alto de la
ventana—; hay una comprobación que exige que el 20/20 mida lo mismo dentro y
fuera.

**Y ahí `Esc` no es nuestro.** El navegador se queda esa tecla para salir de
pantalla completa y no la reparte, así que el único gesto anunciado para
recoger los controles no llegaba: la barra se quedaba encima del estímulo y
quien la quitaba se salía de pantalla completa sin querer. Como quien pulsa
`Esc` quiere recoger, **salir de pantalla completa sin pasar por nuestro
control recoge la barra y el menú**; salir a propósito —la `F` o el botón— no,
que entonces la barra se iría en las narices de quien acaba de pulsarla. El
evento `fullscreenchange` no dice quién lo pidió, así que lo distingue una
bandera, y las dos ramas están comprobadas. Y se anuncia en la tabla: un atajo
que dice hacer algo que en pantalla completa no hace es peor que no tenerlo.

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

**Y la calibración obsoleta se dice sin abrir nada.** «CAMBIÓ LA PANTALLA:
RECALIBRE» vive en el pie, y `body.en-modulo #footer` esconde el pie dentro de
un test: en el camino PC-sin-móvil, dentro de un módulo y con el panel cerrado,
arrastrar la ventana al proyector dejaba toda la geometría mal **en silencio**.
Lo lleva el chip del lanzador (`#panel-alerta`), que además deja de esperar al
ratón mientras la medida no sea de esta pantalla. Fuera de la cartilla: el
estímulo no se toca.

**Menos movimiento, pero no menos test.** `prefers-reduced-motion` apaga el
adorno —la barra que baja, el menú que cae, las transiciones de los botones— y **no** los movimientos ni los gestos de fijación infantil: ahí el
movimiento es el estímulo, y apagarlo no es accesibilidad, es dejar la prueba
sin hacer. Para eso está CONGELAR, que lo decide el optometrista y no el
sistema operativo. Por eso la regla enumera lo que apaga en vez de usar el
`* { animation: none }` de manual.

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

## Cuando falla la red, no el código

Esto se despliega en Render y se usa con el Wi-Fi de un consultorio. Tres cosas
que no son del navegador sino de la infraestructura, y que tienen su propia
suite (`pruebas/sin-red.mjs`) porque no se miden ni en el DOM ni en píxeles.

**Un parpadeo del Wi-Fi no puede dejar la pantalla muerta.** `public/sw.js`
guarda las dos páginas, la fuente, el QR y el cliente del socket. Con la red
caída de verdad —`setOffline`, no un truco en el código— la pantalla del
paciente sigue dibujando la cartilla y el panel sigue llegando a los ocho test.
Lo que la red se lleva es el **mando**, porque el emparejamiento pasa por el
socket: eso no se puede prometer y no se promete.

Del caché primero **y de paso se refresca**: una app clínica tiene que abrir ya
y funcionar sin red, pero una copia guardada para siempre es peor que ninguna —
el consultorio se quedaría con una versión vieja sin forma de actualizarla. Se
sirve lo guardado y se pide lo nuevo por detrás, así que como mucho se va una
carga por detrás y se arregla solo, sin números de versión que alguien tiene
que acordarse de subir. `sw.js` se sirve con `Cache-Control: no-cache` y no se
guarda a sí mismo: es el fichero que decide qué se guarda, y una copia rota de
él se quedaría rota para siempre.

**Lo que sale por el cable va comprimido.** Medido: `index.html` de 255 KB a
**70 KB** (×3,6) y `remote.html` de 93 a **24 KB** (×3,8). El que paga los
datos suele ser el móvil del optometrista. La comprobación no se conforma con
la cabecera `content-encoding`: exige que el ahorro sea real.

**El emparejamiento tiene freno.** El código de sala es lo único que separa dos
consultorios. Un cliente legítimo se une UNA vez por conexión, así que un
límite de 10 uniones por cada 10 segundos **y por socket** no le estorba nunca
y a un script le pone los 60 millones de códigos fuera de alcance por esa
conexión. Lo que no compra, dicho sin adornos: quien abra mil sockets tiene mil
ventanas — frenar eso es trabajo de un proxy con límite por IP, no de este
fichero. Por socket y no por IP a propósito: por IP, las pruebas (varias salas
a la vez desde 127.0.0.1) y un consultorio con varios equipos detrás del mismo
router se frenarían solos. Y cuenta toda unión, no solo las de forma inválida:
un código bien formado que no existe es indistinguible de una pantalla que
acaba de abrir su sala, así que castigar ese caso cortaría a la pantalla buena
en cada reconexión.

## El lienzo de diseño

Hay un lienzo publicado que describe la suite, con sus ficheros de trabajo
fuera del repo. Cuando un cambio deja obsoleta una cifra o una decisión suya,
**hay que sincronizarlo**: los dos artefactos se separaron una vez y costó una
sesión volver a juntarlos.
