/* ═══════════════════════════════════════════════════════════════════════════
   El recorrido de un equipo nuevo: de abrir el navegador a tener los ocho
   módulos al alcance.

   Esta suite nace de medir ese recorrido y encontrarlo roto. Los otros siete
   módulos se alcanzan SOLO desde el móvil, y el QR vivía dentro de un panel
   rotulado «Mostrar atajos» que nace con la clase 'hidden' puesta. Medido: a
   1,8 s, a 10,8 s y tras guardar la configuración, el panel seguía oculto, el
   QR sin dibujar y el código de sala vacío. Había además un setTimeout de 8 s
   «para esconderlo», que escondía algo ya escondido — código muerto que hacía
   creer que el panel se mostraba solo.

   Así que quien abría la app por primera vez se quedaba con optotipos en
   pantalla, «SIN MANDO» en el pie, y ninguna indicación de que existe una
   suite clínica detrás. El estímulo más caro de construir era el invisible.

   Lo que se protege aquí es que el camino siga completo: que la configuración
   se abra sola, que el emparejamiento esté A LA VISTA en ella, y que el código
   que muestra sirva de verdad para que un móvil llegue a los ocho módulos.
   ═══════════════════════════════════════════════════════════════════════════ */
import { marcador } from './ayuda.mjs';

export default async function pruebaArranque({ navegador, url }) {
  const m = marcador('El arranque de un equipo nuevo');

  /* Contexto virgen: sin 'bvc' en localStorage, que es el estado de un equipo
     que nunca se ha configurado. */
  const ctx = await navegador.newContext({ viewport: { width: 1600, height: 950 } });
  const errores = [];
  const pc = await ctx.newPage();
  pc.on('pageerror', e => errores.push('pageerror: ' + e.message));
  pc.on('console', mm => { if (mm.type() === 'error') errores.push('consola: ' + mm.text()); });

  await pc.goto(url);
  await pc.evaluate(() => document.fonts.ready);
  await pc.waitForTimeout(1600);

  // ── 1 · la configuración se abre sola ───────────────────────────────────
  const abierta = await pc.evaluate(() =>
    !document.getElementById('card-cal').classList.contains('hidden'));
  m.comprobar('un equipo sin configurar abre la configuración por sí mismo', abierta,
    abierta ? '' : 'nadie le dice al optometrista que hay algo que declarar');

  // ── 2 · las tres cosas están en ella ────────────────────────────────────
  const dentro = await pc.evaluate(() => {
    const dlg = document.getElementById('card-cal');
    const qr = document.getElementById('qr-config');
    return {
      distancia: !!dlg.querySelector('#test-distance'),
      medida: !!dlg.querySelector('#card-shape'),
      qrDibujado: !!qr && qr.children.length > 0,
      codigo: (dlg.querySelector('#pair-code-config') || {}).textContent || '',
      texto: dlg.textContent.replace(/\s+/g, ' ')
    };
  });
  m.comprobar('pide la distancia de la sala', dentro.distancia);
  m.comprobar('pide medir la pantalla', dentro.medida);
  m.comprobar('y muestra el QR de emparejamiento ya dibujado', dentro.qrDibujado,
    dentro.qrDibujado ? '' : 'el QR no está: el móvil queda por descubrir');
  m.comprobar('con el código de sala escrito', /^[A-Z0-9]{4,8}$/.test(dentro.codigo.trim()),
    `«${dentro.codigo.trim()}»`);
  /* Y que diga para qué sirve el móvil: un QR sin explicación no cuenta. */
  m.comprobar('explica que los otros siete test se manejan desde el móvil',
    /siete test|desde el móvil/i.test(dentro.texto),
    /siete/i.test(dentro.texto) ? 'lo dice' : 'no lo menciona');

  // ── 3 · el código que muestra sirve de verdad ───────────────────────────
  const codigo = dentro.codigo.trim();
  await pc.click('#card-save');
  await pc.waitForTimeout(700);

  const ctxTel = await navegador.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
  const tel = await ctxTel.newPage();
  tel.on('pageerror', e => errores.push('MANDO pageerror: ' + e.message));
  await tel.goto(url + 'remote?c=' + codigo);
  await tel.evaluate(() => document.fonts.ready);
  await tel.waitForTimeout(2200);

  const pie = (await pc.textContent('#remote-status') || '').trim();
  m.comprobar('un móvil que sigue ese código queda emparejado',
    /conectado/i.test(pie), `el pie dice «${pie}»`);

  /* Y llega a los ocho: el menú es lo que hace visible la suite. */
  await tel.click('.cabecera .atras').catch(() => {});
  await tel.waitForTimeout(700);
  const enMenu = await tel.evaluate(() =>
    [...document.querySelectorAll('.fila-mod .tit')].map(e => e.textContent.trim()));
  m.comprobar('y desde ahí alcanza los ocho módulos', enMenu.length === 8,
    enMenu.length + ' módulos: ' + enMenu.join(', '));

  // ── 4 · sin móvil, el pie es la puerta y no un cartel ───────────────────
  /* Con el móvil ya conectado el pie no invita a nada, así que se comprueba en
     una pantalla sin emparejar — que es el estado en el que hace falta. */
  const ctxSolo = await navegador.newContext({ viewport: { width: 1600, height: 900 } });
  const solo = await ctxSolo.newPage();
  await solo.goto(url);
  await solo.evaluate(() => document.fonts.ready);
  await solo.waitForTimeout(1500);
  await solo.click('#card-cancel').catch(() => {});
  await solo.waitForTimeout(400);

  const cartel = (await solo.textContent('#remote-status') || '').trim();
  m.comprobar('sin móvil el pie invita a conectar uno', /conectar/i.test(cartel),
    `«${cartel}»`);

  const panelAntes = await solo.evaluate(() =>
    !document.getElementById('shortcuts-panel').classList.contains('hidden'));
  await solo.click('#remote-status');
  await solo.waitForTimeout(600);
  const tras = await solo.evaluate(() => ({
    abierto: !document.getElementById('shortcuts-panel').classList.contains('hidden'),
    qr: (document.getElementById('qr-container') || {}).children?.length > 0
  }));
  m.comprobar('y pulsarlo abre el panel con el QR',
    !panelAntes && tras.abierto && tras.qr,
    `panel ${tras.abierto ? 'abierto' : 'cerrado'} · QR ${tras.qr ? 'dibujado' : 'no'}`);

  /* Pulsarlo otra vez no debe cerrarlo: quien lo pulsa busca el código, y que
     desaparezca al segundo toque es lo contrario de lo que pide. */
  await solo.click('#remote-status');
  await solo.waitForTimeout(500);
  m.comprobar('y pulsarlo de nuevo no lo cierra en las narices',
    await solo.evaluate(() => !document.getElementById('shortcuts-panel').classList.contains('hidden')));

  m.comprobar('sin errores de consola en todo el arranque', errores.length === 0,
    errores.length ? errores.slice(0, 3).join(' | ') : 'ninguno');

  await ctxSolo.close();
  await ctxTel.close();
  await ctx.close();
  return m;
}
