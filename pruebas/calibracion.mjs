/* ═══════════════════════════════════════════════════════════════════════════
   Cuánto se puede confiar en el milímetro, y si alguien lo dice donde se lee.

   Todo este sistema cuelga de una sola cantidad: cuántos píxeles CSS mide un
   milímetro. Los ocho módulos calculan su estímulo contra ella. Y hay dos
   formas de saberla, con calidades muy distintas:

   · medida con una tarjeta contra el cristal — un número real;
   · estimada con las pulgadas declaradas y la resolución — una suposición.

   Y un tercer estado, el peligroso: la tarjeta se midió en OTRA pantalla. Pasa
   en cuanto alguien desconecta el portátil del monitor de la consulta. Ahí el
   sistema lo sabe (`calStale`) y lo dice en su barra... que dentro de un módulo
   está plegada, con el pie escondido, mientras el optometrista mira el móvil.

   Esta prueba siembra una calibración de tarjeta de otra pantalla —exactamente
   lo que deja en el navegador un portátil que cambió de monitor— y exige que el
   mando lo diga. El estímulo puede seguir dibujándose; lo que no puede es
   parecer medido cuando es estimado.
   ═══════════════════════════════════════════════════════════════════════════ */
import { marcador } from './ayuda.mjs';

/* Una calibración de tarjeta que NO es de esta pantalla: cardDevW/H son la
   resolución del monitor donde se midió, y sameScreenAsCard() las compara con
   la de ahora. 7680×4320 no es la de nadie aquí, así que sale obsoleta. */
const TARJETA_DE_OTRA_PANTALLA = {
  monitorInches: 24, testDistanceM: 6,
  cardPxPerMM: 4.82, cardDpr: 1, cardDevW: 7680, cardDevH: 4320,
  calAck: true, pairCode: ''
};

export default async function pruebaCalibracion({ navegador, url }) {
  const m = marcador('La confianza en el milímetro');

  /* La siembra va por origen y por contexto, así que el contexto se crea aquí
     con el guión de arranque puesto: cuando la página corra su loadFromStorage,
     el 'bvc' ya está puesto. */
  const propio = await navegador.newContext({ viewport: { width: 1600, height: 900 } });
  await propio.addInitScript(sembrado => {
    try { localStorage.setItem('bvc', JSON.stringify(sembrado)); } catch (e) {}
  }, TARJETA_DE_OTRA_PANTALLA);
  const pc = await propio.newPage();
  await pc.goto(url);
  await pc.evaluate(() => document.fonts.ready);
  await pc.waitForTimeout(1400);

  /* Con una calibración obsoleta la pantalla abre el diálogo de la tarjeta sola
     —eso ya funcionaba—, y se cancela para llegar al estado que interesa: el
     sistema sabe que la medida no es de esta pantalla y sigue trabajando con la
     estimación. */
  const dialogoSolo = await pc.evaluate(() => {
    const d = document.getElementById('card-cal');
    return !!d && !d.classList.contains('hidden') && getComputedStyle(d).display !== 'none';
  });
  m.comprobar('una calibración de otra pantalla abre el diálogo de la tarjeta sola',
    dialogoSolo, dialogoSolo ? '' : 'el diálogo no salió: nadie avisa al arrancar');
  await pc.click('#card-cancel').catch(() => {});
  await pc.waitForTimeout(300);

  const barra = (await pc.textContent('#cal-status-footer') || '').trim();
  m.comprobar('la barra de la pantalla marca que hay que recalibrar',
    /recalibre|cambi/i.test(barra), `«${barra}»`);

  await pc.click('#shortcuts-toggle');
  await pc.waitForTimeout(500);
  const codigo = (await pc.textContent('#pair-code-label') || '').trim();
  await pc.keyboard.press('Escape');
  await pc.waitForTimeout(300);

  const ctxTel = await navegador.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
  const tel = await ctxTel.newPage();
  await tel.goto(url + 'remote?c=' + codigo);
  await tel.evaluate(() => document.fonts.ready);
  await tel.waitForTimeout(2000);

  /* Dentro de un módulo: la barra del PC se repliega y el pie se esconde, así
     que esto es lo único que el operador puede leer. */
  await tel.click('.cabecera .atras').catch(() => {});
  await tel.waitForTimeout(350);
  await tel.locator('#lista-modulos .fila-mod').filter({ hasText: 'Schober' }).first().click();
  await tel.waitForTimeout(900);

  /* La barra del PC ya no existe: el aviso de calibración vive en el panel, que
     nace cerrado. Así que lo que hay que comprobar es lo mismo por la otra
     punta — que el aviso NO está a la vista del paciente y sí llega al mando. */
  const aLaVista = await pc.evaluate(() => {
    const p = document.getElementById('panel-pc');
    const abierto = !!(p && p.checkVisibility({ visibilityProperty: true }));
    return { abierto, barra: !!document.getElementById('calibration-bar') };
  });
  m.comprobar('el aviso de calibración no está a la vista del paciente',
    !aLaVista.abierto && !aLaVista.barra,
    aLaVista.barra ? 'la barra del PC ha vuelto' :
      (aLaVista.abierto ? 'el panel está abierto' : 'el panel está cerrado y no hay barra'));

  const enMando = (await tel.textContent('#vista-modulo') || '').replace(/\s+/g, ' ');
  m.comprobar('el mando avisa de que la calibración no es de esta pantalla',
    /recalibr|otra pantalla|cambi[óo] la pantalla/i.test(enMando),
    /recalibr|otra pantalla|cambi/i.test(enMando)
      ? 'el móvil lo dice'
      : 'el móvil no lo menciona: el estímulo parece medido y es estimado');

  await ctxTel.close();
  await propio.close();
  return m;
}
