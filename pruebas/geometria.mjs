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
import { marcador, elegirModo } from './ayuda.mjs';

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

  /* ── El anillo de los símbolos LEA, y que sea uniforme ─────────────────
     El juego LEA se apoya en que los cuatro símbolos se desenfoquen hasta
     manchas equivalentes en el umbral, y para eso el trazo tiene que valer lo
     mismo en todas partes. El círculo lo cumple por definición: es un
     stroke-width. La manzana no, porque estaba dibujada como dos beziers
     independientes —la de fuera y la de dentro— con relleno evenodd, y dos
     curvas hechas a mano no se mantienen paralelas.

     Se mide con una transformada de distancia sobre la tinta: en un anillo de
     grosor constante las distancias al borde se reparten uniformemente, así
     que el percentil 99 vale unas dos veces la mediana. Donde el anillo
     engorda, el percentil 99 se despega. Medido: el círculo da 1,96 y la
     manzana trazada 2,00 — el mismo anillo; la manzana de contorno doble daba
     2,61.

     La comparación es contra el CÍRCULO y no contra un número fijo, porque el
     cuadrado y la casa tienen esquinas y ahí el grosor se despega por
     geometría y no por descuido. */
  await abrir('Optotipos');
  await elegirModo(pc, 'pediatric');
  await pc.waitForTimeout(700);
  /* La primera pantalla dibuja UN símbolo —es la línea 20/400— así que hay que
     bajar hasta una que tenga las cinco posiciones y enseñe los cuatro. */
  const cuantosSimbolos = () => pc.evaluate(() =>
    new Set([...document.querySelectorAll('#lines-container img')].map(i => i.src)).size);
  for (let i = 0; i < 6 && (await cuantosSimbolos()) < 4; i++) {
    await pc.keyboard.press('ArrowDown');
    await pc.waitForTimeout(350);
  }
  /* Y si en esa línea no salieron los cuatro, se remezcla: el alfabeto tiene
     cuatro símbolos y la línea cinco posiciones, así que con unas cuantas
     barajadas aparecen todos. */
  for (let i = 0; i < 12 && (await cuantosSimbolos()) < 4; i++) {
    await pc.keyboard.press('ArrowRight');
    await pc.waitForTimeout(200);
  }

  const anillos = await pc.evaluate(async () => {
    const S = 360;
    const uniformidad = async uri => {
      const img = new Image();
      await new Promise(ok => { img.onload = ok; img.src = uri; });
      const c = document.createElement('canvas'); c.width = S; c.height = S;
      const g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, S, S);
      const esc = Math.min(S / img.width, S / img.height) * 0.9;
      const w = img.width * esc, h = img.height * esc;
      g.drawImage(img, (S - w) / 2, (S - h) / 2, w, h);
      const d = g.getImageData(0, 0, S, S).data;
      const INF = 1e6, dist = new Float32Array(S * S);
      for (let i = 0; i < S * S; i++) dist[i] = d[i * 4] < 128 ? INF : 0;
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const i = y * S + x; if (!dist[i]) continue;
        let v = dist[i];
        if (x > 0) v = Math.min(v, dist[i-1] + 1);
        if (y > 0) v = Math.min(v, dist[i-S] + 1);
        if (x > 0 && y > 0) v = Math.min(v, dist[i-S-1] + 1.414);
        if (x < S-1 && y > 0) v = Math.min(v, dist[i-S+1] + 1.414);
        dist[i] = v; }
      for (let y = S-1; y >= 0; y--) for (let x = S-1; x >= 0; x--) { const i = y * S + x; if (!dist[i]) continue;
        let v = dist[i];
        if (x < S-1) v = Math.min(v, dist[i+1] + 1);
        if (y < S-1) v = Math.min(v, dist[i+S] + 1);
        if (x < S-1 && y < S-1) v = Math.min(v, dist[i+S+1] + 1.414);
        if (x > 0 && y < S-1) v = Math.min(v, dist[i+S-1] + 1.414);
        dist[i] = v; }
      const vs = [];
      for (let i = 0; i < S * S; i++) if (dist[i] > 0 && dist[i] < INF) vs.push(dist[i]);
      vs.sort((a, b) => a - b);
      if (vs.length < 500) return null;
      const p50 = vs[Math.floor(vs.length * 0.5)], p99 = vs[Math.floor(vs.length * 0.99)];
      return +(p99 / p50).toFixed(3);
    };
    /* Por el src COMPLETO. La primera versión agrupaba por los últimos doce
       caracteres del data-URI y dos de los cuatro símbolos coinciden ahí, así
       que medía tres y decía que faltaba uno: el defecto estaba en la sonda. */
    const uris = {};
    for (const img of document.querySelectorAll('#lines-container img')) uris[img.src] = img.src;
    /* Los cuatro están en SVG_CACHE, pero eso no es alcanzable desde aquí: se
       leen del DOM, que es lo que el paciente ve de verdad. */
    const fuera = {};
    for (const [k, u] of Object.entries(uris)) fuera[k] = await uniformidad(u);
    return fuera;
  });

  const valores = Object.values(anillos).filter(v => v != null);
  /* El círculo es el anillo perfecto y da el valor de referencia; el resto de
     los símbolos CURVOS no puede despegarse de él más de un 10 %. El cuadrado
     y la casa quedan fuera de la comparación por sus esquinas — y para saber
     cuál es cuál se ordenan: el más uniforme de los cuatro es el círculo. */
  /* Se compara contra el MÁS UNIFORME de los cuatro, no contra un número fijo,
     y se exige que los cuatro entren en un 10 % de él. La primera versión de
     esta comprobación pedía «al menos dos dentro del 10 %» y pasaba con la
     manzana vieja puesta: el círculo y la casa ya son dos. Reinyectada, la
     manzana de contorno doble da 2,62 contra 1,91 de referencia y ahora sí
     queda fuera. */
  const ref = Math.min(...valores);
  const dentro = valores.filter(v => v <= ref * 1.10);
  m.comprobar('los cuatro símbolos LEA tienen el anillo de grosor uniforme',
    valores.length >= 4 && dentro.length === valores.length,
    valores.length >= 4
      ? 'p99/p50: ' + valores.map(v => v.toFixed(2)).join(' · ')
        + ` · el más uniforme ${ref.toFixed(2)} · fuera del 10 %: `
        + valores.filter(v => v > ref * 1.10).map(v => v.toFixed(2)).join(', ') || 'ninguno'
      : 'solo ' + valores.length + ' símbolos medidos');
  await elegirModo(pc, 'letters');
  await pc.waitForTimeout(400);

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

  /* ── El color: que la figura tenga tinta para leerse ───────────────────
     La lámina es un mosaico de 30 puntos de ancho, así que lo que decide si
     la cifra se lee no es el DOM —ahí no hay cifra, hay un canvas— sino
     cuántos puntos caen dentro de ella. Al 46 % del disco el trazo se
     quedaba en 2,8 puntos y la cifra salía un borrón; al 60 % son 3,6 y
     tiene forma.

     Y con figuras para un niño que no lee números el riesgo es el mismo
     pero peor: una estrella tiene brazos finos, y unos brazos de dos puntos
     no son una estrella. Así que se mide lo dibujado: se agrupan los puntos
     pintados por CROMATICIDAD en dos racimos —figura y fondo, que están a la
     misma luminancia a propósito— y se exige que el racimo de la figura sea
     una parte razonable del disco. Ni demasiado poco (no se ve) ni
     demasiado (no hay fondo contra el que confundirse). */
  /* Los márgenes salen de medir las siete láminas de cifras que ya funcionan:
     una cifra de un dígito ocupa entre el 5,7 % y el 7,3 % del disco y una de
     dos entre el 11 % y el 12 %. Así que el suelo es el 4 % —por debajo de eso
     la figura no está o es un punto— y el techo el 45 %, por encima del cual no
     queda fondo contra el que confundirse. La separación cromática entre los
     dos racimos va de 0,057 en la de demostración a 0,153 en las de confusión:
     un suelo de 0,03 caza la lámina que saldría de un solo color, es decir en
     blanco para todo el mundo. */
  const RACIMO_MIN = 0.04, RACIMO_MAX = 0.45, SEPARACION_MIN = 0.03;
  const racimoFigura = () => pc.evaluate(() => {
    const cv = document.querySelector('#modulo-area canvas');
    if (!cv) return null;
    const W = cv.width, H = cv.height;
    const d = cv.getContext('2d').getImageData(0, 0, W, H).data;
    const en = (x, y) => (y * W + x) * 4;

    /* Solo el INTERIOR de los puntos. La primera versión de esta sonda metía
       en el saco el papel de la cartilla (#f2f0ec, el 30 % del disco) y los
       píxeles del borde de cada punto, que son mezclas de punto y papel. Con
       eso las dos medias separaban «papel» de «puntos» en vez de figura de
       fondo, y daban el 47 % en unas láminas y el 3 % en otras: la sonda medía
       otra cosa y lo decía con mucha seguridad.
       Un píxel cuenta si sus cuatro vecinos son casi idénticos —eso deja fuera
       los bordes— y si no es el papel. */
    const papel = [242, 240, 236];
    /* El disco llena el lienzo: centro y radio salen de sus dimensiones. */
    const cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2;
    const pts = [];
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const i = en(x, y);
        if (d[i + 3] < 250) continue;
        let liso = true;
        for (const j of [en(x - 1, y), en(x + 1, y), en(x, y - 1), en(x, y + 1)]) {
          if (d[j + 3] < 250 ||
              Math.abs(d[j] - d[i]) > 6 || Math.abs(d[j+1] - d[i+1]) > 6 || Math.abs(d[j+2] - d[i+2]) > 6) {
            liso = false; break;
          }
        }
        if (!liso) continue;
        if (Math.abs(d[i] - papel[0]) < 10 && Math.abs(d[i+1] - papel[1]) < 10
            && Math.abs(d[i+2] - papel[2]) < 10) continue;
        const sum = d[i] + d[i+1] + d[i+2];
        if (sum < 30) continue;
        pts.push([d[i] / sum, d[i+1] / sum, x, y]);
      }
    }
    if (pts.length < 1000) return { n: pts.length, share: 0, separacion: 0 };

    /* Dos medias sobre la cromaticidad, sembradas en los extremos del eje de
       mayor varianza. La luminancia se normaliza al dividir por la suma: su
       jitter es a propósito y no debe separar racimos. */
    let mr = 0, mg = 0;
    for (const p of pts) { mr += p[0]; mg += p[1]; }
    mr /= pts.length; mg /= pts.length;
    let vr = 0, vg = 0;
    for (const p of pts) { vr += (p[0] - mr) ** 2; vg += (p[1] - mg) ** 2; }
    const eje = vr >= vg ? 0 : 1;
    const orden = pts.map(p => p[eje]).sort((u, v) => u - v);
    const lo = orden[Math.floor(orden.length * 0.02)];
    const hi = orden[Math.floor(orden.length * 0.98)];
    let a = eje === 0 ? [lo, mg] : [mr, lo];
    let b = eje === 0 ? [hi, mg] : [mr, hi];
    for (let it = 0; it < 15; it++) {
      const sa = [0, 0], sb = [0, 0];
      let na = 0, nb = 0;
      for (const p of pts) {
        const da = (p[0] - a[0]) ** 2 + (p[1] - a[1]) ** 2;
        const db = (p[0] - b[0]) ** 2 + (p[1] - b[1]) ** 2;
        if (da <= db) { sa[0] += p[0]; sa[1] += p[1]; na++; }
        else          { sb[0] += p[0]; sb[1] += p[1]; nb++; }
      }
      if (na) a = [sa[0] / na, sa[1] / na];
      if (nb) b = [sb[0] / nb, sb[1] / nb];
    }
    let na = 0;
    const deA = [], deB = [];
    for (const p of pts) {
      const da = (p[0] - a[0]) ** 2 + (p[1] - a[1]) ** 2;
      const db = (p[0] - b[0]) ** 2 + (p[1] - b[1]) ** 2;
      if (da <= db) { na++; deA.push(p); } else deB.push(p);
    }
    /* Y cuánto fondo le queda alrededor a la figura. Es de lo que vive esta
       prueba: la cifra se esconde en el mosaico, y si llega al borde del disco
       deja de tener dónde esconderse — se ve el contorno aunque no se
       distinga el color. Se mide el punto de la figura MÁS LEJANO del centro
       frente al radio del disco. */
    const figura = na <= pts.length - na ? deA : deB;
    let lejos = 0;
    for (const p of figura) {
      const r = Math.hypot(p[2] - cx, p[3] - cy);
      if (r > lejos) lejos = r;
    }
    return { n: pts.length, share: Math.min(na, pts.length - na) / pts.length,
             separacion: +Math.hypot(a[0] - b[0], a[1] - b[1]).toFixed(4),
             margen: +(1 - lejos / R).toFixed(3) };
  });

  await abrir('Pseudoisocromático');

  /* Primero: que haya un juego para quien no lee números. Un niño de tres
     años no dice «veintiséis», y sin esto el módulo no se le puede pasar. */
  const juegos = await tel.evaluate(() => {
    const g = document.getElementById('color-juegos');
    return g ? [...g.querySelectorAll('button')].map(b => b.textContent.replace(/\s+/g, ' ').trim()) : [];
  });
  m.comprobar('el color ofrece un juego de figuras, no solo cifras',
    juegos.length >= 2 && juegos.some(t => /figura/i.test(t)),
    juegos.length ? juegos.join(' | ') : 'no hay selector de juego en el mando');

  const medidas = [];
  const recorrerLaminas = async etiqueta => {
    const flojas = [];
    for (let i = 0; i < 12; i++) {
      const r = await racimoFigura();
      const nombre = (await pc.textContent('#modulo-nombre') || '');
      const lam = (nombre.match(/lámina (\d+)\/(\d+)/) || []);
      if (!r) { flojas.push('sin lienzo'); break; }
      medidas.push((lam[1] || '?') + ': ' + (100 * r.share).toFixed(1) + ' % · sep '
        + r.separacion + ' · margen ' + (100 * (r.margen || 0)).toFixed(0) + ' %');
      if (!(r.share >= RACIMO_MIN && r.share <= RACIMO_MAX)) {
        flojas.push('lámina ' + (lam[1] || '?') + ' al ' + (100 * r.share).toFixed(1) + ' % del disco');
      }
      if (!(r.separacion >= SEPARACION_MIN)) {
        flojas.push('lámina ' + (lam[1] || '?') + ' con separación ' + r.separacion);
      }
      /* Y que le quede FONDO alrededor. Al agrandar las cifras —costaba
         distinguir el 6 del 5— lo que hay que sujetar es esto: una figura que
         llega al borde del disco deja de tener dónde esconderse y se lee por
         su contorno, no por su color. Un 6 % del radio son dos puntos del
         mosaico, que es el mínimo para que haya un anillo de fondo completo. */
      if (!(r.margen >= 0.06)) {
        flojas.push('lámina ' + (lam[1] || '?') + ' pegada al borde: margen '
          + (100 * r.margen).toFixed(0) + ' % del radio');
      }
      if (!lam[1] || lam[1] === lam[2]) break;
      await tel.click('#color-sig');
      await tel.waitForTimeout(700);
    }
    return flojas;
  };

  const flojasNum = await recorrerLaminas('números');
  m.comprobar('cada cifra tiene puntos suficientes y color distinto del fondo',
    flojasNum.length === 0, flojasNum.length ? flojasNum.join(' · ') : medidas.join(' | '));

  /* Y lo mismo con las figuras, que es donde el riesgo es mayor. */
  if (juegos.some(t => /figura/i.test(t))) {
    await tel.locator('#color-juegos button').filter({ hasText: /figura/i }).first().click();
    await tel.waitForTimeout(900);
    const flojasFig = await recorrerLaminas('figuras');
    m.comprobar('cada figura tiene puntos suficientes y color distinto del fondo',
      flojasFig.length === 0,
      flojasFig.length ? flojasFig.join(' · ') : medidas.slice(-7).join(' | '));
    /* Y que la respuesta sea una PALABRA, leída donde el optometrista la lee:
       en el botón de «Respuesta correcta» del mando. La primera versión de esta
       comprobación miraba la lista de láminas —que dice «protán», no la
       respuesta— y pasaba sin comprobar nada. */
    await tel.click('#color-resp');
    await tel.waitForTimeout(600);
    const respFig = (await tel.textContent('#color-resp-val') || '').trim();
    m.comprobar('y la respuesta de una figura se dice con una palabra',
      /^[a-záéíóúñ]{4,}$/i.test(respFig),
      `el mando dice «${respFig}»`);
    await tel.click('#color-resp');
    await tel.waitForTimeout(400);
    await tel.locator('#color-juegos button').filter({ hasText: /n[úu]mero/i }).first().click();
    await tel.waitForTimeout(700);
  }

  /* ── La luz del relax, y que sea de verdad la que se pide ──────────────
     Eran tres valores fijos —15, 35 y 60 %— y la luz justa para una
     retinoscopía depende de la sala: de la lámpara de techo, de la persiana y
     del retinoscopio. Con tres escalones o te sobra o te falta.

     Lo que se mide es lo dibujado: se le pide una luz al mando y se comprueba
     que el centro de la diana sale con ESE nivel de gris. Un deslizador que
     mueve un rótulo y no el estímulo es peor que tres botones. */
  await abrir('Relax acomodativo');
  const luzCentro = () => pc.evaluate(() => {
    const cv = document.createElement('canvas');
    const el = document.querySelector('#modulo-area > div');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    /* El gradiente no se puede leer con getImageData —es CSS, no canvas— así
       que se lee el rótulo del módulo, que es lo que el sistema declara, y se
       compara con el alfa del primer tramo del gradiente, que sí está en el
       estilo calculado. */
    const bg = getComputedStyle(el).backgroundImage;
    const m = bg.match(/rgba?\(255,\s*255,\s*255,\s*([\d.]+)\)/);
    return { alfa: m ? +m[1] : null,
             nombre: (document.getElementById('modulo-nombre') || {}).textContent || '' };
  });

  const control = await tel.evaluate(() => {
    const r = document.querySelector('#relax-luz-rango');
    return r ? { min: +r.min, max: +r.max, paso: +r.step } : null;
  });
  m.comprobar('la luz del relax se regula de forma continua, no en tres saltos',
    !!control && control.max - control.min >= 80 && control.paso <= 5,
    control ? `de ${control.min} a ${control.max} en pasos de ${control.paso}`
            : 'no hay deslizador de luz en el mando');

  if (control) {
    const pedidas = [10, 45, 80];
    const medidas = [];
    for (const v of pedidas) {
      await tel.evaluate(pct => {
        const r = document.getElementById('relax-luz-rango');
        r.value = String(pct);
        r.dispatchEvent(new Event('input', { bubbles: true }));
        r.dispatchEvent(new Event('change', { bubbles: true }));
      }, v);
      await tel.waitForTimeout(700);
      const l = await luzCentro();
      const declarada = +((l && l.nombre.match(/(\d+)% de blanco/)) || [])[1];
      medidas.push({ pedida: v, declarada, alfa: l && l.alfa });
    }
    const bien = medidas.every(x => x.declarada === x.pedida
      && x.alfa != null && Math.abs(x.alfa - x.pedida / 100) < 0.01);
    m.comprobar('y lo que se pide es lo que la pantalla dibuja',
      bien, medidas.map(x => x.pedida + '% → declara ' + x.declarada + '% · alfa ' + x.alfa).join(' | '));
  }

  /* ── Fijación infantil: cada figura se mueve por su cuenta ──────────────
     El movimiento elegido (rebote, giro, recorrido, latido) mueve la figura
     ENTERA por la pantalla. Lo que se mide aquí es lo otro: que cada figura
     tenga además un gesto propio —la mariposa batiendo las alas, la llama del
     cohete, el pez moviendo la cola—, que no sean el mismo gesto repetido
     nueve veces, y las dos cosas que ese gesto no puede romper:

       · CONGELAR tiene que pararlo también. Congelar existe para que el niño
         mire a un punto fijo en el instante de la medida; una figura que sigue
         agitándose por dentro no está congelada, y el rótulo diría una cosa y
         la pantalla otra.
       · El gesto no puede sacar la figura de su tamaño declarado. El estímulo
         se declara en grados de arco y se dibuja en un cuadro de ese tamaño;
         un ala que se estira más allá del cuadro mide más de lo que el test
         dice medir. Se mide la TINTA dibujada en varios instantes, no el DOM:
         un `scale` en un `<g>` no se ve en ninguna coordenada del SVG.

     Las animaciones se leen con `getAnimations()`, que dice lo que el
     navegador está animando de verdad — no si el CSS existe. */
  await abrir('Fijación infantil');
  await tel.waitForTimeout(400);

  const figurasMando = await tel.evaluate(() =>
    [...document.querySelectorAll('#inf-figuras button')]
      .map(b => (b.querySelector('.n') || {}).textContent || ''));

  /* Los gestos que el navegador anima DENTRO del cuadro de la figura, por
     nombre de animación: los de la figura entera viven en el `<svg>` y no
     cuentan, porque son el movimiento elegido y no el gesto. */
  const gestosDeAhora = () => pc.evaluate(() => {
    const svg = document.querySelector('#modulo-area svg');
    if (!svg) return null;
    const dentro = [...svg.querySelectorAll('*')]
      .flatMap(e => e.getAnimations().map(a => a.animationName || ''))
      .filter(Boolean);
    const fuera = svg.getAnimations().map(a => a.animationName || '').filter(Boolean);
    return { dentro: [...new Set(dentro)].sort(), fuera };
  });

  /* La tinta se mide POR FASES, no esperando al reloj. Se paran las
     animaciones y se les pone el `currentTime` a doce puntos de su ciclo: así
     se ven los dos extremos de cada gesto siempre, y no «los instantes que
     tocaron». Con el muestreo por espera la primera versión de esto medía una
     sola figura —la última que quedaba elegida— y el parpadeo de la carita,
     que dura un 16 % del ciclo, se le escapaba casi siempre.

     También se para el movimiento de la figura ENTERA, solo para medir: si no,
     lo medido sería el recorrido por la pantalla y no el gesto. */
  const FASES = 12;
  const prepararFases = () => pc.evaluate(() => {
    const svg = document.querySelector('#modulo-area svg');
    if (!svg) return null;
    svg.style.animation = 'none';
    const anims = [...svg.querySelectorAll('*')].flatMap(e => e.getAnimations());
    anims.forEach(a => a.pause());
    window.__bvAnims = anims;
    const r = svg.getBoundingClientRect();
    const mx = Math.round(r.height * 0.3);
    return { lado: Math.round(r.width), mx, cuantas: anims.length,
             clip: { x: Math.max(0, Math.round(r.x) - mx), y: Math.max(0, Math.round(r.y) - mx),
                     width: Math.round(r.width) + 2 * mx, height: Math.round(r.height) + 2 * mx } };
  });
  const ponerFase = f => pc.evaluate(fr => {
    for (const a of (window.__bvAnims || [])) {
      const d = a.effect.getComputedTiming().duration;
      if (typeof d === 'number' && isFinite(d)) a.currentTime = fr * d;
    }
  }, f);
  const tintaAhora = async clip => {
    const png = await pc.screenshot({ clip });
    return pc.evaluate(async b64 => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const cv = document.createElement('canvas');
      cv.width = img.width; cv.height = img.height;
      const g2 = cv.getContext('2d'); g2.drawImage(img, 0, 0);
      const d = g2.getImageData(0, 0, cv.width, cv.height).data;
      // El fondo del módulo es #0a0a0a: tinta es todo lo que se distinga de él.
      let arr = 1e9, aba = -1, izq = 1e9, der = -1, n = 0;
      for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) {
        const k = (y * cv.width + x) * 4;
        if ((d[k] + d[k + 1] + d[k + 2]) / 3 > 40) {
          n++;
          if (y < arr) arr = y; if (y > aba) aba = y;
          if (x < izq) izq = x; if (x > der) der = x;
        }
      }
      if (aba < 0) return null;
      /* Y una firma de TODOS los píxeles, no solo de la tinta. El parpadeo de
         la carita son dos óvalos oscuros que se cierran DENTRO de la cara: la
         silueta no cambia ni un píxel y el recuento de tinta tampoco, así que
         con solo contar tinta la comprobación acusaba a la carita de estar
         quieta cuando parpadeaba delante de ella. */
      let h = 2166136261;
      for (let k = 0; k < d.length; k += 4) {
        h = (h ^ d[k]) * 16777619 | 0;
        h = (h ^ d[k + 1]) * 16777619 | 0;
        h = (h ^ d[k + 2]) * 16777619 | 0;
      }
      return { n, h, izq, arr, der, aba, ancho: der - izq + 1, alto: aba - arr + 1 };
    }, png.toString('base64'));
  };

  const porFigura = [];
  for (let i = 0; i < figurasMando.length; i++) {
    await tel.locator('#inf-figuras button').nth(i).click();
    await tel.waitForTimeout(420);
    const g = await gestosDeAhora();
    const caja = await prepararFases();
    const marcos = [];
    if (caja) {
      for (let f = 0; f < FASES; f++) {
        await ponerFase(f / FASES);
        marcos.push(await tintaAhora(caja.clip));
      }
    }
    const buenos = marcos.filter(Boolean);
    /* El `<svg>` RECORTA lo que se sale de su cuadro, así que un gesto que se
       pasa no aparece fuera: aparece pegado al borde y con la parte de fuera
       cortada — un ala a medias, que es peor que un ala quieta. Así que lo que
       se busca es tinta TOCANDO el borde del cuadro declarado. Las nueve
       figuras se dibujan con holgura dentro de su viewBox, así que tocarlo es
       siempre señal de recorte. */
    const b0 = caja ? caja.mx : 0, b1 = caja ? caja.mx + caja.lado - 1 : 0;
    const escapan = buenos.filter(t => t.izq <= b0 || t.arr <= b0
                                    || t.der >= b1 || t.aba >= b1).length;
    const tintas = new Set(buenos.map(t => t.h));
    porFigura.push({
      nombre: figurasMando[i], gestos: g ? g.dentro : [],
      lado: caja ? caja.lado : 0,
      maxLado: buenos.length ? Math.max(...buenos.map(t => Math.max(t.ancho, t.alto))) : 0,
      fases: buenos.length, escapan, cambia: tintas.size > 1
    });
  }

  const sinGesto = porFigura.filter(f => f.gestos.length === 0).map(f => f.nombre);
  const firmas = porFigura.map(f => f.gestos.join('+'));
  const distintos = new Set(firmas.filter(Boolean)).size;
  m.comprobar('cada figura infantil tiene un gesto propio, y no el mismo nueve veces',
    figurasMando.length === 9 && sinGesto.length === 0 && distintos === 9,
    figurasMando.length !== 9 ? figurasMando.length + ' figuras en el mando, no 9'
      : sinGesto.length ? 'quietas por dentro: ' + sinGesto.join(', ')
      : distintos + ' gestos distintos de ' + firmas.length + ' figuras · '
        + porFigura.map(f => f.nombre + ': ' + f.gestos.join('+')).join(' | '));

  /* Que ANIME no basta: una animación de algo que no se dibuja pasaría igual.
     Lo que se exige es que la tinta cambie de una fase a otra. */
  const quietas = porFigura.filter(f => !f.cambia).map(f => f.nombre);
  m.comprobar('y el gesto mueve tinta de verdad, no solo una propiedad',
    porFigura.length === 9 && quietas.length === 0,
    quietas.length ? 'la pantalla no cambia con: ' + quietas.join(', ')
      : porFigura.length + ' figuras, todas cambian a lo largo de su ciclo');

  const escapadas = porFigura.filter(f => f.escapan > 0 || f.maxLado > f.lado + 2);
  const cortas = porFigura.filter(f => f.fases < FASES);
  m.comprobar('y ninguna se sale del cuadro que el test declara, ni se recorta',
    porFigura.length === 9 && escapadas.length === 0 && cortas.length === 0,
    cortas.length ? 'no se pudo medir ' + cortas.map(f => f.nombre).join(', ')
      : escapadas.length ? escapadas.map(f => f.nombre + ' toca el borde: ' + f.maxLado
          + ' px en un cuadro de ' + f.lado + ' en ' + f.escapan + ' de ' + FASES
          + ' fases').join(' · ')
      : `cuadro ${porFigura[0].lado} px · máximo dibujado `
        + Math.max(...porFigura.map(f => f.maxLado)) + ' px ('
        + porFigura.reduce((a, b) => b.maxLado > a.maxLado ? b : a).nombre
        + ') en ' + FASES + ' fases de cada una');

  /* Congelar: NADA animándose, ni la figura entera ni sus partes. Va DESPUÉS
     de las fases, porque medirlas deja las animaciones en pausa y un repintado
     las rehace: elegir figura vuelve a dejarlo todo vivo. */
  await tel.locator('#inf-figuras button').first().click();
  await tel.waitForTimeout(420);
  await tel.click('#inf-congelar');
  await tel.waitForTimeout(600);
  const congelado = await gestosDeAhora();
  m.comprobar('congelar para también el gesto de dentro de la figura',
    !!congelado && congelado.dentro.length === 0 && congelado.fuera.length === 0,
    !congelado ? 'no hay figura dibujada'
      : (congelado.dentro.length || congelado.fuera.length)
        ? 'sigue animándose: dentro [' + congelado.dentro.join(', ') + '] fuera ['
          + congelado.fuera.join(', ') + ']'
        : 'nada se mueve');
  await tel.click('#inf-congelar');
  await tel.waitForTimeout(600);

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
