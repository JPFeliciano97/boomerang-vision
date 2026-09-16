/* ═══════════════════════════════════════════════════════════════════════════
   El panel del PC: la suite entera con teclado y ratón, sin móvil.

   Los ocho módulos eran alcanzables SOLO desde el mando. Esta suite mide el
   otro camino: un consultorio con un PC y nada más.

   Lo que se mide aquí y en ningún otro sitio:

     · Que el paciente NO vea controles hasta que alguien los pida. La pantalla
       del paciente es esta misma, así que un panel que asome al arrancar es un
       defecto, no una comodidad.

     · Que abrir el panel no mueva NI UN PÍXEL del estímulo. Todo este proyecto
       cuelga de que lo dibujado mida lo que dice medir; un panel que empuje la
       maqueta cambia la geometría sin que nada lo delate. Por eso el panel se
       superpone y no re-maqueta, y por eso esto se comprueba midiendo la caja
       de lo dibujado antes y después.

     · Que el panel ofrezca TODO lo que ofrece el mando. La lista de comandos
       de más abajo es el contrato, sacado de los `enviar(...)` de
       public/remote.html: si el mando sabe pedir algo y el panel no, hay un
       test que solo se puede tomar con el móvil en la mano.
   ═══════════════════════════════════════════════════════════════════════════ */
import { marcador } from './ayuda.mjs';

/* El contrato, módulo a módulo. Sacado de los `enviar(...)` del mando; las
   entradas que acaban en «:» son familias con parámetro (una por opción). */
const CONTRATO = {
  optotipos: ['Mode:', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'KeyB', 'KeyR', 'KeyU'],
  contraste: ['P:fila:', 'P:fila:arriba', 'P:fila:abajo', 'P:nuevas'],
  worth:     ['W:ojo'],
  schober:   ['S:anillos:', 'S:inv', 'S:ojo'],
  color:     ['C:juego:', 'C:lam:', 'C:lam:ant', 'C:lam:sig', 'C:nueva', 'C:resp'],
  amsler:    ['A:lamina:', 'A:ojo', 'A:diag'],
  relax:     ['R:tipo:', 'R:luz:'],
  infantil:  ['I:fig:', 'I:mov:', 'I:vel:', 'I:congelar']
};
/* El rótulo que la PANTALLA escribe para cada módulo, que no es el título del
   menú: el de Worth empieza por «Worth» y no por «Luces», el del color por
   «Color» y no por «Pseudoisocromático». Medido de lo que dibuja, no supuesto
   del nombre del test — la primera versión de esta prueba acusó al panel de no
   llegar a cuatro módulos a los que llegaba. */
const MODULOS = [
  ['optotipos', null], ['contraste', /Pelli/], ['worth', /Worth/],
  ['schober', /Schober/], ['color', /Color/], ['amsler', /Amsler/],
  ['relax', /Relax/], ['infantil', /Fijaci/]
];

/* `checkVisibility()` a secas NO mira `visibility`, solo `display`: con el
   panel escondido en `visibility: hidden` devolvía «visible» y la prueba
   acusaba al panel de asomar al arrancar. Hay que pedir la propiedad. */
const VIS = { visibilityProperty: true, opacityProperty: true, contentVisibilityAuto: true };

export default async function pruebaPanel({ navegador, url }) {
  const m = marcador('El panel del PC · sin móvil');
  /* Nunca se pulsa a ciegas: un clic sobre algo que no existe cuesta 30 s de
     espera y se lleva la suite entera por delante en vez de dar un fallo que
     se pueda leer. Ya ha pasado tres veces en este repo. */
  let pulsar;
  const errores = [];
  const ctx = await navegador.newContext({ viewport: { width: 1600, height: 900 } });
  const pc = await ctx.newPage();
  pc.on('pageerror', e => errores.push('pageerror: ' + e.message));
  pc.on('console', mm => { if (mm.type() === 'error') errores.push('consola: ' + mm.text()); });

  pulsar = async sel => {
    const hay = await pc.evaluate(([s, V]) => {
      const e = document.querySelector(s);
      return !!(e && e.checkVisibility(V));
    }, [sel, VIS]);
    if (!hay) return false;
    await pc.click(sel, { timeout: 4000 }).catch(() => {});
    return true;
  };

  await pc.goto(url);
  await pc.evaluate(() => document.fonts.ready);
  await pc.waitForTimeout(1400);
  await pc.click('#card-cancel').catch(() => {});

  /* ── 1 · Al arrancar, el paciente no ve un panel ─────────────────────── */
  const visible = () => pc.evaluate(V => {
    const p = document.getElementById('panel-pc');
    return !!(p && p.checkVisibility(V));
  }, VIS);
  const alArrancar = await pc.evaluate(() => ({ existe: !!document.getElementById('panel-pc') }));
  alArrancar.visible = await visible();
  m.comprobar('el panel existe pero no se ve hasta que se pide',
    alArrancar.existe && !alArrancar.visible,
    alArrancar.existe ? (alArrancar.visible ? 'ABIERTO al arrancar, y lo ve el paciente' : 'cerrado')
                      : 'no hay #panel-pc');

  /* ── 2 · Abrirlo no mueve el estímulo ───────────────────────────────────
     Se mide la caja de las líneas de optotipos, que es lo que el paciente
     lee y lo único cuyo tamaño está declarado en milímetros. */
  const cajas = () => pc.evaluate(() => {
    const caja = e => { const r = e.getBoundingClientRect();
      return [Math.round(r.x * 100) / 100, Math.round(r.y * 100) / 100,
              Math.round(r.width * 100) / 100, Math.round(r.height * 100) / 100].join(','); };
    /* Las líneas de optotipos Y lo que dibuje el módulo: un panel que empuje
       la maqueta se nota en cualquiera de los dos. */
    return [...document.querySelectorAll('#lines-container > div'),
            ...document.querySelectorAll('#modulo-area svg, #modulo-area canvas, #modulo-area > div')]
      .map(caja);
  });
  /* Varias líneas a la vista, no la pantalla 1 con una sola: una caja que no
     se mueve porque no había nada que mover no prueba nada. */
  for (let i = 0; i < 3; i++) { await pc.keyboard.press('ArrowDown'); await pc.waitForTimeout(150); }
  const antes = await cajas();
  await pc.keyboard.press('p');
  await pc.waitForTimeout(400);
  const abierto = await visible();
  m.comprobar('la tecla P abre el panel', abierto, abierto ? 'abierto' : 'sigue cerrado');
  const despues = await cajas();
  const iguales = antes.length > 0 && antes.length === despues.length
    && antes.every((c, i) => c === despues[i]);
  m.comprobar('abrir el panel no mueve ni un píxel del estímulo',
    iguales && antes.length >= 3,
    antes.length < 3 ? `solo ${antes.length} cajas que medir: la prueba no prueba nada`
      : (iguales ? `${antes.length} líneas, caja idéntica`
                 : 'cambió: ' + antes.map((c, i) => c === despues[i] ? null : `${c} → ${despues[i]}`)
                     .filter(Boolean).slice(0, 2).join(' · ')));

  /* ── 3 · Los ocho módulos, con el ratón solo ─────────────────────────── */
  const abrirModulo = async id => {
    await pc.selectOption('#panel-modulo', id).catch(() => {});
    await pc.waitForTimeout(450);
    return pc.evaluate(() => (document.getElementById('modulo-nombre') || {}).textContent || '');
  };
  const alcanzados = [], fallados = [];
  for (const [id, rot] of MODULOS) {
    const nombre = await abrirModulo(id);
    const pinta = await pc.evaluate(() => ({
      estimulo: document.getElementById('modulo-area').children.length,
      lineas: document.querySelectorAll('#lines-container > div').length }));
    /* Optotipos no tiene rótulo de módulo: se reconoce porque dibuja líneas y
       la capa de módulo se queda vacía. */
    const ok = id === 'optotipos' ? (pinta.lineas > 0 && pinta.estimulo === 0)
                                  : (rot.test(nombre) && pinta.estimulo > 0);
    (ok ? alcanzados : fallados).push(id + (ok ? '' : ' («' + nombre.slice(0, 22) + '», '
      + pinta.estimulo + ' elementos, ' + pinta.lineas + ' líneas)'));
  }
  m.comprobar('desde el panel se llega a los ocho módulos, sin móvil',
    alcanzados.length === 8,
    alcanzados.length === 8 ? 'los ocho dibujan, elegidos en el desplegable'
                            : `solo ${alcanzados.length}: ` + fallados.join(' · '));

  /* ── 4 · Y el panel ofrece todo lo que ofrece el mando ──────────────── */
  const faltantes = [];
  for (const [id] of MODULOS) {
    await abrirModulo(id);
    const cmds = await pc.evaluate(() => [...document.querySelectorAll('#panel-pc [data-cmd]')]
      .map(e => e.dataset.cmd));
    for (const esperado of CONTRATO[id]) {
      const hay = esperado.endsWith(':')
        ? cmds.some(c => c.startsWith(esperado) && c.length > esperado.length)
        : cmds.includes(esperado);
      if (!hay) faltantes.push(id + ' → ' + esperado);
    }
  }
  m.comprobar('y ofrece todos los mandos que ofrece el móvil', faltantes.length === 0,
    faltantes.length ? 'faltan ' + faltantes.length + ': ' + faltantes.slice(0, 5).join(' · ')
                     : Object.values(CONTRATO).flat().length + ' familias de comando presentes');

  /* ── 5 · Y lo que se toca cambia lo que la pantalla declara ─────────── */
  await abrirModulo('schober');
  const rotulo = () => pc.evaluate(() => (document.getElementById('modulo-nombre') || {}).textContent || '');
  const antesRot = await rotulo();
  const hayOjo = await pulsar('#panel-pc [data-cmd="S:ojo"]');
  await pc.waitForTimeout(400);
  const trasOjo = await rotulo();
  m.comprobar('un control del panel cambia de verdad lo que dibuja la pantalla',
    hayOjo && antesRot !== trasOjo && /O[DI]/.test(trasOjo),
    hayOjo ? `«${antesRot.slice(-28)}» → «${trasOjo.slice(-28)}»`
           : 'el panel no ofrece el cambio de ojo de Schober');

  /* ── 6 · El corte de estímulo, también desde el panel ──────────────── */
  const hayCorte = await pulsar('#panel-pc [data-cmd="Corte"]');
  await pc.waitForTimeout(450);
  const cortada = await pc.evaluate(() => ({
    estimulo: document.getElementById('modulo-area').children.length,
    ocultos: document.getElementById('lines-container').classList.contains('oculto'),
    nombre: (document.getElementById('modulo-nombre') || {}).textContent || '' }));
  m.comprobar('y el panel corta el estímulo sin salir del test',
    hayCorte && cortada.estimulo === 0 && /CORTAD/i.test(cortada.nombre),
    hayCorte ? `estímulo ${cortada.estimulo} · «${cortada.nombre.slice(0, 40)}»`
             : 'el panel no ofrece cortar el estímulo');
  if (hayCorte) { await pulsar('#panel-pc [data-cmd="Corte"]'); await pc.waitForTimeout(450); }

  /* ── 7 · Se cierra, y con el teclado ────────────────────────────────── */
  await pc.keyboard.press('Escape');
  await pc.waitForTimeout(350);
  const trasEscape = await visible();
  m.comprobar('Escape lo cierra y devuelve la pantalla al paciente', !trasEscape,
    trasEscape ? 'sigue abierto' : 'cerrado');

  /* ── 8 · Ningún control demasiado pequeño para el ratón ─────────────── */
  await pc.keyboard.press('p');
  await pc.waitForTimeout(300);
  await abrirModulo('infantil');
  const chicos = await pc.evaluate(V => {
    const malos = [];
    for (const e of document.querySelectorAll('#panel-pc button, #panel-pc select, #panel-pc input')) {
      if (!e.checkVisibility(V)) continue;
      const r = e.getBoundingClientRect();
      const corto = Math.min(r.width, r.height);
      if (corto < 24) malos.push(`${(e.dataset.cmd || e.id || e.tagName)} ${Math.round(r.width)}×${Math.round(r.height)}`);
    }
    return malos;
  }, VIS);
  const cuantos = await pc.evaluate(V =>
    [...document.querySelectorAll('#panel-pc button, #panel-pc select, #panel-pc input')]
      .filter(e => e.checkVisibility(V)).length, VIS);
  m.comprobar('ningún control del panel por debajo de 24 px de lado corto',
    chicos.length === 0 && cuantos > 5,
    chicos.length ? chicos.slice(0, 4).join(' · ')
                  : (cuantos > 5 ? `${cuantos} controles, todos llegan`
                                 : `solo ${cuantos} controles medidos: la prueba no prueba nada`));

  /* ── 9 · Recorrible con el tabulador ───────────────────────────────── */
  const tabulables = await pc.evaluate(V => {
    const dentro = [...document.querySelectorAll('#panel-pc button, #panel-pc select, #panel-pc input, #panel-pc summary')]
      .filter(e => e.checkVisibility(V));
    const fuera = dentro.filter(e => e.tabIndex < 0);
    return { total: dentro.length, fuera: fuera.length };
  }, VIS);
  m.comprobar('y todos sus controles se alcanzan con el tabulador',
    tabulables.total > 0 && tabulables.fuera === 0,
    `${tabulables.total} controles · ${tabulables.fuera} fuera del orden de tabulación`);

  /* ── 10 · El lanzador no se monta encima de nada ──────────────────────
     Nació en la esquina de abajo a la derecha, que ya estaba ocupada por el
     botón de atajos (`?`, bottom 50 right 16) y por la barra del pie: se
     solapaban y quedaba medio botón debajo del otro. Con el panel cerrado,
     ningún control fijo puede pisar a otro. */
  /* En OPTOTIPOS, que es donde están los dos: dentro de un módulo el botón de
     atajos se esconde (`body.en-modulo`), así que allí no hay con quién
     chocar y la comprobación pasaría sin comparar nada. */
  await abrirModulo('optotipos');
  await pc.keyboard.press('Escape');
  await pc.waitForTimeout(300);
  /* El lanzador solo asoma con el ratón vivo, así que hay que moverlo de
     verdad: si no está a la vista, esta comprobación no mide nada. */
  await pc.mouse.move(700, 480);
  await pc.mouse.move(800, 500, { steps: 5 });
  await pc.waitForTimeout(500);
  const solapes = await pc.evaluate(V => {
    /* Lo que se PULSA, no todo lo que esté fijo: la primera versión metía
       #modulo-area —la capa del estímulo, que ocupa la pantalla entera— y
       acusaba al lanzador de pisarla. Y el botón de atajos es un <div>, así
       que hay que nombrarlo: buscando solo <button> se quedaba fuera justo el
       control con el que el lanzador se solapaba de verdad. */
    const fijos = [...document.querySelectorAll('button, select, input, a[href],'
        + ' #shortcuts-toggle, #shortcuts-panel, #calibration-bar')]
      .filter(e => getComputedStyle(e).position === 'fixed' && e.checkVisibility(V))
      .map(e => ({ q: e.id || e.className || e.tagName, r: e.getBoundingClientRect() }))
      .filter(x => x.r.width > 0 && x.r.height > 0);
    const pisa = (a, b) => !(a.right <= b.left || b.right <= a.left
                          || a.bottom <= b.top || b.bottom <= a.top);
    const malos = [];
    for (let i = 0; i < fijos.length; i++)
      for (let j = i + 1; j < fijos.length; j++)
        if (pisa(fijos[i].r, fijos[j].r)) malos.push(fijos[i].q + ' pisa ' + fijos[j].q);
    return { malos, cuantos: fijos.length,
             lanzador: fijos.some(x => x.q === 'panel-pc-abrir') };
  }, VIS);
  m.comprobar('el lanzador del panel no se monta sobre ningún otro control',
    solapes.malos.length === 0 && solapes.lanzador && solapes.cuantos >= 2,
    solapes.malos.length ? solapes.malos.slice(0, 3).join(' · ')
      : (!solapes.lanzador ? 'el lanzador no estaba a la vista: la prueba no mide nada'
         : solapes.cuantos < 2 ? 'solo ' + solapes.cuantos + ' controles fijos: no hay con quién comparar'
         : solapes.cuantos + ' controles fijos a la vista, ninguno se pisa'));

  m.comprobar('sin errores de consola en todo el recorrido', errores.length === 0,
    errores.length ? errores.slice(0, 3).join(' | ') : 'ninguno');

  await ctx.close();
  return m;
}
