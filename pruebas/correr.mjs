#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   El corredor. `npm test`.

   Levanta el servidor en un puerto libre, abre Chromium, empareja una
   pantalla con un mando de verdad y pasa las suites. Sale con 0 si todo
   pasa, 1 si algo falla y 2 si NO PUDO EJECUTARSE — porque una suite que
   sale en verde sin haberse ejecutado es peor que no tenerla.

   Una sola sesión de navegador para todas las suites, y en este orden:
   optotipos deja la pantalla en su estado de arranque, los módulos la
   recorren entera, la geometría mide, y las regresiones tocan la distancia y
   la devuelven a 6 m al terminar.
   ═══════════════════════════════════════════════════════════════════════════ */
import { cargarChromium, levantarServidor, emparejar } from './ayuda.mjs';
import pruebaOptotipos from './optotipos.mjs';
import pruebaModulos from './modulos.mjs';
import pruebaGeometria from './geometria.mjs';
import pruebaRegresiones from './regresiones.mjs';
import pruebaSinMando from './sin-mando.mjs';
import pruebaCalibracion from './calibracion.mjs';
import pruebaArranque from './arranque.mjs';
import pruebaCaidas from './caidas.mjs';
import pruebaPanel from './panel.mjs';

const VERDE = '\x1b[32m', ROJO = '\x1b[31m', GRIS = '\x1b[90m', FIN = '\x1b[0m';
const color = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (t, col) => color ? col + t + FIN : t;

let chromium = null;
try {
  chromium = await cargarChromium();
} catch (e) {
  console.error('\n' + e.message + '\n');
  process.exit(2);
}
if (!chromium) {
  console.error('\nNo encuentro Playwright, así que NO se ha comprobado nada.\n');
  console.error('  npm i -D playwright && npx playwright install chromium\n');
  console.error('O apunta PLAYWRIGHT_MODULE a un index.mjs de playwright ya instalado.');
  console.error('Estas pruebas miden píxeles dibujados por un navegador real: no hay');
  console.error('forma de sustituirlas por pruebas unitarias sin dejar de comprobar');
  console.error('justamente lo que se quiere comprobar.\n');
  process.exit(2);
}

let servidor, navegador, salida = 0;
try {
  servidor = await levantarServidor();
  console.log(c('servidor de pruebas en ' + servidor.url, GRIS));
  navegador = await chromium.launch();

  const sala = await emparejar(navegador, servidor.url);

  /* Una suite que se rompe cuenta como fallo, y se cuenta COMO UNA FILA.
     La primera versión de este corredor la anotaba en una propiedad `fallos`
     que el recuento final no leía nunca: al reinyectar un defecto a propósito,
     la suite de regresiones petó, el total bajó de 66 comprobaciones a 50 y la
     ejecución dijo «todas pasan». Una suite que encoge en silencio es peor que
     una que falla. */
  const correr = async (nombre, prueba, args) => {
    try {
      return await prueba(args);
    } catch (e) {
      return {
        titulo: 'Suite «' + nombre + '»',
        filas: [{ nombre: 'se ejecuta hasta el final', ok: false,
                  detalle: 'se rompió: ' + String(e.message).split('\n')[0] }]
      };
    }
  };

  /* Cuatro suites COMPARTEN la sesión emparejada — la misma pantalla y el mismo
     móvil — y se pisarían entre sí: van en fila, y en este orden, porque cada
     una deja la pantalla como la siguiente la espera. */
  const enFila = [
    ['optotipos',   pruebaOptotipos,   sala],
    ['módulos',     pruebaModulos,     sala],
    ['geometría',   pruebaGeometria,   sala],
    ['regresiones', pruebaRegresiones, sala]
  ];

  /* Las otras cuatro abren su propio navegador y su propia sala, así que no se
     estorban: van a la vez. El servidor empareja POR CÓDIGO DE SALA, y cada
     contexto genera el suyo, que es justo lo que hace esto seguro — el mismo
     mecanismo que evita que dos consultorios se pisen.
     Medido: en fila la suite tardaba 247 s. */
  const aLaVez = [
    ['sin mando',   pruebaSinMando,    { navegador, url: servidor.url }],
    ['calibración', pruebaCalibracion, { navegador, url: servidor.url }],
    ['arranque',    pruebaArranque,    { navegador, url: servidor.url }],
    ['caídas',      pruebaCaidas,      { navegador, url: servidor.url }],
    ['panel del PC', pruebaPanel,      { navegador, url: servidor.url }]
  ];

  const enParalelo = Promise.all(aLaVez.map(([n, p, a]) => correr(n, p, a)));

  const marcadores = [];
  for (const [nombre, prueba, args] of enFila) marcadores.push(await correr(nombre, prueba, args));
  /* Promise.all conserva el orden, así que la salida sigue siendo la misma
     lista en la misma secuencia: una ejecución paralela que imprime en orden
     distinto cada vez es imposible de comparar con la anterior. */
  marcadores.push(...await enParalelo);

  /* Los errores de consola de la sesión emparejada se cuentan al final: un
     módulo puede dibujar bien y estar lanzando excepciones cada repintado. */
  marcadores.push({
    titulo: 'La sesión emparejada',
    filas: [{ nombre: 'sin errores de consola en pantalla ni mando', ok: sala.errores.length === 0,
              detalle: sala.errores.length ? sala.errores.slice(0, 4).join(' | ') : 'ninguno' }],
    get fallos() { return sala.errores.length ? 1 : 0; }
  });

  let total = 0, fallos = 0;
  /* Las nueve suites más el recuento de errores de consola: diez marcadores.
     Si falta alguno es que el bucle de arriba no llegó a añadirlo, y eso no
     puede terminar en verde. */
  if (marcadores.length !== 10) {
    console.error(c('\nfaltan marcadores: ' + marcadores.length + ' de 10', ROJO));
    fallos++;
  }
  for (const m of marcadores) {
    console.log('\n' + m.titulo);
    for (const f of m.filas) {
      if (f.ok === null) {
        console.log('  ' + c('– ', GRIS) + f.nombre + (f.detalle ? c('   ' + f.detalle, GRIS) : ''));
        continue;
      }
      total++;
      if (!f.ok) fallos++;
      console.log('  ' + (f.ok ? c('✓', VERDE) : c('✗', ROJO)) + ' ' + f.nombre
        + (f.detalle ? c('   ' + f.detalle, GRIS) : ''));
    }
  }

  console.log('\n' + (fallos === 0
    ? c(`${total} comprobaciones, todas pasan`, VERDE)
    : c(`${total} comprobaciones, ${fallos} fallan`, ROJO)));
  salida = fallos === 0 ? 0 : 1;
} catch (e) {
  console.error(c('\nno pude ejecutar las pruebas: ' + e.message, ROJO));
  salida = 2;
} finally {
  if (navegador) await navegador.close().catch(() => {});
  if (servidor) await servidor.cerrar().catch(() => {});
}
process.exit(salida);
