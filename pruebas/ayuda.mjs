/* ═══════════════════════════════════════════════════════════════════════════
   Lo compartido por todas las pruebas: encontrar Playwright, levantar el
   servidor en un puerto libre, y emparejar una pantalla con un mando de
   verdad — no simulando el socket.

   Por qué el navegador y no pruebas unitarias: casi todo lo que esta app
   tiene que hacer bien es GEOMETRÍA EN PÍXELES. Que una letra mida 8,727 mm
   no se comprueba leyendo el código, se comprueba midiendo la caja de tinta
   que el navegador dibuja con la fuente cargada. Varios defectos reales de
   este proyecto (la rejilla de Amsler a la que le faltaban dos lados, las
   líneas que alternaban grueso y fino, la primera fila de Pelli cortada en
   el píxel 0) eran invisibles en el DOM y solo salieron al medir.
   ═══════════════════════════════════════════════════════════════════════════ */
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));
export const RAIZ = join(AQUI, '..');

/* ── Playwright ──────────────────────────────────────────────────────────
   No es dependencia del proyecto a propósito: el servidor no la necesita y
   arrastra un navegador de cientos de megas. Se busca donde suele estar y,
   si no está, la prueba lo DICE y sale con código 2 — nunca en verde. Una
   suite que pasa sin haberse ejecutado es peor que no tenerla. */
export async function cargarChromium() {
  /* PLAYWRIGHT_MODULE es un override ESTRICTO: si se da y no carga, no se
     busca en otro sitio. Al principio era el primer candidato de la lista y
     al fallar caía al Playwright global, con lo que el override no servía
     para nada — apuntarlo a una ruta inexistente daba una suite en verde
     ejecutada con otra instalación. Un override que se ignora en silencio es
     peor que no tenerlo. */
  const forzado = process.env.PLAYWRIGHT_MODULE;
  if (forzado) {
    try { return (await import(forzado)).chromium; }
    catch (e) { throw new Error('PLAYWRIGHT_MODULE apunta a ' + forzado + ' y no carga: ' + e.message); }
  }
  const candidatos = [
    'playwright',
    '/opt/node22/lib/node_modules/playwright/index.mjs',
    '/usr/lib/node_modules/playwright/index.mjs',
    '/usr/local/lib/node_modules/playwright/index.mjs',
    join(RAIZ, 'node_modules/playwright/index.mjs')
  ];
  for (const c of candidatos) {
    try { return (await import(c)).chromium; } catch { /* siguiente */ }
  }
  return null;
}

/* ── un puerto libre de verdad ───────────────────────────────────────────
   Pedirle al sistema el puerto 0 y quedarse con el que asigne evita que dos
   ejecuciones a la vez se peleen por un número fijo. */
export function puertoLibre() {
  return new Promise((ok, mal) => {
    const s = createServer();
    s.once('error', mal);
    s.listen(0, '127.0.0.1', () => {
      const p = s.address().port;
      s.close(() => ok(p));
    });
  });
}

export async function levantarServidor() {
  const puerto = await puertoLibre();
  const proc = spawn(process.execPath, [join(RAIZ, 'server.js')], {
    env: { ...process.env, PORT: String(puerto) },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const salida = [];
  proc.stdout.on('data', d => salida.push(String(d)));
  proc.stderr.on('data', d => salida.push(String(d)));

  const url = `http://127.0.0.1:${puerto}/`;
  const limite = Date.now() + 15000;
  for (;;) {
    if (proc.exitCode !== null) {
      throw new Error('el servidor murió al arrancar:\n' + salida.join(''));
    }
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (r.ok) break;
    } catch { /* todavía no escucha */ }
    if (Date.now() > limite) {
      proc.kill();
      throw new Error('el servidor no respondió en 15 s:\n' + salida.join(''));
    }
    await new Promise(r => setTimeout(r, 200));
  }
  return { url, cerrar: () => new Promise(ok => { proc.once('exit', ok); proc.kill(); }) };
}

/* ── una pantalla y un mando emparejados ─────────────────────────────────
   El código de sala se lee del panel de atajos, que es de donde lo lee el
   optometrista. Así la prueba recorre el mismo camino que una sala real en
   vez de inyectar el código por detrás. */
export async function emparejar(navegador, url, opciones = {}) {
  const { ancho = 1600, alto = 900, dpr = 1, distancia = null } = opciones;
  const errores = [];

  const ctxPC = await navegador.newContext({ viewport: { width: ancho, height: alto }, deviceScaleFactor: dpr });
  /* La distancia de sala ya no se teclea en la barra: se declara UNA VEZ en la
     configuración inicial. Así que una prueba que quiere otra distancia siembra
     una sala ya configurada, que es el estado real de un equipo en uso, en vez
     de escribir en un campo que ya no existe. */
  if (distancia != null) {
    await ctxPC.addInitScript(m => {
      try {
        const g = JSON.parse(localStorage.getItem('bvc') || '{}');
        g.testDistanceM = m; g.calAck = true;
        localStorage.setItem('bvc', JSON.stringify(g));
      } catch (e) {}
    }, distancia);
  }
  const pc = await ctxPC.newPage();
  pc.on('pageerror', e => errores.push('PANTALLA: ' + e.message));
  pc.on('console', m => { if (m.type() === 'error') errores.push('PANTALLA consola: ' + m.text()); });
  await pc.goto(url);
  await pc.evaluate(() => document.fonts.ready);
  await pc.waitForTimeout(1400);
  await pc.click('#card-cancel').catch(() => {});      // el diálogo de calibración
  await pc.click('#shortcuts-toggle');
  await pc.waitForTimeout(500);
  const codigo = (await pc.textContent('#pair-code-label') || '').trim();
  await pc.keyboard.press('Escape');
  await pc.waitForTimeout(300);
  if (!/^[A-Z0-9]{4,8}$/.test(codigo)) throw new Error('código de sala ilegible: ' + JSON.stringify(codigo));

  const ctxTel = await navegador.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
  const tel = await ctxTel.newPage();
  tel.on('pageerror', e => errores.push('MANDO: ' + e.message));
  tel.on('console', m => { if (m.type() === 'error') errores.push('MANDO consola: ' + m.text()); });
  await tel.goto(url + 'remote?c=' + codigo);
  await tel.evaluate(() => document.fonts.ready);
  await tel.waitForTimeout(2000);

  /* El mando llega al módulo por el menú, tocando la fila, igual que un dedo. */
  const abrir = async nombre => {
    await tel.click('.cabecera .atras').catch(() => {});
    await tel.waitForTimeout(350);
    await tel.locator('#lista-modulos .fila-mod').filter({ hasText: nombre }).first().click();
    await tel.waitForTimeout(800);
    return (await pc.textContent('#modulo-nombre')).trim();
  };

  return { pc, tel, codigo, errores, abrir };
}

/* ── el marcador ─────────────────────────────────────────────────────────
   Cada prueba devuelve una lista de comprobaciones con su detalle. El detalle
   se imprime SIEMPRE, no solo al fallar: la cifra medida es la mitad del
   valor de la prueba, porque es lo que permite ver que una geometría se
   movió aunque siga dentro de la tolerancia. */
export function marcador(titulo) {
  const filas = [];
  return {
    titulo,
    filas,
    comprobar(nombre, ok, detalle = '') { filas.push({ nombre, ok: !!ok, detalle }); return !!ok; },
    nota(nombre, detalle) { filas.push({ nombre, ok: null, detalle }); },
    get fallos() { return filas.filter(f => f.ok === false).length; }
  };
}

/* El modo de optotipo se elegía en los chips de la barra del PC, y esos chips
   se han ido al panel de control: eran una segunda interfaz para la misma
   orden, a la vista del paciente todo el rato. Aquí se hace lo que hace una
   persona — abrir el panel, pulsar, cerrar — y se cierra SIEMPRE, porque el
   panel se superpone y una sonda de píxeles con el panel abierto mide el panel. */
export async function elegirModo(pagina, modo) {
  const abierto = () => pagina.evaluate(() => {
    const p = document.getElementById('panel-pc');
    return !!(p && p.checkVisibility({ visibilityProperty: true }));
  });
  if (!(await abierto())) { await pagina.keyboard.press('p'); await pagina.waitForTimeout(300); }
  await pagina.click(`#panel-pc [data-cmd="Mode:${modo}"]`, { timeout: 5000 });
  await pagina.waitForTimeout(350);
  await pagina.keyboard.press('Escape');
  await pagina.waitForTimeout(250);
}
