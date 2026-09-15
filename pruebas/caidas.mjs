/* ═══════════════════════════════════════════════════════════════════════════
   Lo que pasa cuando algo se cae a media prueba.

   Es el suceso más probable de todos los que esta suite comprueba, y por mucho:
   un móvil se bloquea la pantalla a los treinta segundos de no tocarlo, y eso
   tira el socket. En una consulta va a pasar todos los días.

   Lo que NO puede pasar, en orden de gravedad:

   · Que la pantalla del paciente se quede en blanco. El paciente está a media
     prueba mirándola; que el estímulo desaparezca porque el móvil del
     optometrista se apagó sería el peor fallo de todos, y el más difícil de
     explicar en la sala.
   · Que el móvil vuelva a otro módulo del que está la pantalla. Ahí el
     optometrista toca controles de un test y el paciente ve otro.
   · Que los comandos dejen de llegar sin decirlo. El mando parecería vivo.

   Medido: nada de eso ocurre. Esta suite existe para que siga siendo así el día
   que alguien toque el emparejamiento por sala o el manejador de screenUpdate.
   ═══════════════════════════════════════════════════════════════════════════ */
import { marcador, emparejar } from './ayuda.mjs';

export default async function pruebaCaidas({ navegador, url }) {
  const m = marcador('Cuando se cae la conexión');

  const s = await emparejar(navegador, url);
  const { pc, tel } = s;

  const pantalla = async () => (await pc.textContent('#modulo-nombre') || '').trim();
  const pie = async () => (await pc.textContent('#remote-status') || '').trim();
  const enMovil = () => tel.evaluate(() => ({
    titulo: (document.getElementById('mod-titulo') || {}).textContent || '',
    enMenu: !document.getElementById('vista-menu').classList.contains('oculto')
  }));

  await s.abrir('Schober');
  const antes = await pantalla();
  m.comprobar('parte de una prueba en curso', /Schober/.test(antes), antes.slice(0, 70));

  // ── se cae la red del móvil ─────────────────────────────────────────────
  await tel.context().setOffline(true);
  await tel.waitForTimeout(3500);

  const durante = await pantalla();
  m.comprobar('la pantalla del paciente CONSERVA el estímulo con el móvil caído',
    durante === antes,
    durante === antes ? 'el estímulo no se movió'
                      : `cambió a «${durante.slice(0, 60)}» — el paciente se queda mirando otra cosa`);

  const pieCaido = await pie();
  m.comprobar('y el PC dice que se quedó sin mando', /sin mando/i.test(pieCaido), `«${pieCaido}»`);

  // ── vuelve la red ───────────────────────────────────────────────────────
  await tel.context().setOffline(false);
  await tel.waitForTimeout(6000);

  const pieVuelto = await pie();
  m.comprobar('al volver la red el PC vuelve a verlo', /conectado/i.test(pieVuelto), `«${pieVuelto}»`);

  const vuelto = await enMovil();
  m.comprobar('y el móvil regresa al MISMO módulo que la pantalla',
    /Schober/.test(vuelto.titulo),
    `el móvil ve «${vuelto.titulo}»` + (/Schober/.test(vuelto.titulo) ? '' : ' y la pantalla dibuja Schober'));

  /* Reconectar no basta: los comandos tienen que volver a llegar. Un mando que
     se ve conectado y no manda nada es peor que uno que se ve caído. */
  await tel.click('#panel-schober .conmut');
  await tel.waitForTimeout(800);
  const trasComando = await pantalla();
  m.comprobar('y los comandos vuelven a llegar de verdad',
    /cruz verde/.test(trasComando),
    trasComando.includes('cruz') ? trasComando.slice(trasComando.indexOf('cruz'), trasComando.indexOf('cruz') + 24)
                                 : 'el nombre no menciona el color de la cruz');

  // ── y si el que se recarga es el PC ─────────────────────────────────────
  /* Un F5 accidental, o el navegador que se reinicia. La pantalla arranca
     limpia a propósito —el módulo activo no se guarda— así que lo que importa
     es que el móvil la SIGA en vez de quedarse en un módulo que ya no está. */
  await pc.reload();
  await pc.evaluate(() => document.fonts.ready);
  await pc.waitForTimeout(2000);
  await pc.click('#card-cancel').catch(() => {});
  await pc.waitForTimeout(2800);

  const tras = await enMovil();
  const pieTras = await pie();
  m.comprobar('tras recargar el PC siguen emparejados', /conectado/i.test(pieTras), `«${pieTras}»`);
  m.comprobar('y el móvil sigue a la pantalla a optotipos, no se queda en el módulo viejo',
    /Optotipos/i.test(tras.titulo),
    `el móvil ve «${tras.titulo}»`);

  await pc.context().close();
  await tel.context().close();
  return m;
}
