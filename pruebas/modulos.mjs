/* ═══════════════════════════════════════════════════════════════════════════
   Barrido de los ocho módulos: que cada uno dibuje algo, saque su panel en
   el mando, declare su geometría y no desborde la pantalla de un móvil.

   La comprobación de «dibuja algo» parece tonta y no lo es: los módulos se
   pintan desde una capa nueva (#modulo-area) y una excepción a mitad del
   render deja la pantalla del paciente EN NEGRO sin decir nada. Eso ya pasó
   tres veces durante la construcción, siempre por un identificador movido de
   sitio. El paciente mirando una pantalla vacía mientras el optometrista ve
   un mando con controles es el peor fallo posible de este sistema.

   Y la pasada por tres tamaños de móvil con el mínimo táctil: el mando se usa
   con una mano, de pie, al lado del paciente. Un control de 30 px en la
   cabecera que CAMBIA LA DISTANCIA DE MEDIDA no es una molestia — es una
   medida mal tomada que nadie va a notar, porque la cifra sigue saliendo y
   sigue pareciendo correcta. Esta comprobación existe porque eso pasó: los
   pasos de distancia se escribieron de 30×26 px.
   ═══════════════════════════════════════════════════════════════════════════ */
import { marcador } from './ayuda.mjs';

const MODULOS = [
  { nombre: 'Optotipos',          panel: 'panel-optotipos' },
  { nombre: 'Pelli-Robson',       panel: 'panel-pelli',    distFija: 1 },
  { nombre: 'Luces de Worth',     panel: 'panel-worth'  },
  { nombre: 'Schober',            panel: 'panel-schober' },
  { nombre: 'Pseudoisocromático', panel: 'panel-color',    distFija: 1 },
  { nombre: 'Rejilla de Amsler',  panel: 'panel-amsler',   distFija: 1 },
  { nombre: 'Relax',              panel: 'panel-relax'  },
  { nombre: 'Fijación infantil',  panel: 'panel-infantil' }
];
const PANELES = MODULOS.map(x => x.panel).concat('panel-pendiente');

/* El mínimo táctil, y por qué no es «44×44 y ya».
   44×44 px es la referencia (Apple HIG, WCAG 2.5.5). Exigirla tal cual aquí
   marca unos treinta controles, porque el mando entero está construido sobre
   filas de 33-42 px de alto y ancho completo. Y eso no es el problema: una fila
   de 387×42 px es un objetivo fácil — el dedo tiene sitio de sobra a lo ancho
   y la fila es lo bastante alta para no darle a la vecina. Poner 44 de alto a
   todo sería rediseñar los ocho paneles, no arreglar un defecto.

   Lo que SÍ es un problema es un objetivo pequeño de verdad. Así que la regla
   tiene dos partes, y cada una caza una cosa distinta:

   · ÁREA equivalente a un 44×44 (1.936 px²): lo que importa es cuánta diana
     hay, no que sea cuadrada. Caza el botón de volver, 40×40 = 1.600 px².
   · LADO CORTO de al menos 32 px: sin esto el área sola aprobaría una astilla
     de 200×10. Caza los pasos de distancia, 30×26 px.

   Las dos juntas marcan exactamente los dos controles que son pequeños de
   verdad y dejan en paz el lenguaje visual del resto. */
const AREA_MINIMA = 44 * 44;
const LADO_MINIMO = 32;
const esPequeno = c => (c.w * c.h) < AREA_MINIMA || Math.min(c.w, c.h) < LADO_MINIMO;

/* El de referencia primero, luego un Android barato y el móvil en horizontal
   — un optometrista lo sujeta como le viene. 320 px no entra en la suite para
   no alargarla: se midió a mano y también cabe. */
const TAMANOS = [
  { nombre: 'referencia 412×915', w: 412, h: 915 },
  { nombre: 'barato     360×640', w: 360, h: 640 },
  { nombre: 'horizontal 915×412', w: 915, h: 412 }
];

/* Los grupos de opciones mutuamente excluyentes del panel VISIBLE.
   Lo de «visible» no es un detalle: los paneles ocultos guardan sus botones en
   el DOM, y una sonda que mire todo #vista-modulo cuenta los de los otros siete
   módulos. La primera versión de esta consulta lo hacía y acusaba a Amsler de
   tener opciones de Worth.

   Lo que se busca es un grupo donde TODAS las opciones son imposibles a la
   distancia de la sala. Eso deja al operador eligiendo entre cosas que no van a
   pasar, y peor: ninguna coincide con lo que la pantalla dibuja de verdad.
   Worth tenía ese defecto: a 6 m sus tres tamaños clásicos decían los tres
   «no cabe». Se arregló primero con un cuarto tamaño —el mayor que cabía— y
   después quitando la elección entera: ahora la medida es una, el 80 % del
   lado corto, y no hay nada imposible que ofrecer. Esta comprobación existe
   para que el siguiente módulo con opciones físicas no lo repita. */
const GRUPOS_VISIBLES = (tel, paneles) => tel.evaluate(ids => {
  const p = ids.map(i => document.getElementById(i)).find(e => e && !e.classList.contains('oculto'));
  if (!p) return [];
  return [...p.querySelectorAll('.trio, .cuarteto, .fichas, .figuras, .lista-lam, .lista-niv')]
    .map(g => {
      const o = [...g.querySelectorAll('button')].map(e => e.textContent.replace(/\s+/g, ' ').trim());
      return {
        n: o.length,
        imposibles: o.filter(t => /no cabe|no caben/i.test(t)).length,
        muestra: o.slice(0, 4).join(' | ')
      };
    })
    .filter(g => g.n > 1);
}, paneles);

/* Todo lo que se toca en la vista de módulo, con su tamaño dibujado. Se miran
   los <button> y cualquier cosa con onclick, porque en este mando varias filas
   pulsables son <div onclick>. Lo que está oculto mide 0 y no cuenta. */
const CONTROLES = tel => tel.evaluate(() =>
  [...document.querySelectorAll('#vista-modulo button, #vista-modulo [onclick]')]
    .map(e => {
      const r = e.getBoundingClientRect();
      return {
        w: +r.width.toFixed(1), h: +r.height.toFixed(1),
        que: e.id || e.parentElement?.id || e.className || e.tagName.toLowerCase(),
        txt: (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 18)
      };
    })
    .filter(c => c.w > 0 && c.h > 0));

export default async function pruebaModulos({ pc, tel, abrir }) {
  const m = marcador('Los ocho módulos · que dibujen y quepan');

  for (const mod of MODULOS) {
    const nombre = await abrir(mod.nombre);

    /* VISIBILIDAD, no número de hijos. La primera versión de esto era
       `capa.children.length > 0 || lineas.length > 0`, y es débil de dos
       maneras: los contenedores ocultos guardan su contenido en el DOM, así que
       ese OR pasa aunque la capa visible sea la EQUIVOCADA — la pantalla del
       paciente en negro con los optotipos escondidos detrás habría pasado la
       prueba. Me caí en la misma trampa dos veces sondeando a mano antes de
       darme cuenta de que la prueba la tenía dentro.
       Lo correcto es exigir EXACTAMENTE UNA capa visible y con contenido: la de
       optotipos en su módulo, la de estímulos en los otros siete. */
    const capas = await pc.evaluate(() => {
      const ver = e => {
        if (!e) return false;
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden';
      };
      const capa = document.getElementById('modulo-area');
      const lineas = document.getElementById('lines-container');
      return {
        estimulo: ver(capa) && capa.children.length > 0,
        optotipos: ver(lineas) && lineas.children.length > 0
      };
    });
    const esOpto = mod.panel === 'panel-optotipos';
    const dibuja = esOpto ? (capas.optotipos && !capas.estimulo)
                          : (capas.estimulo && !capas.optotipos);

    const abiertos = await tel.evaluate(ids =>
      ids.filter(id => !document.getElementById(id).classList.contains('oculto')), PANELES);

    const desborde = await tel.evaluate(() => ({
      vertical: Math.max(0, document.body.scrollHeight - window.innerHeight),
      horizontal: Math.max(0, document.documentElement.scrollWidth - window.innerWidth)
    }));

    m.comprobar(mod.nombre.padEnd(19) + ' dibuja en una sola capa, la suya', dibuja,
      dibuja ? (nombre ? nombre.slice(0, 90) : '(sin nombre)')
             : `capa de estímulos ${capas.estimulo} · capa de optotipos ${capas.optotipos}`
               + ` · se esperaba ${esOpto ? 'optotipos' : 'estímulos'}`);
    m.comprobar(mod.nombre.padEnd(19) + ' saca un solo panel',
      abiertos.length === 1 && abiertos[0] === mod.panel,
      abiertos.join(', ') || 'ninguno');
    /* El mando se desplaza a lo largo a propósito — son muchos controles —
       pero NUNCA a lo ancho: un panel más ancho que el móvil esconde botones
       en un borde que nadie piensa en arrastrar. */
    m.comprobar(mod.nombre.padEnd(19) + ' no desborda a lo ancho en 412 px',
      desborde.horizontal === 0,
      `desplazamiento vertical ${desborde.vertical} px, horizontal ${desborde.horizontal} px`);

    /* Ningún grupo de opciones puede estar imposible por completo. */
    const grupos = await GRUPOS_VISIBLES(tel, PANELES);
    const rotos = grupos.filter(g => g.imposibles === g.n);
    m.comprobar(mod.nombre.padEnd(19) + ' ofrece al menos una opción posible por grupo',
      rotos.length === 0,
      rotos.length
        ? rotos.map(g => `${g.n} de ${g.n} imposibles: ${g.muestra}`).join(' · ')
        : grupos.map(g => g.n + (g.imposibles ? ` (${g.imposibles} imposibles)` : '')).join(' + ') || 'sin grupos');

    /* Cada módulo declara su estímulo en grados; si no lo dice, alguien
       cambió el estímulo sin cambiar lo que anuncia. */
    if (mod.nombre !== 'Optotipos') {
      m.comprobar(mod.nombre.padEnd(19) + ' declara su geometría',
        /[\d,.]+\s*°|mm|Δ|′/.test(nombre), nombre ? '' : 'el nombre del módulo está vacío');
    }

    /* La distancia se lee en la cabecera de cualquier módulo y no se toca en
       ninguno: se declara una vez en la configuración inicial de la pantalla.
       Los tres de cerca la traen fija a 1 m y lo dicen con otra etiqueta. */
    const et = (await tel.textContent('#mod-dist-et')).trim();
    const val = (await tel.textContent('#mod-dist-val')).trim();
    if (mod.distFija != null) {
      m.comprobar(mod.nombre.padEnd(19) + ` fija la distancia en ${mod.distFija} m`,
        et.toLowerCase() === 'acercado' && val === mod.distFija + ' m',
        `«${et}» ${val}`);
    } else {
      m.comprobar(mod.nombre.padEnd(19) + ' lee la distancia de la sala',
        et.toLowerCase() === 'distancia' && /^[\d.,]+\s*m$/.test(val),
        `«${et}» ${val}`);
    }
  }

  /* ══ El menú es también un estado de la pantalla ═══════════════════
     Mientras el optometrista elige el test siguiente, el paciente no debe estar
     leyendo nada. Así que el menú del mando deja la pantalla en negro, y eso es
     una decisión de diseño — no un efecto secundario. Si algún día la capa se
     queda con el estímulo anterior puesto, el paciente sigue leyendo la cartilla
     que ya vio. */
  await tel.click('.cabecera .atras').catch(() => {});
  await tel.waitForTimeout(700);
  const enMenu = await pc.evaluate(() => {
    const ver = e => {
      if (!e) return false;
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden';
    };
    const capa = document.getElementById('modulo-area');
    return {
      nombre: (document.getElementById('modulo-nombre') || {}).textContent || '',
      capa: ver(capa) && capa.children.length > 0,
      lineas: ver(document.getElementById('lines-container')),
      tinta: capa.querySelectorAll('svg, .optotype-text, img').length
    };
  });
  m.comprobar('con el mando en el menú la pantalla no enseña nada',
    !enMenu.capa && !enMenu.lineas && enMenu.tinta === 0,
    `«${enMenu.nombre.trim()}» · capa ${enMenu.capa} · optotipos ${enMenu.lineas}`
    + ` · ${enMenu.tinta} elementos de estímulo`);

  /* ══ El ojo en examen no se filtra entre módulos ═══════════════════
     Amsler, Worth y Schober tienen cada uno su ojo, y significan cosas
     distintas: en Amsler es el ojo que mira, en los otros dos dónde va el
     filtro rojo. Compartirlos por descuido cambiaría la lectura de una prueba
     al tocar otra. */
  const ojoAmsler = async () => ((await pc.textContent('#modulo-nombre')).match(/ojo (O[DI])/) || [, '?'])[1];
  await abrir('Rejilla de Amsler');
  const ojo0 = await ojoAmsler();
  await tel.click('#amsler-ojo');
  await tel.waitForTimeout(600);
  const ojo1 = await ojoAmsler();
  m.comprobar('el ojo del Amsler cambia cuando se le pide', ojo0 !== ojo1, `${ojo0} → ${ojo1}`);

  const nSchober = await abrir('Schober');
  const ojoSchober = (nSchober.match(/filtro rojo en (O[DI])/) || [, '?'])[1];
  m.comprobar('y Schober conserva el suyo, no hereda el del Amsler',
    ojoSchober === 'OD', `Amsler en ${ojo1}, Schober con el filtro en ${ojoSchober}`);

  await abrir('Rejilla de Amsler');
  m.comprobar('y el Amsler recuerda el suyo al volver', (await ojoAmsler()) === ojo1,
    `sigue en ${await ojoAmsler()}`);
  await tel.click('#amsler-ojo');   // devolverlo a como estaba
  await tel.waitForTimeout(400);

  /* ══ Cortar el estímulo sin salir del test ════════════════════════
     Hoy la pantalla del paciente se queda sin estímulo al volver al menú, y eso
     ya funciona — pero volver al menú PIERDE el sitio: los anillos que habías
     elegido, la lámina en la que estabas, el ojo en examen. Y taparle la
     cartilla un momento —para explicarle algo, para que descanse, para ocluir
     el otro ojo con calma— es de las cosas que más se hacen en una consulta.

     Lo que se protege aquí: que el corte deje la pantalla del paciente sin
     estímulo de verdad —no un estímulo escondido detrás de otra capa, que es el
     defecto que ya cazamos una vez— que el mando lo diga, y que al reanudar
     vuelva EL MISMO test con lo que estaba puesto. */
  const capasConContenido = () => pc.evaluate(() => {
    const vis = e => !!e && !e.classList.contains('oculto') && getComputedStyle(e).display !== 'none';
    const area = document.getElementById('modulo-area');
    const lin = document.getElementById('lines-container');
    return {
      estimulo: vis(area) ? area.querySelectorAll('svg, canvas, div').length : 0,
      optotipos: vis(lin) ? lin.querySelectorAll('.optotype-text, img').length : 0,
      nombre: (document.getElementById('modulo-nombre') || {}).textContent || ''
    };
  });

  const nSch = await abrir('Schober');
  await tel.locator('#schober-anillos button .g').filter({ hasText: /^7$/ }).first().click();
  await tel.waitForTimeout(600);
  const antesDeCortar = await capasConContenido();

  const hayCorte = await tel.evaluate(() =>
    !!document.querySelector('#corte-estimulo, [onclick*="Negro"]'));
  m.comprobar('el mando puede cortar el estímulo sin salir del test', hayCorte,
    hayCorte ? '' : 'no hay ningún control que corte el estímulo');

  if (hayCorte) {
    await tel.click('#corte-estimulo');
    await tel.waitForTimeout(700);
    const cortado = await capasConContenido();
    m.comprobar('con el estímulo cortado la pantalla del paciente no dibuja nada',
      cortado.estimulo === 0 && cortado.optotipos === 0,
      `capa de estímulo ${cortado.estimulo} · optotipos ${cortado.optotipos}`);
    m.comprobar('y la pantalla dice por qué está en negro',
      /cortad|negro|pausa/i.test(cortado.nombre), `«${cortado.nombre.slice(0, 60)}»`);

    await tel.click('#corte-estimulo');
    await tel.waitForTimeout(700);
    const tras = await capasConContenido();
    m.comprobar('al reanudar vuelve el MISMO test con lo que estaba puesto',
      tras.estimulo === antesDeCortar.estimulo && /7 anillos/.test(tras.nombre),
      `antes «${antesDeCortar.nombre.slice(0, 40)}» · después «${tras.nombre.slice(0, 40)}»`);
  }
  await tel.locator('#schober-anillos button .g').filter({ hasText: /^5$/ }).first().click();
  await tel.waitForTimeout(500);

  /* ══ El mando no se pellizca y no se va de lado ══════════════════════
     Dos cosas distintas y las dos medibles.

     La primera: el mando declaraba `width=412` FIJO en su viewport. En un
     móvil de 360 px de ancho el navegador encoge la página entera para que
     quepan esos 412 — y eso es exactamente «tener que hacer zoom out», solo
     que lo hace el navegador de entrada y el texto queda pequeño. Con
     `device-width` la maqueta se adapta al ancho real, que es lo que las
     comprobaciones de los tres tamaños ya sujetan.

     La segunda: el zoom por pellizco. Aquí no hace falta —no hay nada que
     ampliar, y con guantes o con prisa un pellizco accidental deja la interfaz
     desplazada y al operador buscando el botón— así que se desactiva y solo
     queda el desplazamiento vertical. */
  const gestos = await tel.evaluate(() => {
    const meta = (document.querySelector('meta[name=viewport]') || {}).content || '';
    const est = getComputedStyle(document.body);
    return { meta,
             touchAction: est.touchAction,
             overflowX: est.overflowX,
             anchoDeclarado: /width\s*=\s*(\d+)/.test(meta) ? +RegExp.$1 : null };
  });
  m.comprobar('el mando se adapta al ancho real del móvil, sin declarar uno fijo',
    /width\s*=\s*device-width/.test(gestos.meta) && gestos.anchoDeclarado === null,
    `viewport: «${gestos.meta}»`);
  m.comprobar('y no se puede pellizcar para ampliar: solo arriba y abajo',
    /user-scalable\s*=\s*no/.test(gestos.meta) && /maximum-scale\s*=\s*1/.test(gestos.meta)
      && /pan-y/.test(gestos.touchAction),
    `user-scalable y maximum-scale en el meta · touch-action «${gestos.touchAction}»`);

  /* ══ Y con el pellizco muerto, el dedo SIGUE deslizando ════════════
     Esto se rompió: quitar el zoom se llevó por delante el desplazamiento, y
     en un panel que mide 1.283 px en una pantalla de 915 eso deja escondidas
     las opciones de abajo sin forma de llegar a ellas.

     El dedo NO es medible aquí, igual que el grosor a DPR fraccionario: el
     gesto sintético de CDP no respeta touch-action (desliza incluso con
     `none`) y el que sí lo respeta no llega a mover nada en headless. Medido
     las dos formas antes de escribir esto. Así que se comprueba el INVARIANTE
     que lo arregla, que sí se lee del DOM.

     El invariante: entre el contenido y el elemento que desplaza no puede
     haber un scroll container que no tenga nada que desplazar. Uno así se
     queda el gesto —y con overscroll-behavior en `none` ni lo encadena hacia
     arriba— así que el dedo empuja contra algo que no se mueve. El `body` era
     exactamente eso: `overflow-y: auto` de cuando el mando cabía en una
     pantalla, más el `overflow-x: hidden` que llegó con el antipellizco.

     La rueda del ratón NO lo delata: Chromium la encadena con otras reglas y
     desplaza igual. Por eso hay que mirar la estructura, no el gesto. */
  const cadena = await tel.evaluate(() => {
    const desplaza = document.scrollingElement;
    const contenedor = e => {
      const c = getComputedStyle(e);
      const bloquea = v => v !== 'visible' && v !== 'clip';
      return bloquea(c.overflowX) || bloquea(c.overflowY);
    };
    /* Desde el control más profundo del panel a la vista hasta el que desplaza. */
    const panel = [...document.querySelectorAll('#vista-modulo [id^="panel-"]')]
      .find(e => e.offsetParent);
    const hondo = panel ? (panel.querySelector('button, input, .lista-niv > *') || panel) : document.body;
    const presos = [];
    for (let e = hondo; e && e !== desplaza; e = e.parentElement) {
      if (!contenedor(e)) continue;
      const sobra = e.scrollHeight - e.clientHeight;
      if (sobra <= 1) presos.push({
        quien: e.id ? '#' + e.id : (e.tagName.toLowerCase() + '.' + (e.className || '').split(' ')[0]),
        overflow: getComputedStyle(e).overflowX + '/' + getComputedStyle(e).overflowY,
        rebote: getComputedStyle(e).overscrollBehaviorY });
    }
    return { desplaza: desplaza.tagName.toLowerCase(), presos,
             sobra: desplaza.scrollHeight - desplaza.clientHeight };
  });
  m.comprobar('nada entre los controles y el que desplaza se queda el gesto del dedo',
    cadena.presos.length === 0 && cadena.sobra > 0,
    cadena.presos.length
      ? cadena.presos.map(p => `${p.quien} es scroll container sin nada que desplazar`
          + ` (overflow ${p.overflow}, overscroll-behavior ${p.rebote})`).join(' · ')
      : `desplaza <${cadena.desplaza}>, con ${cadena.sobra} px de sobra y la cadena limpia`);

  /* Y la consecuencia visible, en el panel que de verdad no cabe: el del
     color mide 1.283 px en una pantalla de 915, así que su último control
     empieza por debajo del borde y solo se alcanza desplazándose. */
  const fondo = await (async () => {
    await abrir('Pseudoisocromático');
    await tel.evaluate(() => { document.scrollingElement.scrollTop = 0; });
    const ultimo = () => tel.evaluate(() => {
      const panel = [...document.querySelectorAll('#vista-modulo [id^="panel-"]')]
        .find(e => e.offsetParent);
      const c = panel && [...panel.querySelectorAll('button, summary, input')]
        .filter(e => e.offsetParent).pop();
      if (!c) return { dentro: false, abajo: 0, ventana: window.innerHeight, sinControl: true };
      return { dentro: c.getBoundingClientRect().bottom <= window.innerHeight + 1,
               abajo: Math.round(c.getBoundingClientRect().bottom), ventana: window.innerHeight };
    });
    const arriba = await ultimo();
    await tel.mouse.move(206, 600);
    await tel.mouse.wheel(0, 2000);
    await tel.waitForTimeout(400);
    return { arriba, abajo: await ultimo() };
  })();
  m.comprobar('y desplazándose se llega al último control del panel del color',
    fondo.abajo.dentro && !fondo.arriba.dentro,
    `sin desplazar quedaba en ${fondo.arriba.abajo} px de ${fondo.arriba.ventana}`
    + ` · desplazado, en ${fondo.abajo.abajo}`
    + (fondo.arriba.dentro ? ' — pero ya cabía sin desplazar: la prueba no prueba nada' : ''));

  /* ══ Y los avisos no le roban la pantalla ═══════════════════════════
     Tres paneles llevan un aviso largo: por qué el relax es lo contrario de un
     optotipo, por qué la fijación no suena, y el párrafo del color que dice que
     esto no son las cartillas de Ishihara. Son textos que hay que poder leer,
     pero que se leen UNA vez: el del color medía 208 px de los 1.447 que medía
     el panel, una pantalla y media de móvil desplazándose por delante de los
     controles cada vez que se entra.

     Plegados, el título sigue delante —la advertencia no se esconde— y el
     desarrollo se abre al tocarlo. Se mide lo que ocupa cerrado, que su texto
     no esté pintado, y que abrirlo lo traiga: un aviso que no se puede abrir
     es un aviso censurado, no plegado. */
  const avisoDe = async modulo => {
    await abrir(modulo);
    return tel.evaluate(() => {
      const a = [...document.querySelectorAll('#vista-modulo .aviso')].find(e => e.offsetParent);
      if (!a) return null;
      const txt = a.querySelector('.txt');
      /* Dentro de un <details> cerrado el rect MIENTE: Chromium salta el
         contenido de la maquetación (content-visibility) y devuelve el último
         tamaño que tuvo, así que getBoundingClientRect, offsetHeight y
         offsetParent dan los tres «visible» con el aviso plegado. Medido:
         cerrado 44 px de aviso y 165 px de texto. La única señal que distingue
         es checkVisibility(), que da false cerrado y true abierto. */
      return { alto: Math.round(a.getBoundingClientRect().height),
               etiqueta: a.tagName,
               titulo: (a.querySelector('.tit') || {}).textContent || '',
               textoVisible: !txt || typeof txt.checkVisibility !== 'function'
                             || txt.checkVisibility(),
               letras: (txt || {}).textContent ? txt.textContent.trim().length : 0 };
    });
  };
  const avisos = [];
  for (const modulo of ['Relax acomodativo', 'Fijación infantil', 'Pseudoisocromático']) {
    const a = await avisoDe(modulo);
    if (a) avisos.push([modulo, a]);
  }
  m.comprobar('los tres avisos largos del mando salen plegados, sin tapar los controles',
    avisos.length === 3 && avisos.every(([, a]) => a.alto <= 60 && !a.textoVisible
      && a.letras > 100 && a.titulo.trim().length > 5),
    avisos.map(([mod, a]) => `${mod.split(' ')[0]} ${a.alto} px`
      + (a.textoVisible ? ' con el texto DESPLEGADO' : '') + ` · «${a.titulo.slice(0, 22)}»`).join(' · ')
    || 'ningún aviso encontrado');

  /* Y el texto está ahí: se abre tocando el título. No se pulsa a ciegas —un
     clic sobre algo que no existe cuesta 30 s de espera y se lleva la suite
     entera por delante, que ya pasó dos veces— así que primero se pregunta si
     hay título que tocar. */
  await abrir('Pseudoisocromático');
  const hayTitulo = await tel.evaluate(() => !!document.querySelector('#panel-color .aviso > summary'));
  if (hayTitulo) { await tel.click('#panel-color .aviso > summary'); await tel.waitForTimeout(350); }
  const abierto = await tel.evaluate(() => {
    const a = document.querySelector('#panel-color .aviso');
    const txt = a && a.querySelector('.txt');
    return { alto: a ? Math.round(a.getBoundingClientRect().height) : 0,
             visible: !!(txt && typeof txt.checkVisibility === 'function'
                         && txt.checkVisibility()),
             dice: !!(txt && /Ishihara/.test(txt.textContent)) };
  });
  m.comprobar('y tocar el título despliega el texto entero',
    hayTitulo && abierto.visible && abierto.alto > 120 && abierto.dice,
    hayTitulo ? `${abierto.alto} px abierto · texto ${abierto.visible ? 'a la vista' : 'SIN PINTAR'}`
              : 'el aviso no tiene título que tocar: no se puede plegar ni desplegar');

  /* ══ Ninguna letra pintada con una fuente que no la tiene ═══════════
     Optician Sans es la fuente de los optotipos y tiene 111 caracteres: las
     letras, las cifras, y poco más. NO tiene ni una vocal acentuada, ni la ñ,
     ni la ü, ni «·», ni «±», ni «Δ» — y el rótulo que el optometrista lee en la
     pantalla del paciente está escrito con ella y usa los cuatro. Cada uno de
     esos caracteres cae a OTRA fuente en mitad de la palabra, así que
     «Fijación» sale con seis letras de una fuente y una de otra.

     No se comprueba leyendo el CSS: se MIDE. Para cada carácter del texto se
     compara su ancho pedido con la fuente y su ancho pedido con una familia que
     no existe. Si miden lo mismo, el glifo lo puso la fuente de reserva y no la
     que el CSS declara. */
  const letrasHuerfanas = pagina => pagina.evaluate(() => {
    const c = document.createElement('canvas').getContext('2d');
    const faltan = ch => {
      if (/\s/.test(ch)) return false;
      c.font = '40px OpticianSans';
      const conFuente = c.measureText(ch).width;
      c.font = '40px NingunaFuenteQueExista';
      return Math.abs(conFuente - c.measureText(ch).width) < 0.01;
    };
    const salida = [];
    const visible = e => {
      const s = getComputedStyle(e);
      return s.display !== 'none' && s.visibility !== 'hidden' && e.offsetParent !== null;
    };
    for (const e of document.querySelectorAll('*')) {
      if (!/OpticianSans/i.test(getComputedStyle(e).fontFamily)) continue;
      if (!visible(e)) continue;
      const propio = [...e.childNodes]
        .filter(n => n.nodeType === 3).map(n => n.textContent).join('');
      const malas = [...new Set([...propio].filter(faltan))];
      if (malas.length) {
        salida.push({ donde: e.id || e.className || e.tagName.toLowerCase(),
                      chars: malas.join(''), texto: propio.replace(/\s+/g, ' ').trim().slice(0, 40) });
      }
    }
    return salida;
  });

  /* Se recorren los ocho módulos: el rótulo de la pantalla cambia con cada uno
     y cada uno trae sus propios acentos. */
  const huerfanas = [];
  for (const mod of MODULOS) {
    await abrir(mod.nombre);
    for (const [quien, pagina] of [['pantalla', pc], ['mando', tel]]) {
      for (const x of await letrasHuerfanas(pagina)) {
        huerfanas.push(quien + ' · ' + x.donde + ' · «' + x.chars + '» en «' + x.texto + '»');
      }
    }
  }
  m.comprobar('ningún texto se pinta con una fuente que no tiene sus caracteres',
    huerfanas.length === 0,
    huerfanas.length ? huerfanas.length + ' sitios: ' + huerfanas.slice(0, 4).join(' | ')
                     : 'los ocho módulos, pantalla y mando');

  /* La tecla N, DENTRO de un módulo. En la pantalla sola siempre se está en
     optotipos, así que allí la N nunca topa con la lista blanca de teclas que
     sobreviven fuera de optotipos — y es justo dentro de un módulo donde hace
     falta: el optometrista está de pie junto al PC, entra alguien en la sala y
     el panel de atajos anuncia la tecla sin condiciones. */
  await abrir('Rejilla de Amsler');
  await pc.keyboard.press('n');
  await pc.waitForTimeout(500);
  const conN = await capasConContenido();
  m.comprobar('la tecla N del PC corta el estímulo también dentro de un módulo',
    conN.estimulo === 0 && conN.optotipos === 0 && /CORTAD/i.test(conN.nombre),
    `estímulo ${conN.estimulo} · «${conN.nombre.slice(0, 46)}»`);
  await pc.keyboard.press('n');
  await pc.waitForTimeout(500);

  /* ══ Un mando que se recarga tiene que reconstruirse del espejo ══════
     El mando no guarda estado de navegación a propósito: lo pinta todo de lo
     que le llega por el socket. Eso vale mientras la pantalla SIGA emitiendo,
     y hay dos sitios donde dejó de hacerlo.

     Con el estímulo cortado: si la pantalla no emite mientras está en negro,
     un móvil que se recarga —o uno nuevo que entra a la sala— se queda para
     siempre en «esperando la pantalla…», con las dos vistas ocultas y sin
     botón con el que reanudar. La pantalla del paciente en negro y el mando
     sin forma de sacarla es el peor estado de todo este sistema.

     Y el modo de optotipo: el espejo lleva `mode`, pero si el mando solo
     atiende al evento de cambio, tras recargarse marca «Letras» mientras el
     paciente está viendo LEA. Un mando que dice otra cosa que la pantalla es
     lo que esta suite entera existe para evitar. */
  const mandoVivo = () => tel.evaluate(() => ({
    enModulo: !document.getElementById('vista-modulo').classList.contains('oculto'),
    enMenu: !document.getElementById('vista-menu').classList.contains('oculto'),
    corteOn: !!document.querySelector('#corte-estimulo.on'),
    modo: (document.querySelector('#mode-buttons button.sel') || {}).textContent || '—',
    titulo: (document.getElementById('mod-titulo') || {}).textContent || ''
  }));

  await abrir('Schober');
  await tel.click('#corte-estimulo');
  await tel.waitForTimeout(700);
  await tel.reload();
  await tel.evaluate(() => document.fonts.ready);
  await tel.waitForTimeout(3000);
  const trasRecarga = await mandoVivo();
  m.comprobar('con el estímulo cortado, un mando que se recarga se reconstruye',
    trasRecarga.enModulo && /Schober/.test(trasRecarga.titulo),
    trasRecarga.enModulo ? `vuelve a «${trasRecarga.titulo}»`
                         : 'las dos vistas ocultas: el mando se quedó esperando la pantalla');
  m.comprobar('y encuentra el botón con el que reanudar, encendido',
    trasRecarga.corteOn,
    trasRecarga.corteOn ? '' : 'el botón de corte no está marcado: no se sabe que la pantalla está en negro');
  /* Se reanuda recargando la PANTALLA, no pulsando el botón del mando: si el
     mando está roto —que es justo lo que esta comprobación mide— pulsarlo se
     queda esperando treinta segundos y rompe la suite entera en vez de dar un
     fallo legible. El corte no se guarda, así que un F5 lo levanta siempre. */
  await pc.reload();
  await pc.evaluate(() => document.fonts.ready);
  await pc.waitForTimeout(1800);
  await pc.click('#card-cancel').catch(() => {});
  await pc.waitForTimeout(2600);

  /* El modo de optotipo, por el mismo camino. */
  await tel.locator('#mode-buttons button').filter({ hasText: 'LEA' }).first().click()
    .catch(() => {});
  await tel.waitForTimeout(700);
  const enPantalla = await pc.evaluate(() =>
    document.querySelectorAll('#lines-container img').length > 0 ? 'LEA' : 'texto');
  await tel.reload();
  await tel.evaluate(() => document.fonts.ready);
  await tel.waitForTimeout(3000);
  const modoTras = await mandoVivo();
  m.comprobar('y el modo de optotipo que marca el mando es el que dibuja la pantalla',
    /LEA/.test(modoTras.modo) && enPantalla === 'LEA',
    `la pantalla dibuja ${enPantalla} y el mando marca «${modoTras.modo.trim()}»`);
  await tel.locator('#mode-buttons button').filter({ hasText: 'Letras' }).first().click()
    .catch(() => {});
  await tel.waitForTimeout(600);

  /* ══ El menú dice en qué situación queda cada test ════════════════
     Lo dice ANTES de entrar, para que el optometrista vea que Worth no cabe a
     6 m sin entrar a leer un cartel rojo. El veredicto lo calcula la pantalla
     y viaja en el espejo; esta comprobación exige que llegue, que sea de los
     estados previstos, y que RESPONDA a la distancia — un veredicto que sale
     igual a 6 m y a 2 m no está midiendo nada. */
  const ESTADOS = ['correcto', 'adaptado', 'fuera', 'cerca', 'pendiente', 'sincal'];
  const leerMenu = async () => {
    await tel.click('.cabecera .atras').catch(() => {});
    await tel.waitForTimeout(600);
    return tel.evaluate(() => ({
      tira: [...document.querySelectorAll('#tira-estado .val')].map(e => e.textContent.trim()),
      filas: [...document.querySelectorAll('.fila-mod')].map(e => ({
        titulo: e.querySelector('.tit').textContent.trim(),
        tag: e.querySelector('.tag').textContent.trim(),
        estado: e.querySelector('.tag').className.replace(/^tag\s*/, '').trim()
      }))
    }));
  };

  const menu = await leerMenu();
  m.comprobar('el menú lista los ocho módulos con su veredicto',
    menu.filas.length === 8 && menu.filas.every(f => f.tag && ESTADOS.includes(f.estado)),
    menu.filas.map(f => f.tag + ' [' + f.estado + ']').join(' · '));

  m.comprobar('la tira de estado dice pantalla, calibración y distancia',
    menu.tira.length === 3 && menu.tira.every(t => t && t !== '—'),
    menu.tira.join(' | '));

  /* Worth y Schober ya no pueden «no caber»: los dos dibujan la medida
     estándar —el 80 % del lado corto de la pantalla— y caben por
     construcción. Lo que el menú dice ahora es la CIFRA que sale de ahí a la
     distancia de la sala: el ángulo del punto de Worth y el rango en Δ de
     Schober. Y eso sí tiene que moverse con la sala, porque es lo que cambia
     de una consulta a otra: un veredicto que sale igual a 6 m y a 2 m no está
     midiendo nada. */
  const fila = (filas, quien) => filas.find(f => quien.test(f.titulo)) || {};
  const worth6 = fila(menu.filas, /Worth/), schober6 = fila(menu.filas, /Schober/);
  m.comprobar('el menú da el ángulo de Worth y el rango de Schober sin entrar',
    /^\d+[.,]\d+°$/.test(worth6.tag || '') && /Δ$/.test(schober6.tag || ''),
    `Worth «${worth6.tag}» · Schober «${schober6.tag}»`);
  /* A 6 m, 1Δ son 60 mm y la pantalla no crece: el rango de Schober se queda
     por debajo de las forias que se ven en consulta, y eso se dice antes de
     entrar en vez de después de medir. */
  m.comprobar('y a 6 m avisa de que a Schober le falta rango',
    schober6.estado === 'adaptado', `«${schober6.tag}» [${schober6.estado}]`);

  /* Y el veredicto tiene que MOVERSE con la distancia. Se cambia sembrando una
     sala ya configurada, que es el único sitio donde se declara. */
  await pc.evaluate(() => {
    try {
      const g = JSON.parse(localStorage.getItem('bvc') || '{}');
      g.testDistanceM = 2; localStorage.setItem('bvc', JSON.stringify(g));
    } catch (e) {}
  });
  await pc.reload();
  await pc.evaluate(() => document.fonts.ready);
  await pc.waitForTimeout(1600);
  await pc.click('#card-cancel').catch(() => {});
  await pc.waitForTimeout(600);
  const menu2 = await leerMenu();
  const worth2 = fila(menu2.filas, /Worth/), schober2 = fila(menu2.filas, /Schober/);
  m.comprobar('a 2 m las dos cifras cambian: el estímulo es el mismo, la sala no',
    worth2.tag && worth2.tag !== worth6.tag && schober2.tag && schober2.tag !== schober6.tag,
    `Worth ${worth6.tag} → ${worth2.tag} · Schober ${schober6.tag} → ${schober2.tag}`);
  m.comprobar('y a 2 m Schober ya tiene rango de sobra',
    schober2.estado === 'correcto',
    `«${schober2.tag}» [${schober2.estado}] · la tira dice ${menu2.tira[2]}`);

  /* Y devolver la sala a 6 m, que es lo que esperan las pasadas de abajo. */
  await pc.evaluate(() => {
    try {
      const g = JSON.parse(localStorage.getItem('bvc') || '{}');
      g.testDistanceM = 6; localStorage.setItem('bvc', JSON.stringify(g));
    } catch (e) {}
  });
  await pc.reload();
  await pc.evaluate(() => document.fonts.ready);
  await pc.waitForTimeout(1600);
  await pc.click('#card-cancel').catch(() => {});
  await pc.waitForTimeout(600);

  /* ══ La pasada por tamaños ═══════════════════════════════════
     Se agrega en una comprobación por tamaño en vez de 24 filas: lo que
     interesa es si ALGÚN módulo se rompe a ese ancho, y cuál. */
  for (const t of TAMANOS) {
    await tel.setViewportSize({ width: t.w, height: t.h });
    await tel.waitForTimeout(400);

    const desbordes = [], pequenos = [];
    let scrollMax = 0;

    for (const mod of MODULOS) {
      await abrir(mod.nombre);

      const ajuste = await tel.evaluate(() => ({
        horizontal: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
        vertical: Math.max(0, document.body.scrollHeight - window.innerHeight),
        fuera: [...document.querySelectorAll('#vista-modulo *')]
          .filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > window.innerWidth + 1; })
          .length
      }));
      scrollMax = Math.max(scrollMax, ajuste.vertical);
      if (ajuste.horizontal > 0 || ajuste.fuera > 0) {
        desbordes.push(`${mod.nombre}: ${ajuste.horizontal} px a lo ancho, ${ajuste.fuera} elementos fuera`);
      }

      for (const c of await CONTROLES(tel)) {
        if (esPequeno(c)) pequenos.push(`${c.w}×${c.h} px «${c.txt || c.que}»`);
      }
    }

    m.comprobar(`${t.nombre} · los ocho módulos caben a lo ancho`,
      desbordes.length === 0,
      desbordes.length ? desbordes.slice(0, 3).join(' | ')
        : `sin desborde horizontal · se desplaza ${scrollMax} px a lo largo, que es a propósito`);

    /* Los repetidos se cuentan una vez: la cabecera sale en los ocho módulos y
       listarla ocho veces esconde de cuántos controles se habla. */
    const distintos = [...new Set(pequenos)];
    m.comprobar(`${t.nombre} · ningún control demasiado pequeño para un dedo`,
      distintos.length === 0,
      distintos.length ? distintos.join(' · ')
        : `área ≥ ${AREA_MINIMA} px² y lado corto ≥ ${LADO_MINIMO} px en todos`);
  }

  /* Dejar el mando en el tamaño de referencia para las suites siguientes. */
  await tel.setViewportSize({ width: 412, height: 915 });
  await tel.waitForTimeout(400);
  return m;
}
