/* ═══════════════════════════════════════════════════════════════════════════
   La regresión del optotipo: 56 líneas entre los cuatro modos y las seis
   pantallas, midiendo la CAJA DE TINTA de cada carácter contra el tamaño
   físico que la propia línea anuncia.

   Por qué la caja de tinta y no el font-size: el alto de un optotipo se
   define como 5 minutos de arco de TINTA, y en una fuente el font-size no
   es el alto de la tinta — hay ascendente, descendente y, en las redondas,
   desbordamiento óptico. El sistema descuenta todo eso con métricas medidas
   glifo a glifo. Si esa tabla se desincroniza de la fuente, el 20/20 mide
   otra cosa y nada en la pantalla lo delata. Esta prueba es lo que lo
   delata.
   ═══════════════════════════════════════════════════════════════════════════ */
import { marcador, elegirModo } from './ayuda.mjs';

/* 5' de arco a 6 m son 8,727 mm para el 20/20; el resto escala con el
   denominador de Snellen. Se deriva, no se copia de una tabla: una tabla
   copiada puede estar de acuerdo con el código y equivocada los dos. */
const altoMM = denominador => 8.727 * denominador / 20;

export default async function pruebaOptotipos({ pc }) {
  const m = marcador('Optotipos · la geometría de las 56 líneas');

  const pxmm = parseFloat(await pc.textContent('#info-span'));
  m.comprobar('la barra anuncia una escala usable', pxmm > 0.5 && pxmm < 20, pxmm.toFixed(3) + ' px/mm');

  let comprobadas = 0, fallos = 0;
  const peores = [];

  for (const modo of ['letters', 'numbers', 'pediatric', 'e_directional']) {
    await elegirModo(pc, modo);
    await pc.waitForTimeout(250);
    for (let i = 0; i < 8; i++) { await pc.keyboard.press('ArrowUp'); await pc.waitForTimeout(30); }

    for (let pant = 1; pant <= 6; pant++) {
      await pc.waitForTimeout(260);
      const lineas = await pc.evaluate(() => {
        const out = [];
        document.querySelectorAll('#lines-container > div').forEach(ld => {
          const izq = ld.querySelector('.line-annotation-left') || ld.querySelector('[class*=left]');
          const elems = [...ld.querySelectorAll('.optotype-text, img')];
          if (!elems.length) return;
          out.push({
            snellen: izq ? izq.textContent.trim() : '?',
            n: elems.length,
            altos: elems.map(e => +e.getBoundingClientRect().height.toFixed(3))
          });
        });
        return out;
      });

      for (const l of lineas) {
        const den = (l.snellen.match(/(\d+)\s*$/) || [])[1];
        const esperado = den ? +(altoMM(+den) * pxmm).toFixed(2) : null;
        /* La uniformidad se pedía con igualdad EXACTA de la caja CSS, y eso
           no es una afirmación física: es redondeo. Con el 0 de vuelta —que
           se dibuja con el glifo base, de ratio 0,520 en vez de 0,500— la
           misma línea sale en 26,266 y 26,281 px. Son 0,015 px sobre 26, un
           0,06 %, mil veces por debajo del paso más pequeño de la escala
           (0,1 log ≈ 6 %). Lo que hay que cazar es un glifo dibujado con el
           ratio equivocado, y eso son 4 % = 1,05 px en la línea más pequeña,
           veinte veces esta tolerancia. Comprobado reinyectando el defecto. */
        const dispersion = Math.max(...l.altos) - Math.min(...l.altos);
        const uniforme = dispersion <= 0.05;
        const desvio = esperado === null ? 0 : Math.abs(l.altos[0] - esperado);
        const ok = esperado === null ? uniforme : (uniforme && desvio < 0.15);
        comprobadas++;
        if (!ok) {
          fallos++;
          peores.push(`${modo} p${pant} ${l.snellen}: altos ${[...new Set(l.altos)].join('/')}`
            + ` (dispersión ${dispersion.toFixed(3)} px) vs ${esperado}`);
        }
      }
      await pc.keyboard.press('ArrowDown');
    }
  }

  /* OJO CON EL NOMBRE, que estaba mintiendo: esto mide la CAJA del optotipo,
     no su tinta. `spanOptotipo` pone `fontSize = h_css / ratio` y
     `lineHeight = ratio`, así que la caja sale exactamente `h_css` sea cual sea
     el ratio — comprobado reinyectando el 0 con ratio 0,500 en vez de 0,520:
     la tinta dibujada se iba un 20 % y esta comprobación seguía en verde.
     Sigue valiendo (caza una caja mal maquetada y el redondeo grueso), pero la
     TINTA se mide en otras dos: «la línea 20/20 mide 8,727 mm de tinta» y «el
     0 dibujado no lleva barra», que compara su alto con el del 8 en píxeles. */
  m.comprobar('56 líneas con la caja del optotipo correcta y uniforme',
    comprobadas === 56 && fallos === 0,
    `${comprobadas} líneas comprobadas, ${fallos} fallos` + (peores.length ? ' — ' + peores.slice(0, 3).join(' | ') : ''));

  /* El 20/20 es la referencia que el resto del sistema usa: 5' de arco a 6 m
     son 8,727 mm, y de ahí sale toda la escala. Merece su propia
     comprobación, con el nombre puesto, y no puede depender de en qué
     pantalla dejó el bucle de arriba: se recorren las seis buscando la línea.
     Una comprobación que casi nunca se ejecuta es peso muerto que da falsa
     tranquilidad. */
  await elegirModo(pc, 'letters');
  await pc.waitForTimeout(250);
  for (let i = 0; i < 8; i++) { await pc.keyboard.press('ArrowUp'); await pc.waitForTimeout(30); }

  const buscar20 = () => pc.evaluate(() => {
    const l = [...document.querySelectorAll('#lines-container > div')]
      .find(d => /\b20\s*$/.test((d.querySelector('[class*=left]') || {}).textContent || ''));
    const t = l && l.querySelector('.optotype-text');
    return t ? +t.getBoundingClientRect().height.toFixed(2) : null;
  });

  let h20 = null, pantalla20 = null;
  for (let pant = 1; pant <= 6 && h20 == null; pant++) {
    await pc.waitForTimeout(260);
    h20 = await buscar20();
    if (h20 != null) { pantalla20 = pant; break; }
    await pc.keyboard.press('ArrowDown');
  }

  const esperado = +(8.727 * pxmm).toFixed(2);
  m.comprobar('la línea 20/20 mide 8,727 mm de tinta',
    h20 != null && Math.abs(h20 - esperado) < 0.15,
    h20 == null
      ? 'no se encontró la línea 20/20 en ninguna de las seis pantallas'
      : `${h20} px dibujados frente a ${esperado} px calculados (pantalla ${pantalla20})`);

  /* ═══════════ EL 0 SÍ, EL 1 NO ═══════════
     La barra diagonal del cero la pone `ss01`, no el glifo: medido pintando el
     0 en el DOM con los dos juegos y leyendo la tinta del centro — base 0 %
     (hueco), ss01 100 % (barra). El óvalo limpio existe, solo hay que pedirlo.

     Aquí hubo un error de razonamiento que conviene dejar escrito: se quitó el
     carácter entero porque el glifo base mide 0,520 em de tinta en vez de
     0,500, «un 4 %, media línea de la escala». Es falso. `spanOptotipo` calcula
     el tamaño como `h_css / ratio`, así que un ratio de 0,520 da una fuente más
     pequeña que dibuja EXACTAMENTE el alto pedido. La maquinaria ya compensaba;
     lo que había que hacer era sacar el 0 de SS01_METRICAS para que su ratio se
     mida del glifo base, y no aplicarle ss01.

     El que se va es el 1: en ss01 es una bandera inclinada sin base y en el
     juego base lleva serif de pie — dos dibujos distintos del mismo carácter, y
     en los dos es un trazo casi vertical que no aporta nada que reconocer. */
  await elegirModo(pc, 'numbers');
  await pc.waitForTimeout(400);
  const digitos = new Set();
  for (let pant = 0; pant < 6; pant++) {
    for (let mezcla = 0; mezcla < 4; mezcla++) {
      for (const ch of await pc.evaluate(() =>
        [...document.querySelectorAll('#lines-container .optotype-text')]
          .map(e => e.textContent).join(''))) digitos.add(ch);
      await pc.keyboard.press('ArrowRight');
      await pc.waitForTimeout(120);
    }
    await pc.keyboard.press('ArrowDown');
    await pc.waitForTimeout(200);
  }
  const conjunto = [...digitos].sort().join('');
  m.comprobar('el cero del juego de números es la O de las letras, no el 0',
    digitos.has('O') && !digitos.has('0') && !digitos.has('1') && digitos.size >= 8,
    `dibujados: ${conjunto || '(ninguno)'}`);

  /* Y el 0 DIBUJADO no lleva barra. Se mide la tinta del centro del glifo en
     la pantalla, no el CSS: la barra es exactamente tinta en el centro, y el 8
     —que sí la tiene por diseño— sirve de control. Sin el control, una sonda
     que midiera mal daría «hueco» para los dos y pasaría con el defecto. */
  for (let i = 0; i < 8; i++) { await pc.keyboard.press('ArrowUp'); await pc.waitForTimeout(40); }
  await pc.keyboard.press('ArrowDown'); await pc.keyboard.press('ArrowDown');
  await pc.waitForTimeout(300);
  /* Las líneas se reparten al azar, así que hay que remezclar hasta que salgan
     los dos en la misma: el 8 es el control y sin él la sonda no prueba nada. */
  /* Los dos en LA MISMA LÍNEA. La primera versión buscaba el primer 0 y el
     primer 8 de toda la pantalla, y cada línea tiene su tamaño: comparaba un 0
     de 105 px con un 8 de 131 y acusaba al 0 de estar mal escalado estándolo
     bien. Un control que vive en otra línea no es un control. */
  /* El control no tiene que ser el 8: basta CUALQUIER otro dígito de la misma
     línea, porque todos menos el 0 tienen tinta en el centro. Pedir el 8 en
     concreto dependía de la suerte del reparto y una ejecución se quedó sin
     encontrarlo en 25 mezclas. Lo que la prueba necesita es un control al
     mismo tamaño, no un carácter concreto. */
  let linea = -1, control = null;
  for (let i = 0; i < 30; i++) {
    const hallado = await pc.evaluate(() => {
      const ls = [...document.querySelectorAll('#lines-container > div')];
      /* El control no puede ser cualquier dígito. El 4 tiene el centro HUECO
         igual que la O —medido: 0 % de tinta, lo mismo que la O—, así que como
         control no dice nada, y esta comprobación pasaba o fallaba según qué
         dígito tocara al lado: verde con el 2, el 5 y el 8, roja con el 4.
         La lista son los tres MEDIDOS por encima del 85 %; los demás no se han
         medido y no se suponen. Con 30 mezclas sale uno enseguida. */
      const CRUZAN = ['8', '5', '2'];
      for (let k = 0; k < ls.length; k++) {
        const t = [...ls[k].querySelectorAll('.optotype-text')].map(e => e.textContent);
        const otro = t.find(c => CRUZAN.includes(c));
        if (t.includes('O') && otro) return { linea: k, control: otro };
      }
      return null;
    });
    if (hallado) { linea = hallado.linea; control = hallado.control; break; }
    await pc.keyboard.press('ArrowRight');
    await pc.waitForTimeout(110);
  }
  const centroDe = async ch => {
    const caja = await pc.evaluate(([c, li]) => {
      const ld = document.querySelectorAll('#lines-container > div')[li];
      const e = ld && [...ld.querySelectorAll('.optotype-text')].find(x => x.textContent === c);
      if (!e) return null;
      const r = e.getBoundingClientRect();
      /* CON MARGEN, y es la clave: recortando justo a la caja del elemento, una
         tinta que sobresale queda CORTADA y se mide exactamente el alto de la
         caja. Así la sonda pasaba con el 0 reinyectado al ratio equivocado —su
         tinta era un 4 % más alta y el recorte se la comía. */
      const mx = Math.round(r.height * 0.35);
      return { x: Math.max(0, Math.round(r.x) - mx), y: Math.max(0, Math.round(r.y) - mx),
               width: Math.round(r.width) + 2 * mx, height: Math.round(r.height) + 2 * mx };
    }, [ch, linea]);
    if (!caja || caja.width < 8 || caja.height < 8) return null;
    const png = await pc.screenshot({ clip: caja });
    return pc.evaluate(async b64 => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const cv = document.createElement('canvas');
      cv.width = img.width; cv.height = img.height;
      const g = cv.getContext('2d'); g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, cv.width, cv.height).data;
      const dentro = (x, y) => d[(y * cv.width + x) * 4] < 128;
      let arr = 1e9, aba = -1, izq = 1e9, der = -1;
      for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++)
        if (dentro(x, y)) { if (y < arr) arr = y; if (y > aba) aba = y;
                            if (x < izq) izq = x; if (x > der) der = x; }
      if (aba < 0) return { alto: 0, centro: -1 };
      /* El 20 % central de la caja de tinta: un óvalo hueco no tiene NADA ahí;
         una barra diagonal o la cintura de un 8 lo cruzan. */
      const cx = (izq + der) / 2, cy = (arr + aba) / 2;
      const rx = (der - izq) * 0.10, ry = (aba - arr) * 0.10;
      let tinta = 0, n = 0;
      for (let y = Math.round(cy - ry); y <= Math.round(cy + ry); y++)
        for (let x = Math.round(cx - rx); x <= Math.round(cx + rx); x++) {
          n++; if (dentro(x, y)) tinta++;
        }
      return { alto: aba - arr + 1, centro: +(tinta / Math.max(1, n) * 100).toFixed(1) };
    }, png.toString('base64'));
  };
  const c0 = linea >= 0 ? await centroDe('O') : null;
  const c8 = linea >= 0 ? await centroDe(control) : null;
  m.comprobar('y el cero dibujado no lleva barra: su centro está hueco y el de al lado no',
    c0 && c8 && c0.centro === 0 && c8.centro > 40
      && Math.abs(c0.alto - c8.alto) <= Math.max(1, c8.alto * 0.02),
    c0 && c8 ? `centro de la O ${c0.centro} % (alto ${c0.alto} px) · centro del ${control}`
             + ` ${c8.centro} % (alto ${c8.alto} px)`
             : linea < 0 ? 'no salió la O con otro dígito al lado en 30 mezclas'
             : 'no se pudo medir el ' + (c0 ? control : 'cero'));
  await elegirModo(pc, 'letters');
  await pc.waitForTimeout(300);

  /* Volver arriba: las pruebas siguientes esperan el estado de arranque. */
  for (let i = 0; i < 8; i++) { await pc.keyboard.press('ArrowUp'); await pc.waitForTimeout(30); }
  return m;
}
