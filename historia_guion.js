/* =====================================================================
   COLISEO · MODO HISTORIA · GUION
   Lo escribe Manu (toque humorístico). Cada línea es { q: quién habla, t: texto }.
   Personajes: 'rey' (el rey de Prota), 'prota', 'narrador', 'rival' (otro rey), 'subastador'.
   Las líneas que empiezan con "[MANU:" son lugares vacíos que faltan escribir:
   el juego las muestra igual, para que se vea dónde van.
   ===================================================================== */
window.GUION = {
  personajes: {
    rey:        { nombre: 'Rey Naldo',   color: '#c8a640', tono: 120 },
    prota:      { nombre: 'Prota',       color: '#b8a080', tono: 300 },
    rival:      { nombre: 'Otro rey',    color: '#7a8ab0', tono: 160 },
    subastador: { nombre: 'Subastador',  color: '#a06040', tono: 220 },
    narrador:   { nombre: '',            color: '#d9c4a3', tono: 0 },
    diablo:     { nombre: 'El Diablo',   color: '#a8221a', tono: 70 },
    caligula:   { nombre: 'Calígula',    color: '#5a6ab0', tono: 170 },
    augusto:    { nombre: 'Augusto',     color: '#4a8a4a', tono: 140 },
  },

  // Escena 1: la subasta de la intro (texto de Merlin). Antes de esto la cinemática muestra el lugar sin diálogo.
  intro: [
    { q: 'caligula', t: '¡3 monedas de oro!' },
    { q: 'augusto', t: '5.' },
    { q: 'rey', t: '15 monedas de oro.' },
    { q: 'caligula', t: '20 monedas.' },
    { q: 'augusto', t: '22.' },
    { q: 'prota', t: 'Sube a 30 y ellos se plantarán ahí.' },
    { q: 'rey', t: 'Calla, esclavo, o te haré cortar la lengua.' },
    { q: 'prota', t: 'Mi señor, por esos goblins puede obtener fácilmente el doble de su dinero si los vende.' },
    { q: 'rey', t: 'Ya gasté mucho en ese humano lastimado. El oro no crece en los árboles.' },
    { q: 'prota', t: 'Me han comprado y vendido tantas veces que ya ni recuerdo cuántas fueron, y he visto cómo venden a muchos esclavos a lo largo de mi trágica vida. Si no recupera su dinero, córteme las manos.' },
    { q: 'rey', t: 'Tu cabeza es lo que rodará si me haces perder un solo peso.' },
    { q: 'rey', t: '¡30 monedas!' },
    { q: 'subastador', t: '…' },
    { q: 'subastador', t: '¡Vendido al rey Naldo!' },
  ],
  // más tarde, en la escudería
  intro_escuderia: [
    { q: 'narrador', t: 'El rey le hace caso y termina triplicando su dinero.' },
    { q: 'rey', t: '86 monedas de oro por esos mugrientos goblins. Se ve que sabes de lo que hablas. De ahora en más serás mi asesor y, quién sabe, si me eres de ayuda hasta podrías tener una vida decente.' },
    { q: 'narrador', t: 'Prota empieza su carrera como asesor del rey, comprando en las subastas, vendiendo esclavos y ocupándose de las escuderías. Un gran salto de calidad en su vida: ahora tiene que demostrar su valor.' },
  ],

  rey_dinero: [
    { q: 'rey', t: '[MANU: el rey le da 120 monedas de oro a Prota para su primera subasta]' },
  ],

  tutorial_pregunta: { q: 'rey', t: '[MANU: el rey le pregunta a Prota si quiere que le enseñen cómo funciona todo (tutorial)]' },
  tutorial_subasta: [
    { q: 'rey', t: '[MANU: antes de la subasta de práctica]' },
  ],
  tutorial_pelea: [
    { q: 'rey', t: '[MANU: antes de la pelea de práctica]' },
  ],
  tutorial_fin: [
    { q: 'rey', t: '[MANU: al terminar el tutorial; el rey vende los esclavos de práctica y Prota queda con 120 monedas y la escudería vacía]' },
  ],

  // en la escudería, la primera vez
  escuderia: [
    { q: 'rey', t: '[MANU: el rey le muestra la escudería y el mapa a Prota]' },
  ],

  // sin plata ni esclavos: el rey presta una vez más (texto de Manu)
  prestamo: [
    { q: 'rey', t: '[MANU: el rey se enoja porque Prota se quedó sin nada]' },
    { q: 'rey', t: 'Tomá otras 120 monedas. Eso sí: estas son las últimas monedas que te doy.' },
  ],
  // la segunda vez: se pierde y hay que empezar el modo historia de nuevo
  derrota: [
    { q: 'rey', t: '[MANU: el rey pierde la paciencia con Prota: fin de la historia]' },
  ],

  // Coliseos de historia: los terrenos de un rey que ya no está; el que gana los coliseos se los queda
  cdh: {
    1:  { antes: [{ q: 'rey', t: '[MANU: Coliseo de historia 1 — antes]' }],  despues: [{ q: 'rey', t: '[MANU: Coliseo de historia 1 — después (se desbloquean las mazmorras)]' }] },
    2:  { antes: [{ q: 'rey', t: '[MANU: Coliseo de historia 2 — antes]' }],  despues: [{ q: 'rey', t: '[MANU: Coliseo de historia 2 — después]' }] },
    3:  { antes: [{ q: 'rey', t: '[MANU: Coliseo de historia 3 — antes]' }],  despues: [{ q: 'rey', t: '[MANU: Coliseo de historia 3 — después (se desbloquea el laboratorio)]' }] },
    4:  { antes: [{ q: 'rey', t: '[MANU: Coliseo de historia 4 — antes]' }],  despues: [{ q: 'rey', t: '[MANU: Coliseo de historia 4 — después]' }] },
    5:  { antes: [{ q: 'rey', t: '[MANU: Coliseo de historia 5 — antes]' }],  despues: [{ q: 'rey', t: '[MANU: Coliseo de historia 5 — después]' }] },
    6:  { antes: [{ q: 'rey', t: '[MANU: Coliseo de historia 6 — antes]' }],  despues: [{ q: 'rey', t: '[MANU: Coliseo de historia 6 — después]' }] },
    7:  { antes: [{ q: 'rey', t: '[MANU: Coliseo de historia 7 — antes]' }],  despues: [{ q: 'rey', t: '[MANU: Coliseo de historia 7 — después]' }] },
    8:  { antes: [{ q: 'rey', t: '[MANU: Coliseo de historia 8 — antes]' }],  despues: [{ q: 'rey', t: '[MANU: Coliseo de historia 8 — después]' }] },
    9:  { antes: [{ q: 'rey', t: '[MANU: Coliseo de historia 9 — antes]' }],  despues: [{ q: 'rey', t: '[MANU: Coliseo de historia 9 — después]' }] },
    10: { antes: [{ q: 'rey', t: '[MANU: Coliseo de historia 10, la pelea final — antes]' }], despues: [{ q: 'rey', t: '[MANU: Prota gana su libertad para crear su propio reino]' }] },
  },
  // si pierde un coliseo de historia (puede volver a intentarlo)
  cdh_perdido: [
    { q: 'rey', t: '[MANU: el rey reta a Prota por perder un coliseo de historia]' },
  ],
  /* ===================================================================
     BORRADOR (Claude) — MANU CORRIGE. Naldo, el rey que puso a Prota de
     asesor, aparece al costado de la pantalla dando consejos y opinando.
     Cada lista de "variantes" se elige una al azar.
     =================================================================== */
  naldo: {
    // la primera vez que abrís el mapa (se dicen todas, en orden)
    mapa: [
      'Este es el mapa del reino, Prota. Con las flechitas vas pasando de un lugar a otro.',
      'Cada cosa que hacés te come un día entero. Vender esclavos, curarlos o comprarles equipo no: eso lo hacés tranquilo en la escudería.',
      'Nunca hay más de 6 lugares abiertos. Los eventos y las subastas especiales duran 3 días: si te dormís, se van.',
      'Y el coliseo de historia está siempre ahí. Andá cuando estés listo… pero no me hagas quedar mal.',
    ],
    // la primera vez que aparece cada tipo de lugar
    tipos: {
      subasta: ['¿Ves la balanza? Subasta. Fijate la dificultad: si los otros reyes traen el doble de plata que vos, no vas a ganar ni un goblin rengo.', 'Y mirá los porcentajes de tier antes de ir. Una subasta usada no vuelve: cada coliseo de historia que ganes trae dos nuevas.'],
      especial: ['Una subasta especial, Prota. Esas no se consiguen así nomás: te las ganaste en la arena. Duran 3 días, no la dejes pudrir.'],
      evento: ['Algo pasa en el pueblo. Puede ser una fiesta… o una peste. Igual que mi matrimonio. Solo podés meterte en 2 de estos entre coliseo y coliseo.'],
      cde: ['Coliseo de entretenimiento. Ahí pelean los mismos reyes que ves en las subastas, pero ojo: ya tienen gladiadores de antes, no solo los que te ganaron.'],
      pdc: ['Pelea de campeones: cada rey manda a uno solo a la torre y nadie se rinde. Son diez en todo el camino, y cada una es más brava que la anterior.'],
      mazmorra: ['Se abrió una mazmorra. Tres oleadas y al fondo, un monstruo. Si perdés, no te devuelven ni las sandalias: se mueren todos los que mandaste.', 'Pero si ganás… al bicho lo podés esclavizar. Un monstruo inmortal en mi escudería. Ay, Prota, se me hace agua la boca.'],
    },
    // la primera vez que entrás a un coliseo de historia: hay que pasar sí o sí por Naldo (se dicen todas)
    cdh_primera: [
      'Prota. Pará. Antes de entrar, escuchame bien.',
      'Esto no es una subastita de pueblo. Esta vez va en serio: los reyes de las otras ciudades vienen con ocho gladiadores cada uno.',
      'Y el que te anotó a vos soy yo. Estoy poniendo mi cara. Mi cara, Prota. Esta cara.',
      'Así que no la cagues.',
    ],
    // las siguientes veces (variantes)
    cdh_antes: [
      'Otra vez pongo mi cara por vos. Cuidámela, que es la única que tengo.',
      'Los otros reyes ya te conocen, Prota. Eso es bueno… o muy malo.',
      'Si ganás, te invito un vino. Si perdés, te invito al calabozo.',
      'Acordate: ocho gladiadores por rey. Contá los tuyos antes de entrar.',
    ],
    subasta: {
      nada: ['¿Fuiste a la subasta a mirar? Para mirar está el teatro, Prota.', 'Volviste con las manos vacías. Bueno, por lo menos no gastaste.'],
      barato: ['¡Eso es comprar! Barato y bueno, como a mí me gusta.', 'Mirá vos, casi regalado. Ya te estoy queriendo un poquito.'],
      caro: ['Te gastaste casi todo, Prota. Espero que esos esclavos vengan con oro adentro.', '¿Tanto? Con esa plata me compraba un palacio. Uno chiquito, pero palacio.'],
      normal: ['Compra decente. Ni para aplaudirte ni para colgarte.', 'Bien ahí. Ahora a ver si pelean tan bien como costaron.'],
    },
    pelea: {
      gano_sin_bajas: ['¡Ni un rasguño! Bueno, rasguños sí. Pero muertos ninguno. Así se hace.', 'Impecable, Prota. El público pedía sangre y le diste la de los otros.'],
      gano_con_bajas: ['Ganamos, que es lo que importa. A los caídos los vamos a extrañar… un ratito.', 'Victoria con funeral incluido. Igual cuenta.'],
      perdio: ['Perdimos. No pasa nada. Bueno, sí pasa, pero no lo digas en voz alta.', 'Eso fue feo, Prota. La próxima convocá a los que tienen las dos piernas.'],
      perdio_todo: ['¿Y la escudería? ¿Dónde está la escudería, Prota? ¡Estaba acá!', 'No te quedó ni uno. Andá a una subasta antes de que me arrepienta de haberte comprado.'],
    },
    especial: ['¡Te ganaste algo, Prota! Por {por}, se abrió la «{nombre}». Dura 3 días.', 'Eso del galardón no pasó desapercibido: la «{nombre}» te espera en el mapa. Tenés 3 días.'],
    sin_lugar: ['Te ganaste la «{nombre}»… pero tenés el mapa lleno y se la llevó otro. Ordená esa agenda, Prota.'],
    vencio: ['Se te pasó: {lugar}. Ya fue. Así es la vida, y así es mi paciencia.', 'Chau {lugar}: se venció. Por dormilón.'],
    mazmorra: {
      antes: ['Una mazmorra. Huele a muerte y a queso viejo. Nadie se rinde ahí abajo, Prota: o salís ganando o no salís.', 'Bajá con lo mejor que tengas. Allá abajo no hay piedad ni baños.'],
      oleada: ['Una menos. ¿Seguís o volvemos otro día? No te voy a juzgar. Bueno, un poquito sí.', 'Bien. Pero lo de abajo es peor. Siempre es peor.'],
      jefe: ['Ahí está, Prota. El bicho. Si ganás, es nuestro. Si perdés, vos sos de él.', 'Lo escuchás respirar, ¿no? Yo tampoco quiero entrar. Por eso vas vos.'],
      gano: ['¡Lo bajaste! ¿Lo encadenamos o lo vendemos por kilo? Decidí rápido que se despierta.', '¡Increíble, Prota! Ahora la pregunta: ¿mascota o billetera?'],
      perdio: ['Se los comió a todos. A todos, Prota. Hasta al que estaba escondido atrás.', 'De esa mazmorra no volvió nadie. Bueno, vos sí, porque mirabas desde arriba.'],
    },
    monstruo_tirado: ['Tu monstruo está tirado. No se muere, pero tampoco pelea. Dale de comer… esclavos. Sí, así funciona.'],
  },

  /* ===================================================================
     EVENTOS DEL PUEBLO · BORRADOR (Claude) — MANU CORRIGE
     El efecto de cada uno está en ui.js (EVENTOS_FX); acá van los textos.
     =================================================================== */
  eventos: {
    fiesta: { titulo: 'Fiesta en el palacio', lineas: [{ q: 'narrador', t: 'Naldo cumple años (otra vez) y está de buen humor.' }, { q: 'rey', t: 'Tomá, Prota, comprate algo lindo. Algo que pelee, digo.' }] },
    apuestas: { titulo: 'Apuestas clandestinas', lineas: [{ q: 'narrador', t: 'En un sótano, unos tipos apuestan a carreras de cucarachas.' }], opciones: ['Apostar 20 oro', 'Ni loco'] },
    esqueletos: { titulo: 'El vendedor de huesos', lineas: [{ q: 'narrador', t: 'Un nigromante con olor a tierra mojada vende un esqueleto «casi nuevo».' }], opciones: ['Comprarlo por 40 oro', 'No, gracias'] },
    luna: { titulo: 'Luna llena', lineas: [{ q: 'narrador', t: 'Un tipo peludo toca la puerta de la escudería y pide trabajo. Tiene los dientes muy largos.' }], opciones: ['Que se quede', 'Echarlo'] },
    peste: { titulo: 'Peste en los establos', lineas: [{ q: 'narrador', t: 'Algo comieron los esclavos. Todos. Nadie quiere decir qué.' }] },
    fuga: { titulo: 'Fuga', lineas: [{ q: 'narrador', t: 'Alguien dejó la reja abierta. Alguien se fue por la reja.' }] },
    herrero: { titulo: 'El herrero borracho', lineas: [{ q: 'narrador', t: 'El herrero del pueblo perdió una apuesta y paga con su trabajo.' }] },
    entrenador: { titulo: 'Un veterano de las legiones', lineas: [{ q: 'narrador', t: 'Un viejo legionario se ofrece a entrenar a tus esclavos a cambio de un plato de lentejas.' }] },
    ladrones: { titulo: 'Ladrones', lineas: [{ q: 'narrador', t: 'Te despertás y la bolsa pesa menos. Mucho menos.' }] },
    cementerio: { titulo: 'Ruido en el cementerio', lineas: [{ q: 'narrador', t: 'Algo rasca la tierra desde abajo. Y tiene hambre.' }] },
    curandera: { titulo: 'La curandera', lineas: [{ q: 'narrador', t: 'Una señora con muchos frasquitos pasa por la escudería y no cobra nada. Sospechoso, pero funciona.' }] },
    desafio: { titulo: 'Desafío callejero', lineas: [{ q: 'narrador', t: 'Un matón del pueblo desafía a tu mejor esclavo. A muerte. Por 40 de oro.' }], opciones: ['Aceptar', 'No'] },
    recluta: { titulo: 'Un voluntario', lineas: [{ q: 'narrador', t: 'Un goblin chiquito dice que quiere ser gladiador. Nadie le preguntó.' }] },
  },
};

/* ===================================================================
   MÁS FRASES DE NALDO · BORRADOR (Claude) — MANU CORRIGE
   Se suman a las de arriba; cada vez se elige una al azar.
   "azar": lo que dice de vez en cuando al volver al mapa.
   =================================================================== */
(function (N) {
  const mas = (lista, ...frases) => lista.push(...frases);
  mas(N.cdh_antes,
    'Hoy vienen mis primos a mirar. Si perdés, decí que fue idea tuya.',
    'Me jugué la corona a que ganás. Bueno, una corona. Tengo varias.',
    'Respirá hondo, Prota. Yo no puedo, me aprieta la toga.',
    'Los otros reyes trajeron banderas. Yo traje fe. Y un plan B que no te voy a contar.',
    'Si ganás, te dejo elegir el postre del banquete. Si perdés, sos el postre.',
    'Ojo con el de la izquierda. No sé cuál es, pero siempre hay uno de la izquierda.',
    'El pueblo está mirando. El pueblo no perdona. El pueblo tampoco paga la entrada, pero bueno.',
    'Ganá esta y te nombro asesor del año. Sos el único asesor, pero suena lindo.',
    'Mi madre me dijo que no confiara en vos. Demostrale que se equivoca. Por una vez.',
    'Entrá, pelealo y salí. Como en el baño del palacio: sin mirar a nadie a los ojos.');
  mas(N.subasta.nada,
    'Ni un goblin, Prota. Ni un goblin. Y eso que los regalan con la entrada.',
    '¿Estabas esperando que bajen los precios? Acá los precios solo suben, como mis impuestos.',
    'Volviste con la bolsa llena y el establo vacío. Es al revés, Prota.',
    'La próxima ofertá algo. Aunque sea por lástima.');
  mas(N.subasta.barato,
    'Ese precio fue un robo. Y a mí me encantan los robos cuando los hago yo.',
    'Barato, barato. Ojalá no se te muera en la primera, que ahí sale caro.',
    'El vendedor lloraba cuando te fuiste. Eso es buena señal.',
    'Con lo que ahorraste me compro un sombrero. No te pregunté.');
  mas(N.subasta.caro,
    'Pagaste eso por ESO. Espero que sepa bailar, por lo menos.',
    'La plata no hace la felicidad, Prota. Pero tampoco la gastes toda en un orco.',
    'El tesorero se desmayó. Literal. Lo tuvieron que abanicar.',
    'Caro, caro. Cuando gane algo lo vamos a enmarcar.');
  mas(N.subasta.normal,
    'Ni bien ni mal. Como mi casamiento.',
    'Una compra correcta. Aburrida, pero correcta.',
    'Bien. Ahora dales de comer, que flacos no pegan.',
    'Me gusta. No mucho, pero me gusta.');
  mas(N.pelea.gano_sin_bajas,
    '¡Todos vivos! Voy a tener que pagar más comida, pero no importa.',
    'Ni una baja. El público pedía sangre y le diste un show de magia.',
    'Así se gana, Prota: limpio, rápido y sin funerales.',
    '¡Victoria perfecta! Mañana te lo voy a echar en cara a los otros reyes.',
    'Salieron caminando todos. Algunos medio torcidos, pero caminando.');
  mas(N.pelea.gano_con_bajas,
    'Ganamos. Los que se fueron, se fueron peleando. Que es la mejor manera de irse.',
    'Victoria con olor a velorio. Igual brindamos.',
    'Perdimos gente pero ganamos la pelea. Eso en mi familia se llama domingo.',
    'Bien, Prota. A los caídos les vamos a poner una placa. Chiquita.',
    'Ganamos, aunque el establo quedó con eco.');
  mas(N.pelea.perdio,
    'Perdimos. Yo no dije nada. Bueno, ahora sí.',
    'Hay días que no se gana. Hoy fue uno de esos días. Ayer también, pero no lo viste.',
    '¿Viste cómo nos miraban los otros reyes? Yo sí. Me dolió.',
    'Eso no fue una pelea, fue una clase. Y nosotros éramos el pizarrón.',
    'Perder también enseña. Lo que enseña es que hay que ganar.');
  mas(N.pelea.perdio_todo,
    'No quedó nadie, Prota. Ni el que barría la arena.',
    'Escudería vacía. Tengo más gente en mi baño.',
    'Bueno… empezamos de nuevo. Como cuando se me quemó el palacio.',
    'Todos. Se murieron todos. Voy a tener que escribir muchas cartas.');
  mas(N.especial,
    '¡Se habla de vos en el pueblo, Prota! Por {por} te abrieron la «{nombre}». Andá antes de que se enfríe.',
    'Me llegó una carta perfumada: la «{nombre}» quiere verte. Es por {por}. Tenés 3 días.',
    'La «{nombre}» te espera. No te la ganaste por lindo, te la ganaste por {por}.');
  mas(N.vencio,
    '{lugar}: se fue. Como mi pelo.',
    'Esperaste tanto que {lugar} se cansó y se fue.',
    'Adiós, {lugar}. Nadie te va a extrañar más que yo. Y no te extraño.',
    'Se venció {lugar}. Las oportunidades son como los quesos, Prota: tienen fecha.');
  mas(N.sin_lugar,
    'Te ganaste la «{nombre}», pero no entraba en el mapa. Hacé lugar, Prota, que esto no es un ropero.',
    'La «{nombre}» vino, vio el mapa lleno y se volvió. Ordená la agenda.');
  mas(N.mazmorra.antes,
    'Abajo no hay público, Prota. Nadie va a aplaudir. Ni a ayudar.',
    'Dicen que el que baja vuelve distinto. Yo digo que el que baja casi nunca vuelve.',
    'Llevate antorcha. Y gladiadores. Sobre todo gladiadores.');
  mas(N.mazmorra.oleada,
    'Esa oleada fue el aperitivo. El plato principal tiene dientes.',
    'Bien ahí. Contá cuántos te quedan. Ahora contá de nuevo, por las dudas.',
    'Seguir o volver, Prota. Yo, en tu lugar, estaría en mi palacio. Ah, estoy.');
  mas(N.mazmorra.jefe,
    'Es grande. Más grande de lo que me dijeron. Me dijeron poco.',
    'Si sobrevivís a esto, te dejo usar mi silla. Una vez. Sin sentarte.',
    'Ahí está el dueño de la casa. Saludalo con todo lo que tengas.');
  mas(N.mazmorra.gano,
    '¡Lo tumbaste! Esto lo van a cantar los bardos. Mal, pero lo van a cantar.',
    'Ganamos, Prota. ¿Lo sumamos a la familia o lo convertimos en monedas?',
    'Increíble. Yo no apostaba ni un higo por vos.');
  mas(N.mazmorra.perdio,
    'Abajo se quedaron todos. Bueno, ahora tienen vivienda.',
    'El monstruo cenó bien hoy. Nosotros no.',
    'No volvió nadie, Prota. La próxima bajá con más gente. O con un plan.');
  N.azar = [
    'Cuando yo era joven peleaba en la arena. Bueno, miraba. Desde lejos. Con almohadón.',
    '¿Sabías que los gigantes roncan? Yo tampoco hasta que me compré uno.',
    'Acordate: un goblin solo puede salir excepcional. Un goblin en grupo es una plaga.',
    'Si un esclavo tiene lesiones, el médico le baja la mitad. No es magia, es plata.',
    'Revisá a quién convocás. No me lleves a la arena al que tiene la pierna de palo nueva.',
    'Los eventos son como las suegras: a veces traen regalos, a veces traen problemas.',
    'Hoy amanecí con ganas de ganar algo. Andá y ganalo vos.',
    'Me contaron que en Krag-Tor los orcos desayunan piedras. No sé si es verdad, pero da miedo.',
    'Un rey sin gladiadores es como un pan sin miga. Puro cascarón.',
    'Ordená el establo, Prota. Ahora se puede filtrar y todo. Somos modernos.',
    'La plata que no gastás hoy, la gastás mañana en algo peor. Lo digo por experiencia.',
    'El esqueleto se vuelve a armar en cada pelea. Ojalá mis muebles hicieran lo mismo.',
    'Si ves una subasta difícil, pensalo dos veces. Si la ves muy difícil, pensalo tres.',
    '¿Te conté de mi abuelo? Murió en la arena. De risa, viendo a un goblin con lanza.',
    'Los monstruos no se curan solos, Prota. Comen esclavos. Es feo, pero es así.',
    'Hay reyes que entrenan a sus gladiadores. Yo prefiero que los entrenes vos.',
    'La gloria es linda, pero la plata paga la gloria.',
    'Tengo un buen presentimiento. También tenía uno con mi primera esposa.',
    'No te encariñes con los esclavos. Bueno, un poquito sí. Con el que pega fuerte.',
    'Un hombre lobo parece humano hasta que no. Como mi cuñado.',
    'Si un carro no te interesa, pasalo. El tiempo es oro, y el oro es mío.',
    'La pelea de campeones es de a uno. Mandá al mejor, no al más lindo.',
    'Hoy hace calor. Ideal para pelear. Para mirar, no tanto.',
    'Los ghouls se comen a los muertos para curarse. No los invites a cenar.',
    'Cuantos más coliseos ganes, mejores esclavos aparecen en las subastas. Así funciona el mundo.',
    'Ya me aprendí el nombre de todos tus gladiadores. Mentira. De dos.',
    'Si te quedás sin esclavos y sin plata, te ayudo una vez. Una sola. Anotalo.',
    'El pueblo ya canta tu nombre. Lo canta mal, pero lo canta.',
    'Yo no te digo qué hacer. Te sugiero, con mucha fuerza, desde un trono.',
    'Mirá bien los porcentajes de tier antes de ir a una subasta. Los números no mienten. Yo sí.',
    'Algún día vas a ser libre, Prota. Hasta ese día, sos mío. Con cariño.',
  ];
})(window.GUION.naldo);


/* ===================================================================
   CINEMÁTICA ANTES DEL COLISEO DE HISTORIA 10 (texto de Merlin)
   {dias} = los días que pasaron en la campaña
   =================================================================== */
window.GUION.cdh10_final = [
  { q: 'rey', t: 'Maldita sea Prota, pensar que hace solo {dias} te compré con puros fines sexuales y homoeróticos...' },
  { q: 'prota', t: 'Espera que??' },
  { q: 'rey', t: '... y ahora cuando te veo solo siento respeto. No cualquiera daría el salto de fe que tu diste, mi pregunta es por qué? Podrías haber vivido en el palacio junto con las esclavas mujeres, teniendo sexo con ellas para mi entretenimiento...' },
  { q: 'prota', t: 'Nunca me lo propusiste!! Es la primera vez que lo nombras!!' },
  { q: 'rey', t: '... pero decidiste arriesgar tu vida siendo mi ascesor, solo para conseguirme mas poder y hacerme ganar mas dinero del que puedo gastar...' },
  { q: 'prota', t: 'Todavia es una opción lo de las esclavas??' },
  { q: 'rey', t: '... y cuando creía que ya tenia todo lo anhelable por un hombre, me diste algo que el oro no puede comprar, una lección.' },
  { q: 'prota', t: 'Me alegro supongo...' },
  { q: 'rey', t: 'Tu, Prota, que llegaste un dia encadenado en una carreta, siempre hablaste con autoridad en tus palabras. Una autoridad que solo posee quien está seguro de si mismo y de sus habilidades, sin importarte a quien te dirijas.' },
  { q: 'rey', t: 'Una franqueza forjada en lo mas bajo de la cadena alimenticia, en un mar donde los megalodones devoran de un bocado las esperanzas de los que nada tienen que perder, mas que su aliento.' },
  { q: 'rey', t: 'Sin miedo a morir. Sin miedo a nada. Es una libertad que yo nunca podré saborear, y tu, eres el hombre mas libre que conozco' },
  { q: 'prota', t: 'Su majestad, agradezco el reconocimiento pero no comprendo a que viene el discurso justo antes de pelear por sus nuevas tierras' },
  { q: 'rey', t: 'Es que no pelearan por mis nuevas tierras, pelearas por TUS nuevas tierras...' },
  { q: 'prota', t: '...' },
  { q: 'rey', t: '... te ofrezco tu libertad Prota... gana este coliseo y ya no seré tu rey. Seré tu aliado, y juntos nuestros reinos crecerán mas lejos de lo que cualquier terreno puede abarcar' },
];

/* ===================================================================
   EL DIABLO · BORRADOR (Claude) — MANU CORRIGE
   =================================================================== */
window.GUION.diablo = {
  aparece: [
    { q: 'narrador', t: 'Prota se sienta en el trono. Está tibio. Demasiado tibio.' },
    { q: 'diablo', t: '¿Un esclavo… sentado en un trono? Esto es una ofensa. Una ofensa a MÍ.' },
    { q: 'rey', t: '¿Y usted quién es? No figura en la lista de invitados.' },
    { q: 'diablo', t: 'Soy el que se queda con todo lo que ustedes pierden en la arena.' },
    { q: 'diablo', t: 'Los últimos veinticuatro que mataste, Prota. Los conocés a todos. Hoy vuelven.' },
    { q: 'rey', t: 'Prota… convocá a todos los que tengas. A TODOS. Hasta veinticuatro.' },
  ],
  entra: [
    { q: 'diablo', t: '¿Ganaste? Qué tierno.' },
    { q: 'diablo', t: 'Ahora bajo yo.' },
  ],
  gano: [
    { q: 'diablo', t: 'Esto… no… termina… acá…' },
    { q: 'rey', t: 'Sí que termina. Sentate, Prota. El trono es tuyo.' },
  ],
};
