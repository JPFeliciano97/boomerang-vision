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

  // ═══ 4 · la distancia de sala no se alcanzaba dentro de un módulo ═══════
  /* El CSS escondía el único campo de distancia al entrar en un módulo, pero
     Worth, Schober, relax y fijación calculan su estímulo físico contra
     ella: mover la silla dejaba la geometría calculada contra la distancia
     vieja, sin forma de corregirla sin salir. */
  await abrir('Schober');
  const campoVisible = () => pc.evaluate(() => {
    const g = document.querySelector('#calibration-bar .cal-group');
    return !!g && g.getBoundingClientRect().width > 0;
  });
  const pasosVisibles = () => tel.evaluate(() => {
    const p = document.getElementById('mod-dist-pasos');
    return !!p && !p.classList.contains('oculto');
  });
  const hayCampo = await campoVisible(), hayPasos = await pasosVisibles();
  m.comprobar('en un módulo de sala el campo de distancia sigue a la vista', hayCampo,
    hayCampo ? '' : 'escondido: la distancia no se puede corregir sin salir del módulo');
  m.comprobar('y el mando ofrece los pasos de distancia', hayPasos,
    hayPasos ? '' : 'sin pasos: la silla se mueve y la geometría no');

  /* El resto de la sección mueve la distancia, y sin pasos no hay nada que
     mover: se marca como no recorrido en vez de colgarse 30 s en un clic. */
  if (!hayPasos) {
    m.nota('el recorrido de la distancia', 'no se recorre porque el mando no ofrece los pasos');
    return m;
  }
  const paso = async () => +((await pc.textContent('#modulo-nombre')).match(/1Δ = (\d+)/) || [])[1];
  const dist = async () => +(await pc.inputValue('#test-distance'));
  const d0 = await dist(), p0 = await paso();
  await tel.click('#mod-dist-pasos button:first-child');               // acercar 0,5 m
  await tel.waitForTimeout(600);
  const d1 = await dist(), p1 = await paso();
  const espejo = (await tel.textContent('#mod-dist-val')).trim();
  m.comprobar('el paso «−» del mando acerca medio metro', Math.abs(d1 - (d0 - 0.5)) < 1e-9,
    d0 + ' → ' + d1 + ' m');
  m.comprobar('1Δ se recalcula con la distancia nueva', Math.abs(p1 - p0) > 1,
    p0 + ' → ' + p1 + ' mm');
  m.comprobar('el mando refleja la distancia nueva', espejo === d1 + ' m', espejo);

  /* Los topes: por debajo de 0,5 m no hay sala y por encima de 10 m no hay
     consultorio; sin tope el operador puede dejar la geometría en absurdo. */
  for (let i = 0; i < 25; i++) { await tel.click('#mod-dist-pasos button:first-child'); await tel.waitForTimeout(50); }
  await tel.waitForTimeout(500);
  const minimo = await dist();
  for (let i = 0; i < 45; i++) { await tel.click('#mod-dist-pasos button:last-child'); await tel.waitForTimeout(50); }
  await tel.waitForTimeout(500);
  const maximo = await dist();
  m.comprobar('la distancia queda entre 0,5 y 10 m', minimo === 0.5 && maximo === 10,
    minimo + ' … ' + maximo + ' m');

  /* Devolver la sala a 6 m: las pruebas no deben dejar estado raro. Se escribe
     el valor y se lanza el evento en vez de usar fill(), que espera a que el
     campo sea visible y editable y se cuelga 30 s si el CSS lo esconde. */
  await pc.evaluate(() => {
    const i = document.getElementById('test-distance');
    if (!i) return;
    i.value = '6';
    i.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await pc.waitForTimeout(400);

  return m;
}
