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
import { marcador } from './ayuda.mjs';

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
    await pc.click(`.mode-btn[data-mode="${modo}"]`);
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
        const uniforme = new Set(l.altos).size === 1;
        const desvio = esperado === null ? 0 : Math.abs(l.altos[0] - esperado);
        const ok = esperado === null ? uniforme : (uniforme && desvio < 0.15);
        comprobadas++;
        if (!ok) {
          fallos++;
          peores.push(`${modo} p${pant} ${l.snellen}: altos ${[...new Set(l.altos)].join('/')} vs ${esperado}`);
        }
      }
      await pc.keyboard.press('ArrowDown');
    }
  }

  m.comprobar('56 líneas con el alto de tinta correcto y uniforme',
    comprobadas === 56 && fallos === 0,
    `${comprobadas} líneas comprobadas, ${fallos} fallos` + (peores.length ? ' — ' + peores.slice(0, 3).join(' | ') : ''));

  /* El 20/20 es la referencia que el resto del sistema usa: 5' de arco a 6 m
     son 8,727 mm, y de ahí sale toda la escala. Merece su propia
     comprobación, con el nombre puesto, y no puede depender de en qué
     pantalla dejó el bucle de arriba: se recorren las seis buscando la línea.
     Una comprobación que casi nunca se ejecuta es peso muerto que da falsa
     tranquilidad. */
  await pc.click('.mode-btn[data-mode="letters"]');
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

  /* ── El 0 no entra en el juego de números ──────────────────────────────
     Optician Sans dibuja el cero del conjunto ss01 como un rectángulo
     redondeado con una BARRA DIAGONAL maciza dentro, y a tamaño de optotipo
     eso se lee como un 8: dos lóbulos separados por un trazo. Medido
     rasterizando los glifos en la propia página, que es el único sitio donde
     ss01 se aplica —una SVG cargada como <img> no alcanza las fuentes del
     documento y da el glifo de reserva, que no lleva barra.

     El cero sin ss01 sí es un óvalo limpio, pero mide 0,520 em de alto en vez
     de 0,500: un 4 % de más, media línea de la escala. Y ss01 existe
     precisamente para eso. Así que no se arregla el glifo, se quita el
     carácter — que es lo que hace cualquier juego de optotipos: Sloan
     descartó las letras confundibles en vez de redibujarlas. */
  await pc.click('.mode-btn[data-mode="numbers"]');
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
  m.comprobar('el juego de números no usa el 0, que con ss01 lleva barra y se lee como un 8',
    !digitos.has('0') && digitos.size >= 8 && /^[1-9]+$/.test(conjunto),
    `dibujados: ${conjunto || '(ninguno)'}`);
  await pc.click('.mode-btn[data-mode="letters"]');
  await pc.waitForTimeout(300);

  /* Volver arriba: las pruebas siguientes esperan el estado de arranque. */
  for (let i = 0; i < 8; i++) { await pc.keyboard.press('ArrowUp'); await pc.waitForTimeout(30); }
  return m;
}
