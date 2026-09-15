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
    await tel.click('#panel-pelli .conmut');        // «Letras nuevas en las ocho filas»
    await tel.waitForTimeout(450);
    cartillas.push(await leerCartilla());
  }
  const tripletes = cartillas.flatMap(c => c.match(/.{3}/g) || []);
  const consecutivos = tripletes.filter(t => {
    const i = [...t].map(c => SLOAN.indexOf(c));
    return i.every(x => x >= 0) && i[1] === (i[0] + 1) % 10 && i[2] === (i[0] + 2) % 10;
  });

  m.comprobar('24 letras por cartilla', cartillas.every(c => c.length === 24),
    'longitudes ' + [...new Set(cartillas.map(c => c.length))].join('/'));
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
    return +((t.match(/fila (\d)\/8/) || [])[1]);
  };
  for (let i = 0; i < 9 && await tel.isEnabled('#pelli-arriba'); i++) {
    await tel.click('#pelli-arriba'); await tel.waitForTimeout(150);
  }
  await tel.waitForTimeout(300);
  for (let i = 0; i < 4; i++) { await tel.click('#pelli-abajo'); await tel.waitForTimeout(200); }
  const avanzada = await filaActual();
  const guardado = await pc.evaluate(() => JSON.parse(localStorage.getItem('bvc') || '{}'));
  m.comprobar('la fila de contraste avanza con el mando', avanzada === 5, 'fila ' + avanzada);
  m.comprobar('la fila NO se guarda en localStorage', !('pelliFila' in guardado),
    'claves guardadas: ' + Object.keys(guardado).length);
  /* Las preferencias del gabinete sí sobreviven, a propósito. */
  m.comprobar('las preferencias del gabinete sí se guardan',
    guardado.worthTam != null && guardado.schoberAnillos != null && guardado.testDistanceM != null,
    `distancia ${guardado.testDistanceM} m · worth ${guardado.worthTam} · anillos ${guardado.schoberAnillos}`);

  // ═══ 3 · la barra de calibración se desplegaba sola en cada repintado ═══
  /* renderScreen() forzaba la clase collapsed desde !esOptotipos, y corre en
     cada flecha y en cada comando del mando: replegar la barra se deshacía a
     la siguiente pulsación. Ahora la decisión se toma solo al CAMBIAR de
     módulo, que es la conducta que se quería. */
  const plegada = () => pc.evaluate(() =>
    document.getElementById('calibration-bar').classList.contains('collapsed'));
  await abrir('Optotipos');
  if (await plegada()) { await pc.keyboard.press('h'); await pc.waitForTimeout(250); }
  await pc.keyboard.press('h'); await pc.waitForTimeout(250);           // plegar
  const tras = await plegada();
  for (const k of ['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft']) {
    await pc.keyboard.press(k); await pc.waitForTimeout(180);
  }
  const sigue = await plegada();
  m.comprobar('la barra plegada sigue plegada tras cuatro flechas', tras && sigue,
    !tras ? 'la tecla H no llegó a plegarla' : (sigue ? 'plegada antes y después' : 'se plegó y las flechas la volvieron a desplegar'));

  await pc.keyboard.press('h'); await pc.waitForTimeout(250);           // desplegar
  await abrir('Pelli-Robson');
  m.comprobar('al ENTRAR en un módulo se repliega sola', await plegada());
  await pc.keyboard.press('h'); await pc.waitForTimeout(250);           // el operador la abre dentro
  await tel.click('#pelli-abajo'); await tel.waitForTimeout(350);
  await tel.click('#panel-pelli .conmut'); await tel.waitForTimeout(350);
  const abiertaTrasComandos = !(await plegada());
  m.comprobar('abierta dentro del módulo, aguanta dos comandos del mando',
    abiertaTrasComandos,
    abiertaTrasComandos ? 'sigue abierta' : 'un comando del mando la volvió a plegar');

  // ═══ 4 · la distancia de sala se declara UNA VEZ ═══════════════════════
  /* Esta comprobación cambió de signo, y conviene que quede escrito por qué.
     La revisión había señalado que la distancia no se podía tocar dentro de un
     módulo, y se añadieron dos pasos de ±0,5 m en el mando. El criterio de
     quien usa esto es el contrario y es mejor: la distancia es una propiedad
     de la SALA, no un mando por test. Poder cambiarla a mitad de una prueba
     invita justo al error que este sistema existe para evitar — que la
     geometría y el sitio donde está sentado el paciente dejen de coincidir sin
     que nada lo delate.
     Así que ahora se declara en la configuración inicial y en ningún otro
     sitio, y lo que se protege es lo de no poder cambiarla desde un test. */

  await abrir('Schober');

  /* En la barra de la pantalla la distancia es un VALOR, no un campo: si
     alguien vuelve a poner un <input> ahí, esto se pone rojo. */
  const enLaBarra = await pc.evaluate(() => {
    const g = document.querySelector('#calibration-bar .cal-group');
    if (!g) return null;
    return {
      texto: g.textContent.replace(/\s+/g, ' ').trim(),
      editables: g.querySelectorAll('input, select, button').length
    };
  });
  m.comprobar('la barra muestra la distancia sin dejar editarla',
    enLaBarra && enLaBarra.editables === 0,
    enLaBarra ? `«${enLaBarra.texto}» · ${enLaBarra.editables} controles editables`
              : 'no encuentro el grupo de distancia en la barra');

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
  const paso = async () => +((await pc.textContent('#modulo-nombre')).match(/1Δ = (\d+)/) || [])[1];
  const antesDelComando = await paso();
  await tel.evaluate(() => { if (typeof enviar === 'function') enviar('D:menos'); });
  await tel.waitForTimeout(600);
  m.comprobar('el comando D: ya no mueve la geometría', (await paso()) === antesDelComando,
    `1Δ sigue en ${antesDelComando} mm`);

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
    const veinte = async () => +((await pc.textContent('#info-span')).match(/20\/20: ([\d.]+)mm/) || [])[1];
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
    const barra = await pc.textContent('#dist-sala');
    /* El 20/20 son 5' de arco: a la mitad de distancia, la mitad de milímetros. */
    m.comprobar('guardar la configuración aplica la distancia nueva',
      Math.abs(despues - antes / 2) < 0.05 && barra.trim() === '3',
      `20/20 de ${antes} a ${despues} mm · la barra dice «${barra.trim()} m»`);
  }

  return m;
}
