/* ═══════════════════════════════════════════════════════════════════════════
   Lo que pasa cuando falla la infraestructura, no el código.

   Esto se despliega en Render y se usa en un consultorio con el Wi-Fi de un
   consultorio. Un parpadeo de la red a mitad de un examen no puede dejar al
   paciente delante de una pantalla muerta: es la misma regla que el corte de
   estímulo, solo que la causa viene de fuera.

   Las tres cosas que se miden aquí no se pueden medir en el DOM ni con una
   sonda de píxeles — son de red y de servidor:

     · Con la red caída, la pantalla del paciente sigue dibujando la cartilla,
       con su geometría, y el panel sigue llegando a los ocho módulos. Sin
       móvil, que es lo que se puede prometer sin servidor: el emparejamiento
       pasa por el socket y el socket necesita red.
     · Lo que el servidor manda va comprimido. `index.html` son 244 KB y
       `remote.html` 92 KB, y el que paga los datos es el móvil del
       optometrista.
     · El código de sala es el único secreto que separa dos consultorios. Sin
       freno, un socket puede probar códigos tan rápido como quiera.
   ═══════════════════════════════════════════════════════════════════════════ */
import http from 'node:http';
import { marcador } from './ayuda.mjs';

export default async function pruebaSinRed({ navegador, url }) {
  const m = marcador('Cuando falla la red, no el código');

  // ── 1 · Comprimido ──────────────────────────────────────────────────────
  /* Con `node:http` y no con `fetch`: fetch descomprime solo, así que mide el
     fichero y no lo que pasa por el cable, que es justo lo que se quiere saber.
     Aquí se cuentan los bytes crudos. */
  const porElCable = (u, comprimir) => new Promise((ok, mal) => {
    const req = http.get(u, { headers: { 'accept-encoding': comprimir ? 'gzip' : 'identity' } },
      res => {
        let bytes = 0;
        res.on('data', t => { bytes += t.length; });
        res.on('end', () => ok({ bytes, codificacion: res.headers['content-encoding'] || 'ninguna' }));
      });
    req.on('error', mal);
    req.setTimeout(8000, () => { req.destroy(new Error('sin respuesta en 8 s')); });
  });

  const pesos = {};
  for (const ruta of ['', 'remote']) {
    pesos[ruta || 'index'] = {
      crudo: (await porElCable(url + ruta, false)).bytes,
      ...(await porElCable(url + ruta, true))
    };
  }
  const comprimidos = Object.values(pesos).filter(v => /gzip|br|deflate/.test(v.codificacion));
  /* No basta con que llegue la cabecera: se exige que el ahorro sea de verdad.
     Un `content-encoding` sobre algo que no encoge es una cabecera bonita. */
  const flojos = Object.entries(pesos).filter(([, v]) => v.bytes > v.crudo * 0.4);
  m.comprobar('el servidor comprime las dos páginas, y de verdad',
    comprimidos.length === 2 && flojos.length === 0,
    Object.entries(pesos).map(([k, v]) => `${k}: ${(v.crudo / 1024).toFixed(0)} KB`
      + ` → ${(v.bytes / 1024).toFixed(0)} KB por el cable (${v.codificacion},`
      + ` ×${(v.crudo / Math.max(1, v.bytes)).toFixed(1)})`).join(' | '));

  // ── 2 · El código de sala tiene freno ───────────────────────────────────
  /* Se prueban códigos inválidos a la velocidad a la que los probaría un
     script. Lo que se exige no es que el primero falle —eso ya pasaba— sino
     que el intento número N no llegue a evaluarse: sin freno, 36^5 códigos son
     una tarde de trabajo y el daño es cambiarle la cartilla a otra consulta. */
  const intentos = 25;
  /* Desde una página, con el cliente que el propio servidor sirve: así no hace
     falta meter `socket.io-client` en el proyecto para probar esto — el
     servidor no la necesita y aquí tampoco. */
  const ctxSock = await navegador.newContext();
  const pSock = await ctxSock.newPage();
  await pSock.goto(url);
  await pSock.waitForTimeout(1200);
  const freno = await pSock.evaluate(async n => {
    const s = io(location.origin, { transports: ['websocket'], reconnection: false,
                                    forceNew: true });
    await new Promise(ok => s.on('connect', ok));
    let errores = 0, motivo = null;
    s.on('joinError', () => errores++);
    /* EL MOTIVO, no «se desconectó». La primera versión marcaba cualquier
       desconexión, y la que llega siempre es la del `close()` de más abajo: con
       el freno quitado a propósito la comprobación seguía en verde. Una prueba
       que no puede fallar no comprueba nada. Lo que se busca es que lo corte el
       SERVIDOR, que socket.io llama «io server disconnect». */
    s.on('disconnect', r => { if (!motivo) motivo = r; });
    for (let i = 0; i < n; i++) s.emit('join', 'no');       // siempre inválido
    await new Promise(r => setTimeout(r, 1400));
    const abierto = s.connected;
    s.close();
    return { errores, motivo, abierto };
  }, intentos);
  await ctxSock.close();
  const loCorto = freno.motivo === 'io server disconnect';
  m.comprobar('probar códigos de sala a lo bruto tiene freno',
    loCorto && freno.errores < intentos,
    `${intentos} intentos inválidos → ${freno.errores} respuestas · `
    + (loCorto ? 'el servidor cortó la conexión'
               : 'el servidor NO cortó (motivo: ' + (freno.motivo || 'ninguno') + ')'));

  // ── 3 · Sin red, la pantalla del paciente sigue dibujando ───────────────
  /* Primera visita con red: es cuando el service worker se instala y guarda lo
     que hace falta. Después se corta la red de verdad —`setOffline`, no un
     truco en el código— y se recarga. */
  const ctx = await navegador.newContext({ viewport: { width: 1600, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(url);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(1600);
  await p.click('#card-save').catch(() => {});
  await p.waitForTimeout(400);

  /* Con reloj: `serviceWorker.ready` no falla cuando no hay service worker, se
     queda esperando PARA SIEMPRE. Sin esta carrera, quitar el fichero a
     propósito no ponía la prueba en rojo — colgaba la suite entera, que es
     peor: un fallo que no se puede leer. */
  const instalado = await p.evaluate(async () => {
    if (!navigator.serviceWorker) return { hay: false, motivo: 'el navegador no lo ofrece' };
    const reloj = new Promise(ok => setTimeout(() => ok(null), 6000));
    const reg = await Promise.race([navigator.serviceWorker.ready, reloj]).catch(() => null);
    if (!reg) return { hay: false, motivo: 'no se activó ninguno en 6 s' };
    return { hay: !!reg.active, estado: reg.active && reg.active.state };
  });
  m.comprobar('la pantalla registra un service worker al abrirse',
    instalado.hay, instalado.hay ? 'activo' : 'no hay: ' + (instalado.motivo || '?'));

  /* Y que haya guardado de verdad lo que hace falta, no solo que exista. */
  const guardado = await p.evaluate(async () => {
    if (!window.caches) return null;
    const nombres = await caches.keys();
    const urls = [];
    for (const n of nombres) {
      const c = await caches.open(n);
      for (const req of await c.keys()) urls.push(new URL(req.url).pathname);
    }
    return { nombres, urls };
  });
  const hacenFalta = ['/', '/remote', '/OpticianSans.woff', '/qrcode.js'];
  const faltan = guardado ? hacenFalta.filter(u => !guardado.urls.includes(u)) : hacenFalta;
  m.comprobar('y guarda las cuatro cosas con las que la suite se dibuja',
    faltan.length === 0,
    faltan.length ? 'falta ' + faltan.join(', ')
      : guardado.urls.length + ' entradas en ' + guardado.nombres.join(', '));

  await ctx.setOffline(true);
  await p.reload().catch(() => {});
  await p.waitForTimeout(1800);
  const sinRed = await p.evaluate(() => {
    const lc = document.getElementById('lines-container');
    return {
      lineas: lc ? lc.querySelectorAll(':scope > div').length : 0,
      tinta: lc ? (lc.textContent || '').replace(/\s+/g, ' ').trim().length : 0,
      fuente: document.fonts.check('1em OpticianSans'),
      blanco: (document.body.textContent || '').trim().length === 0
    };
  });
  m.comprobar('con la red caída la pantalla del paciente sigue dibujando la cartilla',
    sinRed.lineas > 0 && !sinRed.blanco,
    sinRed.blanco ? 'la pantalla se quedó en blanco: el paciente sin nada y sin una palabra'
      : `${sinRed.lineas} líneas · ${sinRed.tinta} caracteres de optotipo · `
        + `la fuente ${sinRed.fuente ? 'cargó del caché' : 'NO cargó'}`);

  /* Y que el panel siga llevando a los ocho: sin red no hay móvil, así que el
     panel del PC es el único camino que queda. */
  await p.keyboard.press('p');
  await p.waitForTimeout(400);
  const ocho = [];
  for (const id of ['optotipos', 'color', 'infantil', 'relax',
                    'contraste', 'worth', 'schober', 'amsler']) {
    await p.selectOption('#panel-modulo', id).catch(() => {});
    await p.waitForTimeout(400);
    /* Sin guardas esto REVIENTA en vez de fallar: sin copia guardada la
       recarga deja la página del navegador y `#modulo-area` no existe. Una
       suite que peta da un mensaje que no se puede leer; lo que hace falta es
       que diga «no dibuja nada». */
    const pinta = await p.evaluate(() => {
      const ma = document.getElementById('modulo-area');
      return { est: ma ? ma.querySelectorAll(':scope > *:not(.corte-aviso)').length : 0,
               lin: document.querySelectorAll('#lines-container > div').length };
    }).catch(() => ({ est: 0, lin: 0 }));
    if (pinta.est > 0 || pinta.lin > 0) ocho.push(id);
  }
  m.comprobar('y el panel sigue llevando a los ocho test sin servidor',
    ocho.length === 8, ocho.length + ' de 8: ' + ocho.join(' '));

  await ctx.setOffline(false);
  await ctx.close();
  return m;
}
