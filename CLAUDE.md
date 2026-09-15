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

**La distancia de la sala se declara UNA VEZ**, en la configuración inicial, y
en ningún otro sitio se cambia. Es una propiedad de la sala, no un mando por
test: poder cambiarla a mitad de una prueba invita a que la geometría y el
sitio donde está sentado el paciente dejen de coincidir sin que nada lo delate.

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

**El «0» no se dibuja.** Optician Sans lo trae con una barra diagonal y a la
distancia de la sala un cero barrado y un ocho son el mismo borrón; un fallo así
no se distingue de una agudeza baja. Las cifras van de 1 a 9 (`NUMBERS` en
`public/index.html`), y hay una comprobación que barre las pantallas y los
turnos de mezcla para que ninguna saque un cero.

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
