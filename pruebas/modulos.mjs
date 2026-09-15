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
   Worth tenía ese defecto y se arregló con un cuarto tamaño — el mayor que
   cabe. Esta comprobación existe para que el siguiente módulo con opciones
   físicas no lo repita. */
const GRUPOS_VISIBLES = (tel, paneles) => tel.evaluate(ids => {
  const p = ids.map(i => document.getElementById(i)).find(e => e && !e.classList.contains('oculto'));
  if (!p) return [];
  return [...p.querySelectorAll('.trio, .cuarteto, .mode-grid, .lista-lam, .lista-niv')]
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

    const dibuja = await pc.evaluate(() =>
      document.getElementById('modulo-area').children.length > 0
      || document.querySelectorAll('#lines-container > div').length > 0);

    const abiertos = await tel.evaluate(ids =>
      ids.filter(id => !document.getElementById(id).classList.contains('oculto')), PANELES);

    const desborde = await tel.evaluate(() => ({
      vertical: Math.max(0, document.body.scrollHeight - window.innerHeight),
      horizontal: Math.max(0, document.documentElement.scrollWidth - window.innerWidth)
    }));

    m.comprobar(mod.nombre.padEnd(19) + ' dibuja estímulo', dibuja,
      nombre ? nombre.slice(0, 96) : '(sin nombre)');
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

    /* Los tres módulos de cerca traen su distancia fija y no la negocian. */
    if (mod.distFija != null) {
      const et = (await tel.textContent('#mod-dist-et')).trim();
      const val = (await tel.textContent('#mod-dist-val')).trim();
      const pasos = await tel.evaluate(() => {
        const f = document.getElementById('fila-distancia');
        return !!f && !f.classList.contains('oculto');
      });
      m.comprobar(mod.nombre.padEnd(19) + ` fija la distancia en ${mod.distFija} m`,
        et.toLowerCase() === 'acercado' && val === mod.distFija + ' m' && !pasos,
        `«${et}» ${val}` + (pasos ? ' · CON pasos de distancia, no debería' : ' · sin pasos'));
    }
  }

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
