/* ═══════════════════════════════════════════════════════════════════════════
   La pantalla sola, sin móvil emparejado.

   Los ocho módulos son alcanzables SOLO desde el mando, así que todo el
   armazón de módulos podría romper el uso más común —un optometrista con el
   PC y el teclado— sin que ninguna prueba de módulos lo notara. Esta prueba
   existe para que ese camino no se degrade en silencio: arranca en optotipos,
   las flechas navegan, y si socket.io no está disponible la pantalla sigue
   funcionando en vez de quedarse en blanco.
   ═══════════════════════════════════════════════════════════════════════════ */
import { marcador } from './ayuda.mjs';

export default async function pruebaSinMando({ navegador, url }) {
  const m = marcador('La pantalla sin mando');
  const errores = [];
  const ctx = await navegador.newContext({ viewport: { width: 1600, height: 900 } });
  const pc = await ctx.newPage();
  pc.on('pageerror', e => errores.push('pageerror: ' + e.message));
  pc.on('console', mm => { if (mm.type() === 'error') errores.push('consola: ' + mm.text()); });

  await pc.goto(url);
  await pc.evaluate(() => document.fonts.ready);
  await pc.waitForTimeout(1400);
  await pc.click('#card-cancel').catch(() => {});

  const estado = () => pc.evaluate(() => ({
    lineas: document.querySelectorAll('#lines-container > div').length,
    moduloOculto: document.getElementById('modulo-area').classList.contains('oculto'),
    enModulo: document.body.classList.contains('en-modulo')
  }));

  const a = await estado();
  m.comprobar('arranca dibujando optotipos', a.lineas > 0 && a.moduloOculto && !a.enModulo,
    `${a.lineas} líneas · capa de módulo ${a.moduloOculto ? 'oculta' : 'VISIBLE'}`);

  /* Las teclas de siempre siguen haciendo lo de siempre. */
  await pc.keyboard.press('ArrowDown'); await pc.waitForTimeout(300);
  const b = await estado();
  m.comprobar('las flechas siguen navegando pantallas', b.lineas > 0 && b.moduloOculto,
    `${b.lineas} líneas`);

  for (const k of ['b', 'r', 'u']) { await pc.keyboard.press(k); await pc.waitForTimeout(200); }
  for (const k of ['b', 'r', 'u']) { await pc.keyboard.press(k); await pc.waitForTimeout(200); }
  const c = await estado();
  m.comprobar('bicromático, resaltar e individual no sacan de optotipos',
    c.lineas > 0 && c.moduloOculto, `${c.lineas} líneas`);

  /* M vuelve a optotipos: desde el PC no se entra a ningún otro módulo, así
     que la tecla tiene que ser inocua aquí y no dejar la capa puesta. */
  await pc.keyboard.press('m'); await pc.waitForTimeout(400);
  const d = await estado();
  m.comprobar('la tecla M deja la pantalla en optotipos',
    d.lineas > 0 && d.moduloOculto && !d.enModulo, `${d.lineas} líneas`);

  /* La N corta el estímulo, y tiene que hacerlo SIN el móvil: es el uso más
     común de todo esto y el panel de atajos la anuncia sin condiciones. */
  await pc.keyboard.press('n'); await pc.waitForTimeout(400);
  const cortada = await pc.evaluate(() => ({
    lineas: document.querySelectorAll('#lines-container > div').length,
    lineasOcultas: document.getElementById('lines-container').classList.contains('oculto'),
    estimulos: document.getElementById('modulo-area').querySelectorAll(':scope > *:not(.corte-aviso)').length,
    texto: (document.getElementById('modulo-area').textContent || '').replace(/\s+/g, ' ').trim(),
    nombre: (document.getElementById('modulo-nombre') || {}).textContent || ''
  }));
  m.comprobar('la tecla N corta el estímulo en la pantalla sola',
    cortada.lineasOcultas && cortada.estimulos === 0 && /CORTAD/i.test(cortada.nombre),
    `optotipos ${cortada.lineasOcultas ? 'ocultos' : 'A LA VISTA (' + cortada.lineas + ' líneas)'}`
    + ` · estímulo ${cortada.estimulos} · «${cortada.nombre.slice(0, 40)}»`);

  await pc.keyboard.press('n'); await pc.waitForTimeout(400);
  const reanudada = await estado();
  m.comprobar('y volver a pulsarla devuelve los optotipos',
    reanudada.lineas > 0 && reanudada.moduloOculto, `${reanudada.lineas} líneas`);

  m.comprobar('sin errores de consola en todo el recorrido', errores.length === 0,
    errores.length ? errores.slice(0, 3).join(' | ') : 'ninguno');

  await ctx.close();
  return m;
}
