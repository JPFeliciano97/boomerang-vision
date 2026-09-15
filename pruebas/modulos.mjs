/* ═══════════════════════════════════════════════════════════════════════════
   Barrido de los ocho módulos: que cada uno dibuje algo, saque su panel en
   el mando, declare su geometría y no desborde la pantalla de un móvil.

   La comprobación de «dibuja algo» parece tonta y no lo es: los módulos se
   pintan desde una capa nueva (#modulo-area) y una excepción a mitad del
   render deja la pantalla del paciente EN NEGRO sin decir nada. Eso ya pasó
   tres veces durante la construcción, siempre por un identificador movido de
   sitio. El paciente mirando una pantalla vacía mientras el optometrista ve
   un mando con controles es el peor fallo posible de este sistema.
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
      const pasos = await tel.evaluate(() => !document.getElementById('mod-dist-pasos').classList.contains('oculto'));
      m.comprobar(mod.nombre.padEnd(19) + ` fija la distancia en ${mod.distFija} m`,
        et.toLowerCase() === 'acercado' && val === mod.distFija + ' m' && !pasos,
        `«${et}» ${val}` + (pasos ? ' · CON pasos de distancia, no debería' : ' · sin pasos'));
    }
  }

  return m;
}
