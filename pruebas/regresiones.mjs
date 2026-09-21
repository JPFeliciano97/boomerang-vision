/* ═══════════════════════════════════════════════════════════════════════════
   Los defectos que ya estuvieron en producción una vez. Cada uno tiene su
   comprobación para que no vuelva.

   Estos cuatro salieron en la revisión de la suite, no del uso: tres no se
   ven hasta que alguien mide, y el cuarto solo aparece con el segundo
   paciente del día. Esa es exactamente la clase de defecto que una prueba
   tiene que sujetar, porque la sala no la va a encontrar.
   ═══════════════════════════════════════════════════════════════════════════ */
import { marcador } from './ayuda.mjs';

const SLOAN = 'CDHKNORSVZ';

export default async function pruebaRegresiones({ pc, tel, abrir }) {
  const m = marcador('Defectos que ya ocurrieron');

  // ═══ 1 · los tripletes de Pelli eran tres letras seguidas del Sloan ═════
  /* El índice era lineal en j —(fila*37 + j*11 + semilla*53) % 10— y como
     11 % 10 = 1, j sumaba 0, 1, 2 posiciones consecutivas. Existían DIEZ
     tripletes en total y subir la semilla desplazaba la cartilla entera una
     fila en vez de cambiar las letras: el paciente que ya vio la cartilla
     puede recitar la fila siguiente. */
  await abrir('Pelli-Robson');
  const leerCartilla = () => pc.evaluate(() =>
    [...document.querySelectorAll('#modulo-area .optotype-text')].map(e => e.textContent).join(''));

  const cartillas = [await leerCartilla()];
  for (let i = 0; i < 5; i++) {
    await tel.click('#panel-pelli .conmut');        // «Letras nuevas en todas las filas»
    await tel.waitForTimeout(450);
    cartillas.push(await leerCartilla());
  }
  const tripletes = cartillas.flatMap(c => c.match(/.{3}/g) || []);
  const consecutivos = tripletes.filter(t => {
    const i = [...t].map(c => SLOAN.indexOf(c));
    return i.every(x => x >= 0) && i[1] === (i[0] + 1) % 10 && i[2] === (i[0] + 2) % 10;
  });

  /* Tres letras por fila, y las filas las dicta la pantalla: el rango se
     recortó de ocho filas a cinco —por encima de 1,00 log CS estos monitores
     no enseñan nada— y una cifra copiada aquí habría que recordar cambiarla. */
  const nFilas = +((await pc.textContent('#modulo-nombre')).match(/fila \d+\/(\d+)/) || [])[1];
  m.comprobar('tres letras por fila en todas las filas',
    nFilas >= 3 && cartillas.every(c => c.length === 3 * nFilas),
    nFilas + ' filas · longitudes ' + [...new Set(cartillas.map(c => c.length))].join('/'));
  m.comprobar('«Letras nuevas» da una cartilla distinta cada vez',
    new Set(cartillas).size === cartillas.length,
    new Set(cartillas).size + ' distintas de ' + cartillas.length);
  m.comprobar('ninguna letra repetida dentro de un triplete',
    tripletes.every(t => new Set(t).size === 3),
    tripletes.length + ' tripletes revisados');
  /* 10 de las 720 permutaciones son rotaciones del alfabeto: 1,4 % por azar,
     o sea menos de uno esperado en 48. Antes salían 48 de 48. */
  m.comprobar('los tripletes consecutivos están a nivel de azar',
    consecutivos.length <= 5,
    consecutivos.length + ' de ' + tripletes.length
    + ' (' + (100 * consecutivos.length / tripletes.length).toFixed(1) + '%, esperado 1,4 % por azar; antes el 100 %)');

  // ═══ 2 · la fila de contraste se heredaba del paciente anterior ═════════
  /* pelliFila se guardaba en localStorage y se restauraba, así que la sesión
     siguiente arrancaba en la fila de otro y la anunciaba como «fila en
     curso». Es una medida a medio hacer, no una preferencia del gabinete. */
  const filaActual = async () => {
    const t = await pc.textContent('#modulo-nombre');
    return +((t.match(/fila (\d+)\/\d+/) || [])[1]);
  };
  /* Se recorre la cartilla entera guiándose por la FILA que dibuja la
     pantalla, no por un número fijo de clics ni por el estado del botón.
     Las dos versiones anteriores se rompían por lo mismo: con ocho filas eran
     cuatro clics escritos a mano, y al bajar a cinco el último caía sobre un
     botón ya deshabilitado; mirar `isEnabled` antes de cada clic tampoco
     basta, porque el mando pinta lo que le llega por el socket y entre la
     consulta y el clic puede llegar el espejo que lo deshabilita. Un timeout
     de 30 s rompía la suite entera en vez de dar un fallo legible.
     La fila que dibuja la pantalla sí es la autoridad, y un clic perdido no
     hace daño: la vuelta siguiente lo repite. */
  const subirBajar = async (boton, hasta) => {
    let pulsaciones = 0;
    for (let f = await filaActual(); f !== hasta && pulsaciones <= 12; f = await filaActual()) {
      await tel.click(boton, { timeout: 4000 }).catch(() => {});
      await tel.waitForTimeout(220);
      pulsaciones++;
    }
    return pulsaciones;
  };
  await subirBajar('#pelli-arriba', 1);
  await tel.waitForTimeout(300);
  const bajadas = await subirBajar('#pelli-abajo', nFilas);
  const avanzada = await filaActual();
  const guardado = await pc.evaluate(() => JSON.parse(localStorage.getItem('bvc') || '{}'));
  m.comprobar('la fila de contraste avanza con el mando hasta la última',
    avanzada === bajadas + 1 && avanzada === nFilas,
    'fila ' + avanzada + ' de ' + nFilas + ' con ' + bajadas + ' pulsaciones');
  m.comprobar('la fila NO se guarda en localStorage', !('pelliFila' in guardado),
    'claves guardadas: ' + Object.keys(guardado).length);
  /* Las preferencias del gabinete sí sobreviven, a propósito. */
  m.comprobar('las preferencias del gabinete sí se guardan',
    guardado.schoberAnillos != null && guardado.infFigura != null && guardado.testDistanceM != null,
    `distancia ${guardado.testDistanceM} m · anillos ${guardado.schoberAnillos}`
    + ` · figura ${guardado.infFigura} · movimiento ${guardado.infMovimiento}`);

  // ═══ 3 · el panel no se abre solo en cada repintado ═══
  /* El defecto de origen era la barra de calibración: renderScreen() forzaba
     su clase `collapsed` desde !esOptotipos, y corre en cada flecha y en cada
     comando del mando, así que replegarla se deshacía a la siguiente pulsación.
     La barra ya no existe, pero el defecto se puede repetir igual con el panel:
     esta pantalla la mira el paciente, y un panel que se abra solo le enseña
     los controles. Así que lo que se sujeta ahora es que NADIE lo abra salvo
     quien lo pida. */
  const panelAbierto = () => pc.evaluate(() => {
    const p = document.getElementById('panel-pc');
    return !!(p && p.checkVisibility({ visibilityProperty: true }));
  });
  await abrir('Optotipos');
  if (await panelAbierto()) { await pc.keyboard.press('Escape'); await pc.waitForTimeout(250); }
  for (const k of ['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'b', 'r', 'u']) {
    await pc.keyboard.press(k); await pc.waitForTimeout(160);
  }
  const traspulsar = await panelAbierto();
  m.comprobar('el panel no se abre solo tras siete pulsaciones',
    !traspulsar, traspulsar ? 'se abrió sin que nadie lo pidiera' : 'sigue cerrado');

  // ═══ 4 · la distancia: editable, pero nunca a ciegas ══════════════════
  /* Esta comprobación ha cambiado de signo DOS veces, y conviene que quede
     escrito por qué, porque las dos veces lo decidió quien usa esto.

     Primero se añadieron dos pasos de ±0,5 m en el mando. Después se quitaron
     enteros: la distancia es una propiedad de la SALA, no un mando por test, y
     cambiarla a mitad de una prueba invita al error que este sistema existe
     para evitar. Y ahora vuelve a ser editable, en el panel del PC, porque
     tenerla solo detrás del diálogo de configuración obligaba a pasar por él
     para corregir un número.

     Lo que se conserva de las tres vueltas es lo único que de verdad importaba:
     que un cambio NO SEA INVISIBLE. Editarla no era el riesgo; el riesgo era
     editarla sin que la geometría lo dijera. Así que lo que se sujeta aquí es
     que al cambiarla cambie la cifra que el test declara, delante de quien la
     toca. Y que se pida sola UNA vez, no en cada arranque. */

  await abrir('Optotipos');
  /* La distancia vive en el menú de «La sala», que cuelga de su ítem en la
     barra: el desplegable de test y el cajón lateral ya no existen. Se entra
     como entra una persona — el ratón al borde de arriba y el ítem. */
  await pc.mouse.move(700, 4);
  await pc.waitForTimeout(300);
  await pc.click('#barra-test [data-test="sala"]', { timeout: 5000 });
  await pc.waitForTimeout(400);

  const mandosDist = await pc.evaluate(() => {
    const c = document.getElementById('pp-dist');
    return { campo: !!c, tipo: c ? c.type : null,
             pasos: document.querySelectorAll('#pp-dist-menos, #pp-dist-mas').length };
  });
  m.comprobar('la distancia de la sala se puede editar en el panel',
    mandosDist.campo && mandosDist.tipo === 'number' && mandosDist.pasos === 2,
    mandosDist.campo ? `campo «${mandosDist.tipo}» y ${mandosDist.pasos} pasos`
                     : 'no hay campo de distancia en el panel');

  /* Y cambiarla se ve: el 20/20 mide la mitad al acercar el paciente a la
     mitad de la distancia. Es la cifra que el propio panel enseña. */
  /* Con `evaluate` y no con `textContent`: el segundo ESPERA al selector, y una
     espera de 30 s dentro de una suite se la lleva entera por delante en vez de
     dar un fallo legible. Aquí no hace falta esperar a nada. */
  /* El 20/20 se lee de LA DECLARACIÓN, que es donde optotipos dice su
     geometría. Antes estaba en la línea de la escala y el rótulo del módulo
     quedaba vacío en optotipos: ahora hay un solo sitio donde se declara. */
  const veinte = async () => +(((await pc.evaluate(() =>
    (document.getElementById('modulo-nombre') || {}).textContent || '')) || '')
    .match(/20\/20 mide ([\d.]+) mm/) || [])[1];
  const antesDist = await pc.evaluate(() => +document.getElementById('pp-dist').value);
  const mmAntes = await veinte();
  await pc.click('#pp-dist-menos');
  await pc.waitForTimeout(500);
  const mmTras = await veinte();
  const trasDist = await pc.evaluate(() => +document.getElementById('pp-dist').value);
  m.comprobar('y cambiarla mueve la geometría que el test declara, a la vista',
    trasDist === antesDist - 0.5 && mmAntes > 0 && mmTras > 0
      && Math.abs(mmTras / mmAntes - trasDist / antesDist) < 0.02,
    `${antesDist} m → ${trasDist} m · el 20/20, de ${mmAntes} a ${mmTras} mm`);
  /* Devolver la sala a donde estaba: las pruebas siguientes cuentan con ella. */
  await pc.click('#pp-dist-mas');
  await pc.waitForTimeout(400);
  await pc.keyboard.press('Escape');
  await pc.waitForTimeout(250);

  /* Lo de «solo se pide la primera vez» se comprueba en pruebas/panel.mjs, que
     tiene su propia página: aquí hay un móvil emparejado y recargar el PC lo
     deja esperando, con lo que todo lo que viene detrás se queda colgado
     midiendo elementos que ya no están.

     Y se vuelve a Schober, que es donde el bloque siguiente espera encontrar
     las dos pantallas: lee la cabecera del MÓVIL, y esa cabecera solo existe
     dentro de un módulo. Cambiar la precondición de un bloque sin mirar el de
     al lado deja al de al lado esperando treinta segundos a un elemento que
     nadie va a pintar. */
  await abrir('Schober');
  await pc.waitForTimeout(400);

  /* Y el mando no tiene NADA que la cambie. Se busca por el comando, no por un
     identificador concreto: así la comprobación sigue valiendo si mañana
     alguien lo vuelve a añadir con otro nombre. */
  const enElMando = await tel.evaluate(() => {
    const v = document.getElementById('vista-modulo');
    const sospechosos = [...v.querySelectorAll('[onclick]')]
      .map(e => e.getAttribute('onclick'))
      .filter(t => /D:/.test(t));
    return { sospechosos, texto: v.textContent.replace(/\s+/g, ' ') };
  });
  m.comprobar('ningún control del mando cambia la distancia',
    enElMando.sospechosos.length === 0,
    enElMando.sospechosos.length
      ? 'manda ' + enElMando.sospechosos.join(', ')
      : 'ninguno manda D:');

  /* Pero la distancia SIGUE a la vista en el mando: una medida cuyas
     condiciones no se ven es lo que este proyecto entero combate. */
  const enCabecera = (await tel.textContent('#mod-dist-val') || '').trim();
  m.comprobar('el mando sigue mostrando a qué distancia se está midiendo',
    /^[\d.,]+\s*m$/.test(enCabecera), `«${enCabecera}»`);

  /* Y que el comando viejo, si alguien lo manda a mano, no haga nada: el
     armazón del socket no debe guardar una puerta de atrás. */
  /* Se mira el RANGO en Δ de Schober, que es lo que la distancia mueve: la
     figura mide siempre el 80 % del lado corto, así que si alguien cambia la
     distancia por detrás, lo que se desplaza es cuántas dioptrías prismáticas
     abarca ese mismo dibujo. */
  const rango = async () => +((await pc.textContent('#modulo-nombre')).match(/rango ±([\d.]+)Δ/) || [])[1];
  const antesDelComando = await rango();
  await tel.evaluate(() => { if (typeof enviar === 'function') enviar('D:menos'); });
  await tel.waitForTimeout(600);
  m.comprobar('el comando D: ya no mueve la geometría', (await rango()) === antesDelComando,
    `el rango sigue en ±${antesDelComando}Δ`);

  /* Lo que sí tiene que funcionar: declararla en la configuración inicial. */
  await abrir('Optotipos');
  await pc.keyboard.press('c');
  await pc.waitForTimeout(500);
  const dialogoAbierto = await pc.evaluate(() => {
    const d = document.getElementById('card-cal');
    return !!d && !d.classList.contains('hidden');
  });
  m.comprobar('la tecla C abre la configuración inicial', dialogoAbierto);
  if (dialogoAbierto) {
    const veinte = async () => +(((await pc.evaluate(() =>
      (document.getElementById('modulo-nombre') || {}).textContent || '')) || '')
      .match(/20\/20 mide ([\d.]+) mm/) || [])[1];
    const antes = await veinte();
    await pc.fill('#test-distance', '3');
    await pc.click('#card-cancel');           // cancelar NO aplica
    await pc.waitForTimeout(500);
    m.comprobar('cancelar la configuración no cambia la distancia', (await veinte()) === antes,
      `20/20 sigue en ${antes} mm`);

    await pc.keyboard.press('c');
    await pc.waitForTimeout(500);
    await pc.fill('#test-distance', '3');
    await pc.click('#card-save');             // guardar SÍ aplica
    await pc.waitForTimeout(700);
    const despues = await veinte();
    /* El valor ya no está en una barra —esa barra se fue al panel— sino en el
       campo de distancia del propio panel, que es donde ahora se corrige. */
    const campo = await pc.evaluate(() =>
      (document.getElementById('pp-dist') || {}).value || '');
    /* El 20/20 son 5' de arco: a la mitad de distancia, la mitad de milímetros. */
    m.comprobar('guardar la configuración aplica la distancia nueva',
      Math.abs(despues - antes / 2) < 0.05 && parseFloat(campo) === 3,
      `20/20 de ${antes} a ${despues} mm · el panel dice «${campo} m»`);
  }

  return m;
}
