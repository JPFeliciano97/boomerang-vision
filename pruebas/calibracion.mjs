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

  /* El panel de la «?» ya no existe; el código de sala está en el de control,
     que lo tiene siempre puesto. */
  await pc.waitForTimeout(300);
  /* Con `evaluate` y no `textContent`: si el elemento cambia de nombre, esto
     devuelve '' y la prueba lo DICE, en vez de gastar 30 s en un timeout de
     localizador que no explica nada. Ya pasó. */
  const codigo = (await pc.evaluate(() =>
    ((document.getElementById('panel-cod') || {}).textContent || '').trim()));
  if (!/^[A-Z0-9]{4,8}$/.test(codigo)) {
    throw new Error('el panel no tiene código de sala legible: ' + JSON.stringify(codigo));
  }
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

  /* Pero SIN MÓVIL tiene que decirlo igual, y ahí estaba el agujero. El aviso
     vive en el pie, y `body.en-modulo #footer { display:none }` lo esconde
     dentro de un test. En el camino PC-sin-móvil —el que el panel de control
     abrió—, dentro de un módulo y con el panel cerrado, nada lo decía: arrastrar
     la ventana al proyector dejaba toda la geometría mal en silencio, y una
     medida mal tomada que nadie nota es el peor fallo de este sistema.

     Lo que se exige: algo VISIBLE en la pantalla del PC que lo diga, sin abrir
     el panel, y FUERA de la cartilla — el estímulo no se toca. */
  const sinAbrirNada = await pc.evaluate(() => {
    const V = { visibilityProperty: true, opacityProperty: true };
    const area = document.getElementById('modulo-area');
    const lineas = document.getElementById('lines-container');
    const panel = document.getElementById('panel-pc');
    const dice = [];
    for (const e of document.querySelectorAll('body *')) {
      if (!e.childElementCount && /recalibr|otra pantalla|cambi[óo] la pantalla/i
            .test(e.textContent || '') && e.checkVisibility(V)) {
        dice.push({ q: e.id || e.className || e.tagName,
                    enCartilla: !!(area && area.contains(e)) || !!(lineas && lineas.contains(e)),
                    enPanel: !!(panel && panel.contains(e)),
                    txt: (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40) });
      }
    }
    return dice;
  });
  const fuera = sinAbrirNada.filter(x => !x.enPanel && !x.enCartilla);
  const enCartilla = sinAbrirNada.filter(x => x.enCartilla);
  m.comprobar('y sin móvil lo dice la propia pantalla, sin abrir el panel y fuera de la cartilla',
    fuera.length > 0 && enCartilla.length === 0,
    enCartilla.length ? 'lo escribe SOBRE la cartilla: ' + enCartilla[0].q
      : fuera.length ? '«' + fuera[0].txt + '» en ' + fuera[0].q
      : 'nadie lo dice: la medida es de otra pantalla y el estímulo parece medido');

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
