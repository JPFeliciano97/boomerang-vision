/* ═══════════════════════════════════════════════════════════════════════════
   Las tres geometrías que solo se comprueban midiendo píxeles dibujados.

   Todas nacen de un defecto real:

   · La rejilla de Amsler tenía DOS LADOS. Los contornos inferior y derecho
     caían justo sobre el borde del viewBox y el navegador no los pintaba. En
     el DOM estaban: cuatro elementos <line>, con sus coordenadas correctas.
     Solo al leer la intensidad de los píxeles salió — 255 arriba e izquierda,
     4,8 (el fondo) abajo y derecha. En un test donde se le pregunta al
     paciente si alguna línea se ve distinta, media rejilla sin borde es un
     falso positivo dibujado por nosotros.

   · Las líneas alternaban grueso y fino, por el mismo motivo pero al revés:
     con un paso de rejilla fraccionario unas caían sobre el borde del píxel y
     otras a caballo entre dos.

   · Schober tiene una invariancia que se puede comprobar sola: invertir los
     colores Y pasar el filtro al otro ojo describe la misma situación
     clínica, así que la tabla de lectura tiene que salir idéntica. Si no
     sale, la convención exo/endo está mal en una de las dos ramas.
   ═══════════════════════════════════════════════════════════════════════════ */
import { marcador } from './ayuda.mjs';

/* El perfil de la rejilla, línea por línea.
   Se rasteriza el SVG en un canvas dentro de la página y se promedia la
   intensidad de cada fila y cada columna. Las líneas salen como picos; se
   agrupan los píxeles contiguos por encima de la mitad del máximo y cada
   grupo es una línea, con su intensidad de pico.

   Esto mide las dos cosas que fallaron de verdad, y ninguna se veía en el DOM:

   · Que el PRIMER y el ÚLTIMO pico tengan la misma altura que los de dentro.
     Los contornos inferior y derecho caían sobre el borde del viewBox y el
     navegador los recortaba: en el DOM estaban los cuatro <line> con sus
     coordenadas correctas, y en la pantalla había media rejilla sin borde.
   · Que TODOS los picos midan lo mismo. Con un paso de rejilla fraccionario
     unas líneas caían sobre el borde del píxel y otras a caballo entre dos, y
     la rejilla alternaba grueso y fino. En un test donde se le pregunta al
     paciente si alguna línea se ve distinta, eso es un falso positivo dibujado
     por nosotros.

   Medir contra las líneas interiores y no contra un umbral fijo es lo que hace
   la prueba independiente de la lámina, del grosor y del brillo del monitor. */
const PERFIL_REJILLA = async pc => pc.evaluate(async () => {
  const svg = document.querySelector('#modulo-area svg');
  const g = svg && (svg.querySelector('g') || svg);
  if (!svg || !g) return null;
  const cajaSvg = svg.getBoundingClientRect();
  const cajaGrid = g.getBoundingClientRect();
  const xml = new XMLSerializer().serializeToString(svg);
  const img = new Image();
  await new Promise(ok => { img.onload = ok; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml); });
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(cajaSvg.width));
  c.height = Math.max(1, Math.round(cajaSvg.height));
  const cx = c.getContext('2d', { willReadFrequently: true });
  cx.drawImage(img, 0, 0, c.width, c.height);
  const d = cx.getImageData(0, 0, c.width, c.height).data;

  /* La rejilla en coordenadas del canvas, con HOLGURA de 4 px a cada lado y
     recortada al canvas.
     La holgura no es cosmética: getBoundingClientRect devuelve fracciones y
     redondear la caja justa rebanaba media línea exterior, así que la sonda
     acusaba los contornos al 50 % en una rejilla perfecta. El SVG llena la
     ventana, así que alrededor de la rejilla hay fondo de sobra; y el fondo no
     estorba, porque los picos se agrupan por umbral. */
  const HOLGURA = 4;
  const x0 = Math.max(0, Math.floor(cajaGrid.left - cajaSvg.left) - HOLGURA);
  const y0 = Math.max(0, Math.floor(cajaGrid.top - cajaSvg.top) - HOLGURA);
  const x1 = Math.min(c.width - 1, Math.ceil(cajaGrid.right - cajaSvg.left) + HOLGURA);
  const y1 = Math.min(c.height - 1, Math.ceil(cajaGrid.bottom - cajaSvg.top) + HOLGURA);
  if (x1 <= x0 || y1 <= y0) return null;

  const fila = y => { let s = 0; for (let x = x0; x <= x1; x++) s += d[(y * c.width + x) * 4]; return s / (x1 - x0 + 1); };
  const col  = x => { let s = 0; for (let y = y0; y <= y1; y++) s += d[(y * c.width + x) * 4]; return s / (y1 - y0 + 1); };

  /* Los picos: grupos contiguos por encima de la mitad del máximo, y de cada
     grupo se guarda el ÁREA — la suma de las intensidades —, no solo la
     altura del pico.
     El área es lo que hay que medir y me costó un intento darme cuenta: un
     contorno recortado a la mitad por el borde del viewBox sigue teniendo un
     píxel a intensidad 255, así que su PICO es idéntico al de una línea entera
     y la prueba pasaba con el defecto puesto. El área, en cambio, cae a la
     mitad, que es exactamente lo que el ojo ve: una línea más fina.
     Y hacen falta las dos medidas, porque cada defecto mueve una: el
     antialiasing CONSERVA el área de una línea que cae a caballo entre dos
     píxeles y le baja el pico a la mitad, así que el paso fraccionario se ve
     en el pico; el recorte del viewBox baja el área y deja el pico intacto. */
  const picos = (desde, hasta, medir) => {
    const v = [];
    for (let i = desde; i <= hasta; i++) v.push(medir(i));
    const techo = Math.max(...v);
    if (techo <= 0) return [];
    const umbral = techo / 2;
    const out = [];
    let dentro = false, area = 0, pico = 0, ancho = 0;
    const cerrar = i => {
      out.push({ area: +area.toFixed(1), pico: +pico.toFixed(1), ancho, pos: desde + i - ancho });
      dentro = false; area = 0; pico = 0; ancho = 0;
    };
    for (let i = 0; i < v.length; i++) {
      if (v[i] >= umbral) { dentro = true; area += v[i]; pico = Math.max(pico, v[i]); ancho++; }
      else if (dentro) cerrar(i);
    }
    if (dentro) cerrar(v.length);
    return out;
  };

  return {
    ancho: x1 - x0 + 1, alto: y1 - y0 + 1,
    horizontales: picos(y0, y1, fila),
    verticales:   picos(x0, x1, col)
  };
});

/* La mediana de los picos interiores: la referencia contra la que se juzgan el
   primero y el último. Mediana y no media, para que un contorno recortado no
   arrastre la referencia hacia abajo y se disimule a sí mismo. */
const mediana = xs => {
  const o = [...xs].sort((a, b) => a - b);
  return o.length ? (o.length % 2 ? o[(o.length - 1) / 2] : (o[o.length / 2 - 1] + o[o.length / 2]) / 2) : 0;
};

export default async function pruebaGeometria({ pc, tel, abrir }) {
  const m = marcador('Geometría medida en píxeles');

  // ── Amsler: todas las líneas iguales, contornos incluidos ───────────────
  await abrir('Rejilla de Amsler');
  const perfil = await PERFIL_REJILLA(pc);
  if (!perfil) {
    m.comprobar('la rejilla de Amsler se rasteriza', false, 'no hay <svg> medible en #modulo-area');
  } else {
    for (const [eje, lineas, primero, ultimo] of [
      ['horizontales', perfil.horizontales, 'el contorno de arriba', 'el de abajo'],
      ['verticales',   perfil.verticales,   'el contorno izquierdo', 'el derecho']
    ]) {
      if (lineas.length < 4) {
        m.comprobar(`las líneas ${eje} se dibujan`, false, `solo ${lineas.length} picos`);
        continue;
      }
      const areas = lineas.map(l => l.area);
      const dentro = areas.slice(1, -1);
      const ref = mediana(dentro);
      const rel = v => ref > 0 ? v / ref : 0;
      const relPrimero = rel(areas[0]), relUltimo = rel(areas[areas.length - 1]);

      /* Un contorno recortado por el borde del viewBox pierde la mitad del
         trazo y su área baja a ~0,5 de la referencia; uno ausente, a 0. */
      m.comprobar(`${primero} y ${ultimo} se dibujan con el grosor de las de dentro`,
        relPrimero > 0.85 && relUltimo > 0.85,
        `${lineas.length} líneas ${eje} · contornos al ${(100 * relPrimero).toFixed(0)} %`
        + ` y al ${(100 * relUltimo).toFixed(0)} % del grosor interior`);

      /* Y todas las interiores entre sí, por grosor Y por intensidad: es lo que
         pilla el paso fraccionario que hacía alternar grueso y fino. */
      const min = Math.min(...dentro), max = Math.max(...dentro);
      const picosDentro = lineas.slice(1, -1).map(l => l.pico);
      const pMin = Math.min(...picosDentro), pMax = Math.max(...picosDentro);
      const dispGrosor = ref > 0 ? (max - min) / ref : 1;
      const dispPico = pMax > 0 ? (pMax - pMin) / pMax : 1;
      m.comprobar(`las líneas ${eje} están dibujadas todas igual`,
        dispGrosor < 0.15 && dispPico < 0.10,
        `grosor ±${(100 * dispGrosor).toFixed(1)} % · intensidad ${pMin.toFixed(0)}–${pMax.toFixed(0)}`
        + ` (±${(100 * dispPico).toFixed(1)} %) · anchos `
        + `${[...new Set(lineas.map(l => l.ancho))].sort((a, b) => a - b).join('/')} px`);
    }
  }

  /* La rejilla centrada: los márgenes a cada lado tienen que ser iguales. Se
     mide contra la ventana, no contra #test-area, porque la capa del módulo
     es fija a pantalla completa. */
  const margenes = await pc.evaluate(() => {
    const g = document.querySelector('#modulo-area svg g') || document.querySelector('#modulo-area svg');
    if (!g) return null;
    const r = g.getBoundingClientRect();
    return {
      izq: r.left, der: window.innerWidth - r.right,
      arr: r.top,  aba: window.innerHeight - r.bottom
    };
  });
  if (margenes) {
    m.comprobar('la rejilla está centrada en la pantalla',
      Math.abs(margenes.izq - margenes.der) <= 1.5 && Math.abs(margenes.arr - margenes.aba) <= 1.5,
      `márgenes izq ${margenes.izq.toFixed(1)} / der ${margenes.der.toFixed(1)}`
      + ` · arr ${margenes.arr.toFixed(1)} / aba ${margenes.aba.toFixed(1)} px`);
  }

  /* El paso, en píxeles ENTEROS del dispositivo. Este es el invariante que
     arregló la rejilla que alternaba líneas gruesas y finas: con un paso
     fraccionario unas caían sobre el borde del píxel y otras a caballo entre
     dos, y el paciente veía una diferencia que no está en su retina.
     Se comprueba así, sobre las coordenadas, y no sobre píxeles rasterizados,
     porque volver a rasterizar el SVG en un canvas NORMALIZA precisamente lo
     que el defecto produce: el navegador redibuja la imagen a la resolución
     del canvas y las posiciones sub-píxel que usó el compositor se pierden.
     Comprobado: con el paso fraccionario reinyectado, la sonda de píxeles da
     líneas perfectamente uniformes a DPR 1, 1,5 y 2. La coordenada no miente. */
  const paso = await pc.evaluate(() => {
    const xs = [...document.querySelectorAll('#modulo-area svg line')]
      .filter(l => +l.getAttribute('x1') === +l.getAttribute('x2'))
      .map(l => +l.getAttribute('x1'))
      .sort((a, b) => a - b);
    if (xs.length < 3) return null;
    const pasos = xs.slice(1).map((x, i) => x - xs[i]);
    return { dpr: window.devicePixelRatio, n: xs.length,
             min: Math.min(...pasos), max: Math.max(...pasos) };
  });
  if (paso) {
    const enDispositivo = paso.min * paso.dpr;
    const sobra = Math.abs(enDispositivo - Math.round(enDispositivo));
    m.comprobar('el paso de la rejilla es un número entero de píxeles del dispositivo',
      sobra < 0.01 && Math.abs(paso.max - paso.min) < 0.01,
      `${paso.n} líneas verticales · paso ${paso.min.toFixed(4)} px CSS`
      + ` = ${enDispositivo.toFixed(4)} px de dispositivo a DPR ${paso.dpr}`
      + (Math.abs(paso.max - paso.min) < 0.01 ? '' : ` · pasos desiguales: ${paso.min}–${paso.max}`));
  } else {
    m.comprobar('la rejilla dibuja sus líneas como <line>', false, 'no encontré líneas verticales');
  }

  /* El cuadro tiene que medir 1° de arco. El módulo dice el grado real que
     consigue tras redondear el paso a píxeles enteros del dispositivo. */
  const nAmsler = await pc.textContent('#modulo-nombre');
  const grado = parseFloat((nAmsler.match(/=\s*([\d.,]+)°/) || [])[1]?.replace(',', '.'));
  m.comprobar('el cuadro mide 1° de arco con menos de un 2 % de error',
    isFinite(grado) && Math.abs(grado - 1) < 0.02, `el módulo declara ${grado}°`);

  // ── Pelli-Robson: los grises tienen que SALIR del monitor ───────────────
  /* El rango llega hasta 1,00 log CS y no más. No es una preferencia: los
     monitores de la consulta no enseñan NADA por encima de eso. Con el paso
     de 0,30 log y ocho filas, las dos últimas salían en código 253 y 254
     sobre un blanco de 255 — un contraste de uno y dos códigos, que ningún
     panel emite. El paciente «fallaba» un contraste que la pantalla nunca
     dibujó, y el resultado quedaba peor de lo que el ojo es.

     Así que lo que se mide aquí no es que haya N filas, sino que TODAS las
     que hay se puedan ver: cada gris separado del blanco por un margen que
     un panel de 8 bits sí distingue. */
  await abrir('Pelli-Robson');
  const pelli = await pc.evaluate(() => {
    const filas = [...document.querySelectorAll('#modulo-area > div > div')];
    const cont = document.querySelector('#modulo-area > div');
    const primera = filas[0]?.querySelector('span');
    return {
      n: filas.length,
      codigos: filas.map(f => {
        const c = getComputedStyle(f.querySelector('span')).color.match(/\d+/g);
        return c ? +c[0] : null;
      }),
      altoLetra: primera ? +primera.getBoundingClientRect().height.toFixed(2) : 0,
      altoTabla: cont ? +cont.getBoundingClientRect().height.toFixed(2) : 0,
      arriba: cont ? +cont.getBoundingClientRect().top.toFixed(2) : 0,
      alto: window.innerHeight,
      nombre: (document.getElementById('modulo-nombre') || {}).textContent || ''
    };
  });

  /* El paso lo declara el módulo en su propio rótulo (fila k/N y log CS de la
     fila en curso), así que el reparto se deduce en vez de copiarse: si
     mañana se reparte 0 a 1,00 en cuatro filas o en seis, esta prueba lo
     sigue. Lo único fijo es el techo: 1,00 log. */
  const tope = 1.00;
  const pasoLog = pelli.n > 1 ? tope / (pelli.n - 1) : 0;

  /* El techo no se lee de ningún rótulo: se RECUPERA de la tinta que la
     pantalla pinta de verdad. Deshaciendo la gamma del gris más tenue sale
     el log CS de la última fila — 243 devuelve 1,00, y el 254 de la cartilla
     de ocho devolvía 2,07, que es el contraste que se pedía y que ningún
     monitor de la consulta emite. */
  const topeDibujado = (() => {
    const c = Math.max(...pelli.codigos) / 255;
    return -Math.log10(1 - Math.pow(c, 2.2));
  })();
  m.comprobar('la fila más tenue pide 1,00 log CS y no más',
    Math.abs(topeDibujado - tope) < 0.02,
    'la tinta dibujada equivale a ' + topeDibujado.toFixed(2) + ' log CS');

  /* Contraste de Weber convertido a código de 8 bits con gamma 2,2:
     255·(1−c)^(1/2,2), con c = 10^(−log). */
  const esperados = Array.from({ length: pelli.n }, (_, i) => {
    const c = 1 / Math.pow(10, i * pasoLog);
    return Math.round(255 * Math.pow(1 - c, 1 / 2.2));
  });
  m.comprobar('los grises dibujados son los que sale el cálculo',
    JSON.stringify(pelli.codigos) === JSON.stringify(esperados),
    'dibujados ' + pelli.codigos.join(', ') + ' · calculados ' + esperados.join(', '));

  /* La comprobación que habría cazado el defecto: ningún gris a menos de
     ocho códigos del blanco. Ocho es el escalón que un panel de 8 bits con
     dithering enseña sin discusión; 253 y 254 no lo son. */
  const MARGEN_BLANCO = 8;
  const pegados = pelli.codigos.filter(c => 255 - c < MARGEN_BLANCO);
  m.comprobar('ninguna fila queda pegada al blanco, invisible en el monitor',
    pegados.length === 0,
    pegados.length ? pegados.length + ' fila(s) en código ' + pegados.join(', ')
                     + ' sobre blanco 255: el paciente falla un contraste que nunca se dibujó'
                   : 'el más tenue es ' + Math.max(...pelli.codigos) + ', a '
                     + (255 - Math.max(...pelli.codigos)) + ' códigos del blanco');

  /* N filas más N−1 medias separaciones son (3N−1)/2 altos de letra, y el
     margen es un cuarto de letra arriba y abajo. Sin ese margen la primera
     fila empezaba en el píxel 0, cortada. */
  if (pelli.altoLetra > 0) {
    const altosEsperados = (3 * pelli.n - 1) / 2;
    m.comprobar('la tabla mide ' + altosEsperados.toString().replace('.', ',') + ' altos de letra',
      Math.abs(pelli.altoTabla / pelli.altoLetra - altosEsperados) < 0.05,
      (pelli.altoTabla / pelli.altoLetra).toFixed(3) + ' altos con ' + pelli.n + ' filas');
    m.comprobar('queda un cuarto de letra de margen arriba',
      Math.abs(pelli.arriba / pelli.altoLetra - 0.25) < 0.05 && pelli.arriba > 1,
      pelli.arriba.toFixed(1) + ' px = ' + (pelli.arriba / pelli.altoLetra).toFixed(3) + ' altos');
  }

  /* ── La medida estándar de Worth y de Schober ───────────────────────────
     Los dos dibujan una figura de gafa rojo-verde y ninguno es una prueba de
     agudeza: lo que se juzga es la forma —cuántos puntos se ven, dónde cae la
     cruz—, no el umbral de un optotipo. Así que su tamaño no tiene por qué
     salir de un ángulo clásico que a 6 m no cabe.

     Lo que había: Worth ofrecía 1,25°, 2°, 3° y «máx». A 6 m el techo son
     0,84°, así que los tres clásicos dibujaban un cartel rojo de NO CABE y el
     «máx» llenaba la pantalla de lado a lado. Schober igual: el paso ERA 1Δ,
     así que a 6 m solo entraban dos anillos y elegir 3, 5 o 7 dibujaba
     siempre los mismos dos — se medía con dos creyendo haber elegido cinco.

     Lo que se mide aquí: una medida estándar, el 80 % del lado corto, que
     deja margen a los cuatro lados SIEMPRE; y en Schober, que se dibujen los
     anillos que se piden, sea la distancia que sea. */
  const OCUPA = 0.80, HOLGURA = 0.03;
  const dibujado = () => pc.evaluate(() => {
    const svg = document.querySelector('#modulo-area svg');
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    return { w: +r.width.toFixed(1), h: +r.height.toFixed(1),
             corto: Math.min(window.innerWidth, window.innerHeight),
             anillos: svg.querySelectorAll('circle[fill="none"]').length,
             puntos: svg.querySelectorAll('circle[fill]:not([fill="none"])').length,
             texto: (document.getElementById('modulo-area').textContent || '').trim().slice(0, 40) };
  });

  await abrir('Luces de Worth');
  const w = await dibujado();
  m.comprobar('Worth dibuja su rombo a 6 m, sin carteles de que no cabe',
    !!w && w.puntos === 4,
    w ? (w.puntos === 4 ? 'los cuatro puntos' : 'no hay rombo: «' + w.texto + '»')
      : 'no hay SVG: «' + ((await pc.textContent('#modulo-area')) || '').trim().slice(0, 40) + '»');
  if (w) {
    const ocupa = Math.max(w.w, w.h) / w.corto;
    m.comprobar('y ocupa la medida estándar, no la pantalla entera',
      Math.abs(ocupa - OCUPA) < HOLGURA,
      (100 * ocupa).toFixed(1) + ' % del lado corto (' + w.corto + ' px)');
  }

  /* Y que no haya nada que elegir: el tamaño es uno. Un grupo de tamaños con
     tres opciones imposibles era el defecto, no la solución. */
  const opcionesWorth = await tel.evaluate(() => {
    const p = document.getElementById('panel-worth');
    if (!p || p.classList.contains('oculto')) return -1;
    const g = document.getElementById('worth-tamanos');
    return g ? g.querySelectorAll('button').length : 0;
  });
  m.comprobar('Worth no ofrece tamaños que elegir: la medida es una',
    opcionesWorth === 0,
    opcionesWorth < 0 ? 'el panel de Worth no está a la vista'
                      : opcionesWorth + ' botones de tamaño en el mando');

  await abrir('Schober');
  const sch = await dibujado();
  if (sch) {
    const ocupaS = Math.max(sch.w, sch.h) / sch.corto;
    m.comprobar('Schober ocupa la misma medida estándar',
      Math.abs(ocupaS - OCUPA) < HOLGURA,
      (100 * ocupaS).toFixed(1) + ' % del lado corto con ' + sch.anillos + ' anillos');
  }

  /* Los anillos que se piden son los que se dibujan. Este es el que acusaba
     el defecto: a 6 m se elegían 7 y aparecían 2. */
  /* Por el rótulo EXACTO del botón, no por «contiene un 5»: la nota de cada
     opción lleva su Δ por anillo, y «0,59Δ cada uno» contiene un 5. La primera
     versión de esta comprobación caía en eso y acusaba al módulo de dibujar 3
     anillos cuando se pedían 5 — el defecto estaba en la prueba. */
  const pedirAnillos = async etiqueta => {
    await tel.locator('#schober-anillos button .g')
      .filter({ hasText: new RegExp('^' + etiqueta + '$') }).first().click();
    await tel.waitForTimeout(500);
    return dibujado();
  };
  const tresYsiete = [];
  for (const n of ['3', '5', '7']) {
    const d = await pedirAnillos(n);
    tresYsiete.push({ pedidos: +n, dibujados: d ? d.anillos : 0, ocupa: d ? Math.max(d.w, d.h) / d.corto : 0 });
  }
  m.comprobar('los anillos que se eligen son los que se dibujan, a 6 m',
    tresYsiete.every(x => x.dibujados === x.pedidos),
    tresYsiete.map(x => x.pedidos + '→' + x.dibujados).join(' · '));
  m.comprobar('y la figura mide lo mismo con 3, 5 o 7 anillos',
    tresYsiete.every(x => Math.abs(x.ocupa - tresYsiete[0].ocupa) < 0.01),
    tresYsiete.map(x => (100 * x.ocupa).toFixed(1) + ' %').join(' · '));
  await pedirAnillos('5');

  // ── Schober: la invariancia de invertir colores y cambiar de ojo ─────────
  await abrir('Schober');
  const leerTabla = () => tel.evaluate(() =>
    [...document.querySelectorAll('#schober-lectura > *')]
      .map(e => e.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean));
  const ojoRojo = () => tel.evaluate(() => {
    const sel = document.querySelector('#schober-ojos button.sel');
    return sel ? sel.textContent.trim() : '?';
  });

  const tabla0 = await leerTabla();
  const ojo0 = await ojoRojo();
  await tel.click('#panel-schober .conmut');                       // invertir los colores
  await tel.waitForTimeout(450);
  /* Y pasar el filtro rojo al OTRO ojo: el botón del ojo que no está
     seleccionado. Las dos cosas juntas describen la misma situación clínica,
     así que la tabla de lectura tiene que salir idéntica. */
  await tel.locator('#schober-ojos button:not(.sel)').first().click();
  await tel.waitForTimeout(450);
  const tabla1 = await leerTabla();
  const ojo1 = await ojoRojo();

  if (tabla0.length >= 3) {
    m.comprobar('invertir colores y cambiar de ojo dan la misma lectura',
      JSON.stringify(tabla0) === JSON.stringify(tabla1),
      `${tabla0.length} filas de referencia, rojo en ${ojo0} → ${ojo1}`
      + (JSON.stringify(tabla0) === JSON.stringify(tabla1) ? '' : ' — DIFIEREN'));
    m.comprobar('el cambio de ojo llega de verdad a la pantalla', ojo0 !== ojo1,
      `rojo en ${ojo0} → ${ojo1}`);
  } else {
    m.comprobar('la tabla de lectura de Schober se pinta', false,
      `solo ${tabla0.length} filas en #schober-lectura`);
  }

  /* Dejar Schober como estaba: las suites siguientes no deben heredar el
     ojo cambiado ni los colores invertidos. */
  await tel.click('#panel-schober .conmut');
  await tel.waitForTimeout(350);
  await tel.locator('#schober-ojos button:not(.sel)').first().click();
  await tel.waitForTimeout(350);

  return m;
}
