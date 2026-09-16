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
  ['optotipos', null], ['color', /Color/], ['infantil', /Fijaci/],
  ['relax', /Relax/], ['contraste', /Pelli/], ['worth', /Worth/],
  ['schober', /Schober/], ['amsler', /Amsler/]
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
  const panelAbierto = () => pc.evaluate(V => {
    const p = document.getElementById('panel-pc');
    return !!(p && p.checkVisibility(V));
  }, VIS);
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
  /* El desplegable vive DENTRO del panel, así que hay que abrirlo antes: con
     el panel cerrado `selectOption` no encuentra nada y el `.catch(()=>{})`
     que llevaba se comía el fallo en silencio — el módulo no cambiaba y la
     comprobación de después medía el módulo anterior creyendo medir otro. Una
     prueba que no puede fallar no comprueba nada. Así que se abre si hace
     falta, y si el desplegable sigue sin estar, esto REVIENTA. */
  const abrirModulo = async id => {
    if (!(await panelAbierto())) {
      await pc.keyboard.press('p');
      await pc.waitForTimeout(300);
    }
    await pc.selectOption('#panel-modulo', id, { timeout: 4000 });
    await pc.waitForTimeout(450);
    return pc.evaluate(() => (document.getElementById('modulo-nombre') || {}).textContent || '');
  };
  const alcanzados = [], fallados = [];
  for (const [id, rot] of MODULOS) {
    const nombre = await abrirModulo(id);
    const pinta = await pc.evaluate(V => ({
      estimulos: document.getElementById('modulo-area').querySelectorAll(':scope > *:not(.corte-aviso)').length,
      capaVisible: document.getElementById('modulo-area').checkVisibility(V),
      lineas: document.querySelectorAll('#lines-container > div').length }), VIS);
    /* Optotipos no tiene rótulo de módulo: se reconoce porque dibuja líneas y
       la capa de módulo NO SE VE. No se cuentan sus hijos: al volver de otro
       test la capa se queda oculta con el último estímulo dentro —inerte,
       medido: getAnimations() da 0 y nada se mueve— y contar hijos acusaba a
       la vuelta a optotipos de no dibujar. Lo que importa es que el paciente
       no vea nada del test anterior. */
    const ok = id === 'optotipos' ? (pinta.lineas > 0 && !pinta.capaVisible)
                                  : (rot.test(nombre) && pinta.estimulos > 0);
    (ok ? alcanzados : fallados).push(id + (ok ? '' : ' («' + nombre.slice(0, 22) + '», '
      + pinta.estimulos + ' elementos, ' + pinta.lineas + ' líneas)'));
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
    estimulos: document.getElementById('modulo-area').querySelectorAll(':scope > *:not(.corte-aviso)').length,
    texto: (document.getElementById('modulo-area').textContent || '').replace(/\s+/g, ' ').trim(),
    ocultos: document.getElementById('lines-container').classList.contains('oculto'),
    nombre: (document.getElementById('modulo-nombre') || {}).textContent || '' }));
  m.comprobar('y el panel corta el estímulo sin salir del test',
    hayCorte && cortada.estimulos === 0 && /CORTAD/i.test(cortada.nombre),
    hayCorte ? `estímulo ${cortada.estimulos} · «${cortada.nombre.slice(0, 40)}»`
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
       acusaba al lanzador de pisarla.

       Y ya no se filtra por `position: fixed`. Los dos controles con los que el
       lanzador chocaba —el botón «?» y la barra de arriba— eran fijos y ya no
       existen, así que ese filtro dejaba UN SOLO control a la vista y la
       comprobación no comparaba nada: pasaba en verde sin medir. Lo que importa
       no es cómo esté posicionado el vecino sino que el lanzador no se le monte
       encima, y el vecino que queda —el cartel del pie— va en el flujo. */
    const fijos = [...document.querySelectorAll('button, select, input, a[href]')]
      .filter(e => !e.closest('#panel-pc') && e.checkVisibility(V))
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
         : solapes.cuantos < 2 ? 'solo ' + solapes.cuantos + ' control: no hay con quién comparar'
         : solapes.cuantos + ' controles a la vista, ninguno se pisa'));

  /* ── 10a · Dentro de un módulo el pie se va ────────────────────────────
     En un módulo la pantalla es el estímulo y nada más: el pie —la marca y el
     cartel del mando— gasta alto y está a la vista del paciente, que es lo que
     este sistema no hace. Lo escondía `body.en-modulo #footer { display:none }`
     y esa regla se perdió al quitar de su lista el botón «?»: quedó un selector
     colgando de una coma y el pie volvió a asomar en los siete módulos. */
  await abrirModulo('schober');
  await pc.keyboard.press('Escape');
  await pc.waitForTimeout(300);
  const pie = await pc.evaluate(V => {
    const f = document.getElementById('footer');
    const enMod = document.body.classList.contains('en-modulo');
    return { enMod, visible: !!(f && f.checkVisibility(V)),
             alto: f ? Math.round(f.getBoundingClientRect().height) : 0 };
  }, VIS);
  m.comprobar('dentro de un módulo el pie no le roba alto al estímulo',
    pie.enMod && !pie.visible,
    !pie.enMod ? 'la pantalla no se declaró «en módulo»: la prueba no mide nada'
      : (pie.visible ? 'el pie sigue a la vista, ' + pie.alto + ' px'
                     : 'escondido'));

  /* ── 10b · Los cuatro optotipos DIBUJAN ────────────────────────────────
     La comprobación del contrato solo miraba que el panel tuviera un mando de
     la familia `Mode:`, no que el modo que pide exista. Y no existía: el panel
     mandaba `Mode:tumbling` cuando el identificador es `e_directional`, así
     que `getPoolItems()` devolvía una lista vacía y la E direccional salía en
     blanco — la pantalla del paciente vacía, sin una palabra. Un mando que la
     pantalla no entiende es peor que un mando que falta. */
  await pc.keyboard.press('1');
  await pc.waitForTimeout(400);
  /* `await`: sin él el `if` mira una Promesa, que es siempre cierta, y el
     panel se quedaba cerrado con la prueba midiendo botones invisibles. */
  if (!(await panelAbierto())) { await pc.keyboard.press('p'); await pc.waitForTimeout(300); }
  const modos = [];
  for (const [cmd, clase] of [['Mode:letters','texto'], ['Mode:numbers','texto'],
                              ['Mode:pediatric','imagen'], ['Mode:e_directional','imagen']]) {
    const hay = await pulsar('#panel-pc [data-cmd="' + cmd + '"]');
    await pc.waitForTimeout(500);
    const v = await pc.evaluate(() => {
      const fila = document.querySelector('#lines-container .optotype-row');
      const imgs = [...(fila ? fila.querySelectorAll('img') : [])];
      return { hijos: fila ? fila.children.length : 0,
               imgs: imgs.length,
               vacias: imgs.filter(i => !i.src || i.naturalWidth === 0).length,
               texto: (fila ? fila.textContent : '').trim().length };
    });
    const ok = hay && v.hijos > 0 && v.vacias === 0
      && (clase === 'texto' ? v.texto > 0 : v.imgs > 0);
    modos.push((ok ? '' : '✗ ') + cmd.slice(5) + (ok ? ''
      : ' (' + v.hijos + ' hijos, ' + v.imgs + ' imgs, ' + v.vacias + ' sin cargar, '
        + v.texto + ' letras)'));
  }
  m.comprobar('los cuatro modos de optotipo dibujan algo desde el panel',
    !modos.some(x => x.startsWith('✗')), modos.join(' · '));

  /* ── 10c · Y los mandos que van por tecla sintética también llegan ─────
     Bicromático, resaltar y un solo carácter no viajan como comando propio:
     el despachador reparte un KeyboardEvent. Al pulsarlos EN EL PANEL el foco
     se queda en el botón, y la guarda «con el foco en el panel el teclado es
     del panel» se los comía: los tres botones no hacían nada, y las flechas
     de pantalla tampoco. Es el mismo defecto que dejaba el teclado muerto al
     cerrar el panel, por la otra punta. */
  /* La huella tiene que cubrir los cuatro. El bicromático NO toca
     #lines-container —pone una clase en #test-area y enseña las dos mitades—
     así que mirar solo el contenedor de líneas lo daba por muerto estando
     vivo. Y la flecha abajo se mide desde la pantalla 1: en la última está
     topada y no mover nada es lo correcto. */
  const huella = () => pc.evaluate(() => JSON.stringify({
    html: document.getElementById('lines-container').innerHTML.length,
    area: (document.getElementById('test-area') || {}).className || '',
    mitades: [...document.querySelectorAll('.bichromatic-half')]
      .filter(e => e.checkVisibility({ visibilityProperty: true })).length,
    resaltada: document.querySelectorAll('#lines-container .line-highlight,'
      + ' #lines-container [class*=highlight]').length,
    lineas: document.querySelectorAll('#lines-container > div').length }));
  const conmuta = [];
  /* A una pantalla CON VARIAS LÍNEAS Y VARIOS CARACTERES, y con sitio para
     bajar. En la pantalla 1 hay una línea de un solo carácter: allí resaltar
     una línea y «un solo carácter» no pueden cambiar nada, y la prueba los
     acusaba de no funcionar. */
  for (let i = 0; i < 8; i++) { await pc.keyboard.press('ArrowUp'); await pc.waitForTimeout(90); }
  for (let i = 0; i < 2; i++) { await pc.keyboard.press('ArrowDown'); await pc.waitForTimeout(120); }
  const rica = await pc.evaluate(() => {
    const ls = [...document.querySelectorAll('#lines-container > div')];
    return { lineas: ls.length,
             chars: Math.max(0, ...ls.map(l => l.querySelectorAll('.optotype-text, img').length)) };
  });
  for (const [cmd, nombre] of [['KeyR','resaltar'], ['KeyU','un solo carácter'],
                               ['KeyB','bicromático'], ['ArrowDown','pantalla siguiente']]) {
    const a = await huella();
    const hay = await pulsar('#panel-pc [data-cmd="' + cmd + '"]');
    await pc.waitForTimeout(500);
    const b = await huella();
    conmuta.push((hay && a !== b ? '' : '✗ ') + nombre);
    if (hay && cmd !== 'ArrowDown') await pulsar('#panel-pc [data-cmd="' + cmd + '"]');
    await pc.waitForTimeout(300);
  }
  m.comprobar('y los conmutadores y las flechas del panel cambian la pantalla',
    !conmuta.some(x => x.startsWith('✗')) && rica.lineas >= 2 && rica.chars >= 2,
    conmuta.join(' · ')
    + (rica.lineas >= 2 && rica.chars >= 2 ? ''
       : ` — pero se midió en una pantalla de ${rica.lineas} líneas y ${rica.chars} caracteres:`
         + ' la prueba no prueba nada'));

  /* ── 11 · Los números llevan a los ocho test ──────────────────────────
     Sin móvil, el teclado tiene que llegar a todo. Los ocho test en el orden
     del menú, y el 0 para dejar la pantalla sin estímulo entre uno y otro. */
  await pc.keyboard.press('Escape');
  await pc.waitForTimeout(250);
  const porNumero = [], falladosNum = [];
  for (let n = 1; n <= 8; n++) {
    await pc.keyboard.press(String(n));
    await pc.waitForTimeout(450);
    const v = await pc.evaluate(V => ({
      rot: (document.getElementById('modulo-nombre') || {}).textContent || '',
      estimulos: document.getElementById('modulo-area').querySelectorAll(':scope > *:not(.corte-aviso)').length,
      capaVisible: document.getElementById('modulo-area').checkVisibility(V),
      lineas: document.querySelectorAll('#lines-container > div').length }), VIS);
    const [id, rot] = MODULOS[n - 1];
    const ok = id === 'optotipos' ? (v.lineas > 0 && !v.capaVisible)
                                  : (rot.test(v.rot) && v.estimulos > 0);
    (ok ? porNumero : falladosNum).push(n + '→' + id + (ok ? '' : ' («' + v.rot.slice(0, 20)
      + '», capa ' + (v.capaVisible ? 'A LA VISTA' : 'oculta') + ', ' + v.lineas + ' líneas)'));
  }
  m.comprobar('las teclas 1 a 8 llevan a los ocho test, en el orden del menú',
    porNumero.length === 8,
    porNumero.length === 8 ? 'los ocho' : 'fallan ' + falladosNum.join(' · '));

  await pc.keyboard.press('0');
  await pc.waitForTimeout(450);
  const cero = await pc.evaluate(() => ({
    estimulos: document.getElementById('modulo-area').querySelectorAll(':scope > *:not(.corte-aviso)').length,
    texto: (document.getElementById('modulo-area').textContent || '').replace(/\s+/g, ' ').trim(),
    ocultos: document.getElementById('lines-container').classList.contains('oculto'),
    rot: (document.getElementById('modulo-nombre') || {}).textContent || '' }));
  m.comprobar('y el 0 deja la pantalla sin estímulo',
    cero.estimulos === 0 && /sin est|menú|menu/i.test(cero.rot),
    `estímulo ${cero.estimulos} · «${cero.rot.slice(0, 40)}»`);

  /* ── 12 · Una tecla, un significado ────────────────────────────────────
     Dentro del Pelli el 3 podría querer decir «fila 3» en vez de «test 3», y
     esa ambigüedad es justo lo que no puede pasar: la misma tecla tiene que
     hacer lo mismo en todas partes, como la N y la P. Se deja sujeto para que
     nadie lo «arregle» más tarde en el otro sentido. */
  await pc.keyboard.press('5');
  await pc.waitForTimeout(450);
  const filaAntes = await pc.evaluate(() =>
    (document.getElementById('modulo-nombre') || {}).textContent || '');
  await pc.keyboard.press('7');
  await pc.waitForTimeout(450);
  const tras4 = await pc.evaluate(() =>
    (document.getElementById('modulo-nombre') || {}).textContent || '');
  m.comprobar('un número significa lo mismo dentro de un test que fuera: el test, no la fila',
    /Pelli/.test(filaAntes) && /Schober/.test(tras4),
    `en «${filaAntes.slice(0, 18)}» la tecla 7 llevó a «${tras4.slice(0, 18)}»`);

  /* ── 13 · Las flechas mueven lo que cada test ordena ──────────────────
     «Cambiar de pantalla con las flechas» solo existía en optotipos. En los
     demás las flechas no hacían nada, así que sin móvil no había forma de
     pasar de lámina ni de subir una fila. Cada test tiene un eje ordenado y
     es el que mueven: pantalla, fila, lámina, anillos, luz, figura. */
  const eje = [
    ['optotipos', 1], ['color', 2], ['infantil', 3], ['relax', 4],
    ['contraste', 5], ['schober', 7], ['amsler', 8]
  ];
  const mueven = [], quietos = [];
  const estadoVisible = () => pc.evaluate(() => {
    const r = (document.getElementById('modulo-nombre') || {}).textContent || '';
    const l = [...document.querySelectorAll('#lines-container > div')]
      .map(e => e.textContent.trim()).join('|');
    return r + '##' + l;
  });
  for (const [id, tecla] of eje) {
    await pc.keyboard.press(String(tecla));
    await pc.waitForTimeout(450);
    const a = await estadoVisible();
    await pc.keyboard.press('ArrowDown');
    await pc.waitForTimeout(450);
    const b = await estadoVisible();
    (a !== b ? mueven : quietos).push(id);
  }
  m.comprobar('la flecha abajo mueve el eje ordenado de cada test, no solo en optotipos',
    quietos.length === 0,
    quietos.length ? 'no se mueven: ' + quietos.join(', ')
                   : mueven.length + ' test responden a ↑↓');

  /* Y la de arriba deshace lo que hizo la de abajo. */
  await pc.keyboard.press('2');
  await pc.waitForTimeout(450);
  const c0 = await estadoVisible();
  await pc.keyboard.press('ArrowDown');
  await pc.waitForTimeout(400);
  await pc.keyboard.press('ArrowUp');
  await pc.waitForTimeout(400);
  const c1 = await estadoVisible();
  m.comprobar('y la de arriba vuelve al mismo sitio', c0 === c1,
    c0 === c1 ? 'ida y vuelta al mismo estado' : 'no volvió: «' + c1.slice(0, 44) + '»');

  /* ── 14 · Y los atajos están anunciados ───────────────────────────────
     Un atajo que no está en el panel de la «?» no existe: nadie lo va a
     descubrir pulsando teclas al azar delante de un paciente. */
  /* Los atajos están en el panel de control, plegados, y salen de la tabla
     ATAJOS — no escritos a mano en otro sitio, que es como el mapa viejo se
     quedó diciendo «Navegar pantallas» cuando las flechas ya movían seis
     ejes. Se leen con el panel abierto. */
  if (!(await panelAbierto())) { await pc.keyboard.press('p'); await pc.waitForTimeout(300); }
  /* Las teclas se leen CELDA A CELDA, no de un `textContent` corrido. Con el
     texto pegado —«…del testPabrir y cerrar este panel»— un `\bP\b` no
     encuentra límite de palabra y la comprobación acusaba al panel de no
     anunciar la P y la N, que sí anunciaba. La prueba estaba mal, no el panel. */
  const anuncio = await pc.evaluate(() => {
    const p = document.getElementById('panel-atajos');
    if (!p) return null;
    return {
      teclas: [...p.querySelectorAll('table.pp-teclas th')].map(e => e.textContent.trim()),
      aqui: (p.querySelector('.pp-aqui') || {}).textContent || ''
    };
  });
  const teclas = anuncio ? anuncio.teclas : [];
  const anunciada = re => teclas.some(t => re.test(t));
  const faltan = [
    ['1 – 8',  /^1\s*[-–—a]\s*8$/],
    ['0',      /^0$/],
    ['↑ ↓',    /↑/],
    ['← →',    /←/],
    ['N',      /^N$/],
    ['P',      /^P$/]
  ].filter(([, re]) => !anunciada(re)).map(([k]) => k);
  m.comprobar('el panel anuncia los números, las flechas y la P',
    !!anuncio && faltan.length === 0 && /↑↓|←→/.test(anuncio.aqui),
    !anuncio ? 'no hay bloque de atajos en el panel'
      : (faltan.length ? 'no anuncia ' + faltan.join(', ')
         : teclas.length + ' teclas · «' + anuncio.aqui.replace(/\s+/g, ' ').trim() + '»'));

  /* ── 15 · Y se puede sacar a otra ventana ─────────────────────────────
     Es el arreglo de lo único que el panel compromete: que tape parte de la
     cartilla. La ventana nueva es EL MANDO de siempre, con el código de sala
     en la URL para que se empareje solo — el mismo camino del QR, así que no
     hay una segunda forma de emparejar que mantener. */
  if (!(await panelAbierto())) { await pc.keyboard.press('p'); await pc.waitForTimeout(300); }
  const hayBoton = await pc.evaluate(V => {
    const b = document.getElementById('panel-ventana');
    return !!(b && b.checkVisibility(V));
  }, VIS);
  let otra = null, urlOtra = '';
  if (hayBoton) {
    const espera = ctx.waitForEvent('page', { timeout: 6000 }).catch(() => null);
    await pc.click('#panel-ventana');
    otra = await espera;
    if (otra) {
      await otra.waitForLoadState('domcontentloaded').catch(() => {});
      urlOtra = otra.url();
      await otra.waitForTimeout(1500);
    }
  }
  const codigoPC = await pc.evaluate(() =>
    (document.getElementById('panel-cod') || {}).textContent || '');
  const emparejada = otra ? await otra.evaluate(() =>
    /* El mando emparejado deja de pedir el código y enseña los controles. */
    !!document.querySelector('#vista-modulo, #panel-optotipos, .bloque')
    && !document.body.textContent.includes('Escribe el código')).catch(() => false) : false;
  m.comprobar('el panel se puede sacar a otra ventana, ya emparejada con esta pantalla',
    hayBoton && !!otra && urlOtra.includes('/remote') && codigoPC.length >= 4
      && urlOtra.includes(codigoPC.trim()),
    !hayBoton ? 'no hay botón para abrirla'
      : !otra ? 'no se abrió ninguna ventana'
      : `abrió «${urlOtra.replace(/^https?:\/\/[^/]+/, '')}» con el código «${codigoPC.trim()}»`
        + (emparejada ? ' y ya trae los controles' : ''));
  /* Y al sacarla, el cajón se cierra: si no, sigue tapando la cartilla. */
  m.comprobar('y al sacarla el cajón se cierra, que es de lo que se trata',
    !!otra && !(await panelAbierto()),
    otra ? (await panelAbierto() ? 'el cajón se quedó abierto' : 'cerrado')
         : 'no se abrió ninguna ventana');
  if (otra) await otra.close().catch(() => {});

  /* ── 16 · Y el estado se puede oír, no solo ver ───────────────────────
     El naranja dice cuál está puesto, y a quien navega por el tabulador el
     naranja no le llega: un conmutador sin aria-pressed se anuncia como un
     botón cualquiera. */
  await pc.keyboard.press('1');
  await pc.waitForTimeout(400);
  if (!(await panelAbierto())) { await pc.keyboard.press('p'); await pc.waitForTimeout(300); }
  const aria = await pc.evaluate(V => {
    const vis = e => e.checkVisibility(V);
    /* Los que TIENEN estado: selección (.pp-ops, .pp-dibujos, .pp-rejilla) y
       conmutadores. Las acciones —«remezclar», «siguiente»— no deben llevar
       aria-pressed: un botón que solo hace algo no está «pulsado», y marcarlo
       lo anuncia mal. La primera versión de esta prueba lo pedía a todos y
       acusaba de ello a los tres botones de acción. */
    const conEstado = [...document.querySelectorAll('#panel-cuerpo .pp-ops button,'
      + ' #panel-cuerpo .pp-dibujos button, #panel-cuerpo .pp-rejilla button,'
      + ' #panel-cuerpo .pp-conmut')].filter(vis);
    const acciones = [...document.querySelectorAll('#panel-cuerpo .pp-fila button')].filter(vis);
    const sinAria = conEstado.filter(b => !b.hasAttribute('aria-pressed'));
    const sobran = acciones.filter(b => b.hasAttribute('aria-pressed'));
    const puestos = conEstado.filter(b => b.classList.contains('puesto'));
    const coinciden = puestos.length > 0
      && puestos.every(b => b.getAttribute('aria-pressed') === 'true');
    const geo = document.getElementById('panel-geo');
    return { conEstado: conEstado.length, acciones: acciones.length,
             sinAria: sinAria.length, sobran: sobran.length, coinciden,
             vivo: geo ? geo.getAttribute('aria-live') : null };
  }, VIS);
  m.comprobar('el estado de cada control se anuncia, no solo se pinta',
    aria.conEstado > 4 && aria.sinAria === 0 && aria.sobran === 0 && aria.coinciden
      && aria.vivo === 'polite',
    `${aria.conEstado} controles con estado, ${aria.sinAria} sin anunciarlo · `
    + `${aria.acciones} acciones, ${aria.sobran} marcadas de más · el naranja y el aria `
    + (aria.coinciden ? 'coinciden' : 'NO coinciden')
    + ` · la geometría, aria-live «${aria.vivo}»`);

  /* ── 17 · La configuración se pide UNA vez ────────────────────────────
     La distancia es editable en el panel y el diálogo de configuración se abre
     solo al arrancar sin calibrar. Si volviera a plantarse en cada arranque,
     el panel no habría servido de nada. Aquí se puede recargar sin romper
     nada: esta suite tiene su propia página y no hay móvil emparejado. */
  await pc.reload();
  await pc.evaluate(() => document.fonts.ready);
  await pc.waitForTimeout(1700);
  const otraVez = await pc.evaluate(() =>
    !document.getElementById('card-cal').classList.contains('hidden'));
  m.comprobar('la configuración inicial solo se pide la primera vez',
    !otraVez, otraVez ? 'volvió a plantarse al recargar' : 'no volvió a salir');

  m.comprobar('sin errores de consola en todo el recorrido', errores.length === 0,
    errores.length ? errores.slice(0, 3).join(' | ') : 'ninguno');

  await ctx.close();
  return m;
}
