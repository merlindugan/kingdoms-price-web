/* =====================================================================
   COLISEO · REGLAS Y TABLAS DE BALANCE
   Todo lo que se ajusta (probabilidades, costos, fórmulas) vive acá.
   Lo marcado con  // PROVISIONAL  NO está en el documento v0.1:
   es una decisión de prueba para que el prototipo funcione.
   ===================================================================== */
(function (root) {
const REGLAS = {

  /* ---------- Las 6 stats visibles (honor queda oculto) ---------- */
  STATS: [
    { key: 'fuerza',      label: 'Fuerza',      corto: 'FUE' },
    { key: 'velocidad',   label: 'Velocidad',   corto: 'VEL' },
    { key: 'resistencia', label: 'Resistencia', corto: 'RES' },
    { key: 'tecnica',     label: 'Técnica',     corto: 'TEC' },
    { key: 'frialdad',    label: 'Frialdad',    corto: 'FRI' },   // Voluntad + Frialdad fusionadas
    { key: 'percepcion',  label: 'Percepción',  corto: 'PER' },
  ],

  /* ---------- Razas (doc §5). tend = sesgo sobre la media del tier ---------- */
  RAZAS: {
    humano:  { label: 'Humano',  plural: 'Humanos',  altura: 1.75, peso: 78,  prob: 0.40, piel: '#d8a27a', aguante: 0,
               tend: { fuerza: 0,   velocidad: 0,   resistencia: 0,  tecnica: 2,  frialdad: 0,  percepcion: 0 } },
    orco:    { label: 'Orco',    plural: 'Orcos',    altura: 1.95, peso: 125, prob: 0.27, piel: '#7d9a5a', aguante: 0.05,
               tend: { fuerza: 9,   velocidad: -3,  resistencia: 5,  tecnica: -4, frialdad: 0,  percepcion: -3 } },
    gigante: { label: 'Gigante', plural: 'Gigantes', altura: 3.00, peso: 350, prob: 0.10, piel: '#b59a86', aguante: 0.12,
               tend: { fuerza: 18,  velocidad: -14, resistencia: 10, tecnica: -7, frialdad: 4,  percepcion: -6 } },
    goblin:  { label: 'Goblin',  plural: 'Goblins',  altura: 1.10, peso: 25,  prob: 0.23, piel: '#9cc34a', aguante: -0.10,
               tend: { fuerza: -15, velocidad: 10,  resistencia: -8, tecnica: 0,  frialdad: -8, percepcion: 6 } },
    // ---- razas especiales (decididas por Merlin): raras en los carros y por eventos ----
    // esqueleto: no sangra, no se cansa, no se rinde nunca y al morir puede rearmarse una vez
    esqueleto: { label: 'Esqueleto', plural: 'Esqueletos', altura: 1.80, peso: 32, prob: 0, especial: true, piel: '#e4dcc4', aguante: 0.02,
               tend: { fuerza: -3, velocidad: 0, resistencia: 4, tecnica: 2, frialdad: 18, percepcion: -4 },
               sinSangre: true, sinCansancio: true, noSeRinde: true, rearma: 1 },          // siempre se rearma, una vez por pelea (decidido por Merlin)
    // ghoul (decidido por Merlin): un humano, más rápido y fuerte; nunca perdona; prioriza comerse los cadáveres
    // (radio de visión = un cuarto del coliseo); tarda 5 s y mientras come recibe críticos; se cura 10% + 10% por tier
    ghoul:   { label: 'Ghoul', plural: 'Ghouls', altura: 1.76, peso: 72, prob: 0, especial: true, piel: '#a8b09a', aguante: 0.03,
               tend: { fuerza: 8, velocidad: 8, resistencia: 2, tecnica: -2, frialdad: 4, percepcion: 4 },
               nuncaPerdona: true, come: { dur: 5, cura: { D: 0.1, C: 0.2, B: 0.3, A: 0.4, S: 0.5 } } },
    // hombre lobo: parece humano (solo su dueño lo sabe); a mitad de pelea se transforma:
    // pelea con garras (sin armas ni escudo), es muy rápido y agresivo y regenera vida
    lobo:    { label: 'Hombre lobo', plural: 'Hombres lobo', disfraz: 'humano', altura: 1.80, peso: 84, prob: 0, especial: true, piel: '#d2a07a', pelaje: '#6e655b', aguante: 0.04,
               tend: { fuerza: -4, velocidad: 10, resistencia: 0, tecnica: -6, frialdad: -10, percepcion: 4 },
               transforma: { desde: 30, hasta: 60, danio: 35, crece: 1.1, regen: 0.25, boost: 0.05, cura: 0, aire: 20 } },   // segundos / daño que lo dispara, regen por seg  // PROVISIONAL
  },

  /* ---------- Tiers (doc §6: probabilidades sugeridas) ---------- */
  TIERS: {
    D: { prob: 0.35, media: 32, dispersion: 9 },   // media/dispersion: PROVISIONAL
    C: { prob: 0.30, media: 44, dispersion: 9 },
    B: { prob: 0.20, media: 55, dispersion: 8 },
    A: { prob: 0.11, media: 66, dispersion: 8 },
    S: { prob: 0.04, media: 78, dispersion: 7 },
  },
  TIER_ORDEN: ['D', 'C', 'B', 'A', 'S'],

  /* ---------- Tendencias de lotes (doc §5). Pesos de tamaño 1..4 por raza: PROVISIONAL ---------- */
  LOTES: {
    tamanio: {
      humano:  [0.40, 0.30, 0.20, 0.10],
      orco:    [0.40, 0.30, 0.20, 0.10],
      gigante: [0.80, 0.17, 0.03, 0.00],
      goblin:  [0.12, 0.18, 0.30, 0.40],
    },
    mezclaRazas: 0.05,          // "casi nunca mezclan razas"
    goblinSoloTierBonus: 2,     // un goblin solo puede ser excepcional: tira el tier 2 veces y se queda con el mejor  // PROVISIONAL
  },

  /* ---------- Estilos de combate (doc §10B) = plantillas de CONDUCTA (como LE&B) ----------
     rango: distancia buscada como fracción del alcance del arma (1 = óptima, >1 = más lejos)
     ritmo: frecuencia de ataque · agresividad: busca pelea / remata al cansado
     guardia: preferencia por bloquear (vs esquivar) · combo: encadenar ataques
     pesado: % de golpes cargados (crítico) · cuerpo: % al cuerpo · contra: busca contragolpe
     agarre: intenta derribar/trabar de cerca
     afinidad: qué stats empujan a que un gladiador tenga este estilo al generarse  // PROVISIONAL */
  ESTILOS: {
    agresivo:       { label: 'Agresivo',       desc: 'Va siempre hacia adelante, mucho volumen, castiga al que se cansa.',
                      rango: 0.85, ritmo: 0.85, agresividad: 0.9, guardia: 0.35, combo: 0.55, pesado: 0.14, cuerpo: 0.45, contra: 0.2, agarre: 0.05,
                      afinidad: { fuerza: 1, resistencia: 0.6 } },
    defensivo:      { label: 'Defensivo',      desc: 'Se cierra, bloquea casi todo y responde cuando el rival se vacía.',
                      rango: 1.0,  ritmo: 0.45, agresividad: 0.35, guardia: 0.9, combo: 0.3, pesado: 0.06, cuerpo: 0.3, contra: 0.45, agarre: 0.05,
                      afinidad: { resistencia: 1, tecnica: 0.8 } },
    contraatacador: { label: 'Contraatacador', desc: 'Espera, esquiva y castiga cada error del rival.',
                      rango: 1.12, ritmo: 0.4,  agresividad: 0.25, guardia: 0.3, combo: 0.3, pesado: 0.16, cuerpo: 0.25, contra: 0.95, agarre: 0.0,
                      afinidad: { tecnica: 1, percepcion: 1 } },
    agarres:        { label: 'Agarres',        desc: 'Cierra la distancia, traba y derriba para pegar con ventaja.',
                      rango: 0.55, ritmo: 0.6,  agresividad: 0.75, guardia: 0.5, combo: 0.4, pesado: 0.08, cuerpo: 0.6, contra: 0.3, agarre: 0.55,
                      afinidad: { fuerza: 0.8, resistencia: 0.6, tecnica: 0.4 } },
    distancia:      { label: 'Distancia',      desc: 'Pelea desde afuera, retrocede y castiga al que entra.',
                      rango: 1.3,  ritmo: 0.65, agresividad: 0.3, guardia: 0.45, combo: 0.25, pesado: 0.05, cuerpo: 0.2, contra: 0.5, agarre: 0.0, kite: true,
                      afinidad: { velocidad: 1, percepcion: 0.7 } },
  },

  /* ---------- Armería (doc §12): cada arma es un "golpe" de LE&B con contrapartidas ----------
     opt/min/max: distancias en metros para un humano (se escalan con la altura)
     dmg: daño base · coste: cardio por ataque · carga/recup: segundos
     guardMod: <1 = más difícil de bloquear · rompe: desgaste extra de guardia/escudo
     critMul: multiplicador del golpe cargado · manos: 2 = no permite escudo
     PRECIOS en oro (solo hay oro, decidido por Merlin): PROVISIONALES (los fijos todavía no están en el documento) */
  ARMAS: {
    gladius:  { label: 'Gladius',        opt: 1.05, min: 0.45, max: 1.45, dmg: 7.0,  coste: 1.6, carga: 0.24, recup: 0.34, guardMod: 1.0,  rompe: 1.0, critMul: 2.6, manos: 1, precio: 8,
                desc: 'Equilibrada: ataca y defiende.' },
    lanza:    { label: 'Lanza',          opt: 2.05, min: 1.15, max: 2.6,  dmg: 7.5,  coste: 1.8, carga: 0.30, recup: 0.42, guardMod: 1.0,  rompe: 0.9, critMul: 2.6, manos: 1, precio: 7,
                desc: 'Controla la distancia; de cerca casi no sirve.', ventajaEntrada: true },
    martillo: { label: 'Martillo',       opt: 1.15, min: 0.55, max: 1.55, dmg: 15.0, coste: 3.8, carga: 0.62, recup: 0.78, guardMod: 0.8,  rompe: 2.2, critMul: 2.2, manos: 2, precio: 11,
                desc: 'Pega muy fuerte y rompe escudos, pero es lento.' },
    cestus:   { label: 'Cestus',         opt: 0.68, min: 0.25, max: 1.0,  dmg: 4.2,  coste: 0.8, carga: 0.15, recup: 0.22, guardMod: 1.0,  rompe: 0.7, critMul: 2.8, manos: 1, precio: 3, sinEscudo: true,
                desc: 'Puños armados: rapidísimo, ideal para trabar.' },
    daga:     { label: 'Daga',           opt: 0.75, min: 0.3,  max: 1.05, dmg: 5.0,  coste: 0.9, carga: 0.16, recup: 0.24, guardMod: 1.05, rompe: 0.7, critMul: 3.0, manos: 1, precio: 3,
                desc: 'Corta y rápida; busca huecos.' },
    // garras del hombre lobo transformado: no se compran
    garras:   { label: 'Garras',         opt: 0.8,  min: 0.3,  max: 1.15, dmg: 4.2,  coste: 0.6, carga: 0.16, recup: 0.26,  guardMod: 1.0,  rompe: 1.1, critMul: 2.8, manos: 2, precio: 0, sinEscudo: true, oculta: true,
                desc: 'Zarpazos rapidísimos.' },
    // si pierde el brazo del arma: pelea a las piñas con lo que le queda
    munon:    { label: 'A mano limpia', opt: 0.7, min: 0.25, max: 0.95, dmg: 2.2, coste: 0.5, carga: 0.16, recup: 0.24, guardMod: 1.0, rompe: 0.6, critMul: 1.8, manos: 1, precio: 0, oculta: true },
    garrote:  { label: 'Garrote',        opt: 1.2,  min: 0.6,  max: 1.6,  dmg: 12.0, coste: 3.0, carga: 0.5,  recup: 0.62, guardMod: 0.85, rompe: 1.8, critMul: 2.2, manos: 2, precio: 5,
                desc: 'Pesado y barato.' },
  },
  ESCUDOS: {
    ninguno: { label: 'Sin escudo',    bloqueo: 0.6,  desgaste: 1.6, fuga: 1.6, movilidad: 1.0,  cardio: 1.0,  precio: 0 },    // para con el arma
    chico:   { label: 'Escudo chico',  bloqueo: 0.92, desgaste: 1.1, fuga: 1.0, movilidad: 0.97, cardio: 1.03, precio: 4 },
    grande:  { label: 'Escudo grande', bloqueo: 1.15, desgaste: 0.7, fuga: 0.8, movilidad: 0.87, cardio: 1.12, precio: 9 },
  },
  ARMADURAS: {
    ninguna: { label: 'Sin armadura',     danio: 1.0,  movilidad: 1.0,  cardio: 1.0,  precio: 0 },
    ligera:  { label: 'Armadura ligera',  danio: 0.85, movilidad: 0.96, cardio: 1.05, precio: 6 },
    pesada:  { label: 'Armadura pesada',  danio: 0.68, movilidad: 0.82, cardio: 1.25, precio: 15 },
  },

  /* ---------- Rasgos ocultos (doc §10C) ---------- */
  RASGOS: {
    miedoMorir:  { label: 'Miedo a morir',       desc: 'Se rinde antes cuando está muy lastimado.', rendicion: +0.15 },
    sedSangre:   { label: 'Sed de sangre',       desc: 'Rara vez perdona a un caído.', remate: +0.35, agresividad: +0.1 },
    cobardia:    { label: 'Cobardía',            desc: 'Retrocede y se quiebra cuando lo rodean.', rendicion: +0.22, rodeado: +0.25 },
    dolor:       { label: 'Resistencia al dolor', desc: 'Aguanta más daño antes de quebrarse.', danio: 0.88, rendicion: -0.12 },
    ambicion:    { label: 'Ambición',            desc: 'Busca al rival más peligroso y no larga.', rendicion: -0.06, agresividad: +0.1 },
    lealtad:     { label: 'Lealtad',             desc: 'No se rinde mientras queden aliados en pie.', rendicionAliados: -0.25 },
  },
  RASGOS_PROB: [0.35, 0.45, 0.20],   // prob. de tener 0, 1 o 2 rasgos  // PROVISIONAL

  /* ---------- Combate (motor heredado de Live, Eat & Box) ---------- */
  COMBATE: {
    arenaRadio: 14,   // un poco más grande (pedido de Merlin)
    dt: 1 / 30,
    tiempoLimite: 240,            // segundos de pelea; al cumplirse gana quien tenga más en pie  // PROVISIONAL
    posPelea: 14,                 // segundos que tienen los vencedores para decidir sobre los caídos  // PROVISIONAL
    // daño por zona (LE&B: zoneScale). A 100 en una zona, el próximo golpe limpio incapacita.
    zona: { head: 1.3, body: 1.05 },
    incapacitaEn: 100,
    // muerte por golpe: si una zona supera esto, muere en el acto  // PROVISIONAL
    letal: { head: 165, body: 190 },
    // caída relámpago (LE&B FLASH): un crítico fuerte contra un aguante flojo incapacita aunque esté fresco
    flash: { base: 0.003, k: 0.18, danioK: 0.08, max: 0.14 },
    fragil: 0.10,                 // LE&B: cada vez que una zona llega a rojo, recibe 10% más
    guardia: { fugaMin: 0.01, desgaste: 0.0055 },   // LE&B GUARD
    cardio: { mover: 0.8, esquive: 0.5, ataque: 0.55, quieto: 1.6, fondo: 0.045, fondoPiso: 30, ahogoMul: 2 },  // LE&B CARDIO
    giro: 7,                      // rad/s de giro (los gigantes giran más lento)
    espalda: 1.95,                // radianes: un golpe desde más atrás de esto viene "por la espalda"
    agarre: { distancia: 0.9, derribo: 1.1, cd: 3.0 },
    anclaDesde: 25,               // desde este segundo el público empuja a los equipos hacia el centro  // PROVISIONAL
    anclaRitmo: 0.03,             // fracción por segundo
    // contra la pared (decidido por Merlin, plan "Control del espacio"): el que pelea pegado al muro y con el rival del lado del centro está acorralado
    acorralado: { borde: 1.5, esquive: 0.55 },   // metros desde el muro · multiplica la chance de esquivar  // PROVISIONAL
    espacio: { zona: 0.5, empuje: 2.5 },         // "Control del espacio": se planta en el centro, no sale a buscar al que no entra a su zona (fracción del radio) y sus golpes empujan x2,5 hacia el muro  // PROVISIONAL
    abucheoTras: 12,              // segundos sin golpes limpios: todos al frente  // PROVISIONAL
  },

  /* ---------- Rendición (doc §8–9). PROVISIONAL toda la fórmula ---------- */
  RENDICION: {
    umbralBase: 0.5,        // presión necesaria con frialdad 0
    frialdadK: 0.62,         // cuánto sube el umbral la frialdad
    porSegundo: 0.9,         // prob/s por cada punto de presión sobre el umbral
    // pesos de la presión
    danio: 0.55, cansancio: 0.25, rodeado: 0.18, equipoCaido: 0.25, golpesRecientes: 0.15,
  },

  /* ---------- Rematar o perdonar (doc §9). PROVISIONAL ---------- */
  REMATE: {
    base: 0.12,
    honorK: 0.4,            // honor bajo suma
    frialdadK: 0.25,         // frialdad alta suma
    combo: 0.2,              // honor bajo + frialdad alta: extra
    rendidoMul: 0.55,        // a un rendido se lo respeta más que a un incapacitado
    ordenVulnerables: 0.15,
    planAgresivo: 0.08,
    min: 0.03, max: 0.92,    // nunca garantizado
    tiempo: 0.9,             // segundos que tarda en rematar
  },

  /* ---------- Recompensas (doc §3, §15) ---------- */
  RECOMPENSAS: {
    oroGanador: 10, oroResto: 3,
    oroPueblo: 20,
    reparto: { muertes: 5, sangre: 5, danio: 5, vivos: 5 },   // el oro del pueblo: 5 por galardón (decidido por Merlin)
    empate: 'menosTiene',    // decidido por Merlin: si hay empate, se lo lleva el que menos dinero tiene
    puntosPelea: 3, puntosLogro: 1,
    puntosUltimaPelea: 6,    // la última pelea vale el doble (decidido por Merlin)
  },
  // Cuerpo (decidido por Merlin): fracturas, desangrado y miembros cortados CAMBIAN la pelea;
  // si sobrevive sin un miembro, el médico le pone una prótesis (garfio / pata de palo). Números PROVISIONALES
  CUERPO: {
    miembros: { bA: 'brazo del arma', bE: 'brazo del escudo', pA: 'pierna de adelante', pB: 'pierna de atrás' },
    pesos: { bA: 0.3, bE: 0.3, pA: 0.2, pB: 0.2 },              // a qué miembro va el golpe (cuando no va a cabeza/torso)
    probMiembro: 0.35,                                          // de los golpes limpios al cuerpo, cuántos agarran un miembro
    fractura: 0.05, corte: 0.06,                                // chances base (se escalan por arma, potencia y crítico)
    contundente: { martillo: 2.4, garrote: 2.0, cestus: 1.4, garras: 0.5, gladius: 0.5, daga: 0.3, lanza: 0.6 },
    filo: { gladius: 1.6, daga: 1.0, garras: 1.4, lanza: 0.5, martillo: 0.15, garrote: 0.1, cestus: 0 },
    sangradoCorte: 2.4, sangradoHerida: 0.25, coagula: 0.04,    // daño al cuerpo por segundo
    desangraEn: 150,                                            // si el daño al cuerpo llega acá, muere desangrado
    decapitarRemate: 0.35,
    desmembrarLetal: 0.25,                                      // el golpe que mata le corta lo que pegó (cabeza, brazo o pierna)                                      // en un remate con filo, chance de cortarle la cabeza
    // penalidades (a gravedad 100%) de las fracturas, y de las prótesis
    penFractura: { bA: { strength: -0.25, handSpeed: -0.3, accuracy: -0.2 }, bE: { guard: -0.4 }, pierna: { agility: -0.45, evasion: -0.35 } },
    penProtesis: { bA: { strength: -0.15, accuracy: -0.15, handSpeed: -0.1 }, bE: { guard: -0.2 }, pierna: { agility: -0.25, evasion: -0.2 } },
    ventaProtesis: 0.2,                                         // cada prótesis baja 20% el precio de venta
  },
  // Pelea de campeones (decidido por Merlin): casillero después de la última subasta; cada uno manda a su mejor
  // gladiador a una torre colgante sin bordes; nadie se rinde y el que se cae, muere
  CAMPEONES: { oroPorJugador: 10, puntosGanador: 3, puntoPorMuerte: 1, puntoPerdedorQueMato: 1, radioTorre: 6.2 },
  ECONOMIA: { inicial: { oro: 120 }, pujas: [1, 5] },  // solo oro; en la subasta se sube de a 1 o de a 5 (decidido por Merlin)

  /* =====================================================================
     PARTIDA
     ===================================================================== */
  // Orden decidido por Merlin (difiere del doc v0.1, que ponía Preparación antes que Eventos)
  FASES: ['subasta', 'evento', 'preparacion', 'pelea', 'recuperacion'],
  FASE_LABEL: { subasta: 'Subasta', evento: 'Evento', preparacion: 'Preparación', pelea: 'Pelea', recuperacion: 'Recuperación', campeones: 'Pelea de campeones' },
  CASILLEROS: 30,
  // el último ciclo no tiene recuperación (después de la última pelea va el final) y, después de la última
  // subasta, aparece la pelea de campeones (decidido por Merlin)
  get TABLERO() {
    const t = []; for (let c = 0; c < 5; c++) t.push(...this.FASES);
    t.push('subasta', 'campeones', 'evento', 'preparacion', 'pelea');
    return t;
  },
  JUGADORES: { min: 3, max: 6 },

  SUBASTA: {
    carrosPorEmperador: 2,       // decidido por Merlin
    statsVisibles: 2,            // se ve raza, salud y 2 stats al azar (decidido por Merlin)
    reloj: 10,                   // segundos al llegar el carro  // PROVISIONAL
    relojTrasPuja: 5,            // cada puja deja al menos esto en el reloj  // PROVISIONAL
    heridoProb: 0.08,            // doc §13: a veces llega uno muy herido pero extraordinario
    ojeadorStats: 2,             // el ojeador muestra 2 stats más y el tier  // PROVISIONAL
  },
  // gladiador de regalo si llegás a la pelea sin ninguno (decidido por Merlin)
  GRATIS: { tier: 'D' },
  PELEA: { maxPorEquipo: 8 },   // cada emperador convoca hasta 8 a cada pelea (decidido por Merlin)
  // Vida entre peleas (decidido por Merlin): recuperación +30%, cada casillero +10%, 10 oro = todos al 100%
  VIDA: { recuperacion: 30, porCasillero: 10, curaTotalOro: 10 },

  BOTS: {
    valorBase: { humano: 14, orco: 17, gigante: 26, goblin: 5, esqueleto: 20, lobo: 22, ghoul: 20 },   // oro por gladiador "promedio"  // PROVISIONAL
    topeBolsa: 0.45,             // nunca ofrecen más que esto de su bolsa por un lote
    reaccion: [0.5, 2.2],        // segundos que tardan en contestar una puja
    // personalidades (decidido por Merlin): de cada 3 bots, 1 medio tonto y 2 astutos
    perfiles: {
      astuto: { reaccion: [0.25, 0.9], valor: 1.2, ruido: 0.08, tope: 0.62, inspecciona: 0.85, acecha: 0.5, inflar: 0.3 },
      tonto:  { reaccion: [1.2, 3.2], valor: 1.0, ruido: 0.45, tope: 0.4, inspecciona: 0.2, antojo: 0.2, distraido: 0.3 },
    },
  },

  // Preparación (doc §12). Precios PROVISIONALES, en oro. Sin entrenamiento (decidido por Merlin)
  TIENDA: {
    curar:    { precio: 2, reduce: 0.5 },   // baja a la mitad todas las lesiones
    inspector:{ precio: 2 },                // revela honor y rasgos de un gladiador propio
    // fusión chamánica (decidido por Merlin): dos del mismo tier → el primero sube un tier. Gratis; si sale mal se pierden los dos
    fusion:   { chance: { D: 1, C: 0.8, B: 0.5, A: 0.2 }, mejora: 0.2, precios: [100, 200, 300] },
    // la sala del curandero (solo historia, decidido por Merlin): 8 camas, 1 a 4 días según el daño, 5 oro por día; los monstruos no entran
    curandero: { camas: 8, oroDia: 5, diasMax: 4 },
    // el ojito de la subasta: ve las stats completas del carro. 5 oro, y cada vez 5 más (vuelve a 5 en cada subasta)
    ojo:      { base: 5, suba: 5 },
  },
  RECUPERACION: { curaNatural: 0.4 },
  // Venta desde la escudería (decidido por Merlin): de 5 oro el más flojo a 50 oro el mejor, según el promedio de sus 6 stats
  VENTA: { minOro: 5, maxOro: 50, promMin: 25, promMax: 82 },        // las lesiones bajan 40% solas en cada recuperación  // PROVISIONAL

  // Eventos (fase Evento): mensaje secreto para cada emperador. TODOS PROVISIONALES
  EVENTOS: [
    { id: 'ojeador',    titulo: 'Un ojeador en la sombra', peso: 1.2, texto: 'Un ojeador te ofrece sus servicios: desde ahora, en cada subasta vas a ver el tier y 2 stats más de cada gladiador.', costo: 6, opciones: ['Contratarlo', 'No'] },
    { id: 'mecenas',    titulo: 'Un mecenas',             peso: 1,   texto: 'Un senador apuesta por tu escudería y te manda una bolsa: +5 oro.' },
    { id: 'ladrones',   titulo: 'Ladrones',               peso: 1,   texto: 'Te robaron en el mercado: perdés 2 oro.' },
    { id: 'medico',     titulo: 'Un médico griego',       peso: 1,   texto: 'Un médico griego atiende gratis a tu gladiador más lastimado: le cura todas las lesiones.' },
    { id: 'callejero',  titulo: 'Un luchador callejero',  peso: 1,   texto: 'Un luchador callejero quiere unirse a tu escudería por 3 oro.', costo: 3, opciones: ['Contratarlo', 'No'] },
    { id: 'apuesta',    titulo: 'Apuesta clandestina',    peso: 1,   texto: 'Unos apostadores te ofrecen jugar: ponés 2 oro y tenés 50% de llevarte 5.', costo: 2, opciones: ['Apostar', 'No'] },
    { id: 'entrenador', titulo: 'Un veterano',            peso: 1,   texto: 'Un viejo campeón entrena a uno de tus gladiadores: +4 en una stat al azar por 2 oro.', costo: 2, opciones: ['Pagar', 'No'] },
    { id: 'herrero',    titulo: 'Un herrero agradecido',  peso: 0.8, texto: 'Un herrero te regala una armadura ligera para un gladiador que no tenga.' },
    { id: 'inspector',  titulo: 'Un inspector te debe un favor', peso: 1, texto: 'En la próxima subasta vas a poder inspeccionar a fondo un lote: lo ves entero.' },
    { id: 'taberna',    titulo: 'Pelea de taberna',       peso: 0.8, texto: 'Uno de tus gladiadores se metió en una pelea de taberna y quedó lastimado.' },
    { id: 'augures',    titulo: 'Buenos presagios',       peso: 0.8, texto: 'Los augures ven buenos presagios: un gladiador tuyo gana +5 de frialdad.' },
    { id: 'nigromante', titulo: 'Un nigromante',          peso: 0.45, texto: 'Un nigromante te ofrece un esqueleto: no sangra, no se cansa y no se rinde nunca. Cuesta 4 oro.', costo: 4, opciones: ['Comprarlo', 'No'] },
    { id: 'luna',       titulo: 'Un extraño de ojos amarillos', peso: 0.45, texto: 'Un hombre callado quiere pelear para vos por 4 oro. Nadie más lo sabe: es un hombre lobo. En la arena, a mitad de la pelea, se transforma.', costo: 4, opciones: ['Contratarlo', 'No'] },
    { id: 'cementerio', titulo: 'Algo en el cementerio',   peso: 0.45, texto: 'Un enterrador te ofrece a un ghoul: más rápido y fuerte que un humano, nunca perdona y se come a los muertos para curarse. Cuesta 4 oro.', costo: 4, opciones: ['Comprarlo', 'No'] },
    { id: 'prestamista',titulo: 'Un prestamista',         peso: 0.8, texto: 'Un prestamista te ofrece 10 oro ahora. En la próxima recuperación le devolvés 13.', opciones: ['Aceptar', 'No'] },
  ],

  EQUIPOS: [
    { nombre: 'Rojo',     color: '#c0392b' },
    { nombre: 'Azul',     color: '#2e6fd8' },
    { nombre: 'Verde',    color: '#2f9e44' },
    { nombre: 'Amarillo', color: '#e0b31c' },
    { nombre: 'Violeta',  color: '#8e44ad' },
    { nombre: 'Blanco',   color: '#e8e8e8' },
  ],

  ESPECIALES: { probCarro: 0.05 },   // chance de que un gladiador de un carro sea de raza especial  // PROVISIONAL
  NOMBRES: {
    humano:  ['Marco', 'Tito', 'Décimo', 'Casio', 'Lucio', 'Flavio', 'Galo', 'Servio', 'Aulo', 'Quinto', 'Vibio', 'Rufo', 'Crixo', 'Spículo', 'Prisco', 'Vero', 'Celado', 'Atilio'],
    orco:    ['Grakk', 'Murzug', 'Ghor', 'Ugrash', 'Brakka', 'Thrug', 'Krul', 'Gorbag', 'Durm', 'Skarn', 'Vruk', 'Ozga'],
    gigante: ['Borrum', 'Hjalmar', 'Torvo', 'Gundar', 'Ymmar', 'Oskor', 'Brann', 'Thordo'],
    esqueleto: ['Huesos', 'Calavero', 'Osario', 'Mortis', 'Tibio', 'Cráneo', 'Fémur', 'Lázaro'],
    ghoul:   ['Mordaz', 'Carroño', 'Hambre', 'Gusano', 'Tumbas', 'Roído', 'Vórax', 'Necro'],
    goblin:  ['Pip', 'Snik', 'Grizz', 'Nub', 'Zek', 'Rikk', 'Fizz', 'Mog', 'Tukk', 'Skab', 'Wiz', 'Yap', 'Glim', 'Krik', 'Nax', 'Bep'],
  },

  /* ================= MODO HISTORIA (diseño de Manu y Merlin) ================= */
  HISTORIA: {
    maxLugares: 6,          // nunca hay más de 6 lugares abiertos en el mapa (decidido por Merlin)
    diasTemporal: 3,        // eventos y subastas especiales duran 3 días (decidido por Merlin)
    eventosPorCdh: 2,       // no se pueden hacer más de 2 eventos entre coliseo de historia y coliseo de historia (decidido por Merlin)
    subastasPorCdh: 2,      // cada coliseo de historia ganado trae 2 subastas nuevas (decidido por Merlin)
    gladsCdh: 8,            // en los coliseos de historia los reyes siempre mandan 8 (decidido por Merlin)
    // tiers de los reyes rivales en cada coliseo de historia (decidido por Merlin)
    tiersCdh: [null,
      { D: 1 },
      { C: 0.7, B: 0.3 }, { C: 0.5, B: 0.5 }, { C: 0.3, B: 0.7 },
      { B: 0.65, A: 0.35 }, { B: 0.5, A: 0.5 }, { B: 0.35, A: 0.65 },
      { B: 0.2, A: 0.8 },
      { A: 0.7, S: 0.3 },
      { S: 1 }],
    // cuántos reyes rivales hay en cada coliseo de historia: de 2 a 5 (decidido por Merlin; el reparto es PROVISIONAL)
    // y quiénes son (índices de REYES): cada vez vas conociendo más
    reyesCdh: [null, [0, 1], [0, 2], [1, 2, 3], [3, 4, 5], [2, 5, 6], [4, 6, 7, 8], [1, 7, 8, 9], [5, 8, 9, 10], [3, 6, 9, 10, 7], [11, 10, 9, 8, 7]],
    premioCdh: [null, 40, 60, 80, 100, 130, 160, 190, 220, 260, 0],   // PROVISIONAL
    // 10 peleas de campeones a lo largo de la historia; la k-ésima usa los tiers del coliseo de historia k  // premios PROVISIONAL
    pdc: { total: 10, premio: (k) => 25 + 15 * k, bots: (k) => (k < 4 ? 3 : k < 8 ? 4 : 5) },
    // coliseos de entretenimiento: reyes de las subastas, que ya tienen gladiadores de antes  // PROVISIONAL
    cde: { premio: { D: 20, C: 50, B: 80, A: 120, S: 150 } },
    // subastas: de 2 a 5 reyes más vos (decidido por Merlin); tiers según cuántos coliseos de historia ganaste  // PROVISIONAL
    tiersSubasta: [
      { D: 0.6, C: 0.35, B: 0.05 },
      { D: 0.35, C: 0.45, B: 0.17, A: 0.03 }, { D: 0.25, C: 0.45, B: 0.25, A: 0.05 }, { D: 0.15, C: 0.4, B: 0.35, A: 0.1 },
      { C: 0.35, B: 0.4, A: 0.2, S: 0.05 }, { C: 0.25, B: 0.45, A: 0.25, S: 0.05 }, { C: 0.2, B: 0.4, A: 0.32, S: 0.08 },
      { C: 0.15, B: 0.4, A: 0.35, S: 0.1 }, { B: 0.4, A: 0.42, S: 0.18 }, { B: 0.3, A: 0.45, S: 0.25 }, { A: 0.6, S: 0.4 }],
    // dificultad de la subasta: plata de los rivales comparada con la tuya (decidido por Merlin; cortes PROVISIONAL)
    dificultad: [
      { k: 'facil', label: 'Fácil', hasta: 0.8, color: '#6ab04c' },
      { k: 'medio', label: 'Media', hasta: 1.25, color: '#e0b31c' },
      { k: 'dificil', label: 'Difícil', hasta: 2, color: '#e07a2a' },
      { k: 'muy', label: 'Muy difícil', hasta: 1e9, color: '#d0402a' }],
    // subastas especiales: se ganan con galardones o con cómo fuiste a pelear (decidido por Merlin; contenido PROVISIONAL)
    especiales: {
      sangre:  { nombre: 'Subasta de los carniceros', por: 'ganar el galardón de más sangre perdida', mejora: 1, razas: { orco: 3, gigante: 2, humano: 1 } },
      muertes: { nombre: 'Subasta de los verdugos', por: 'ganar el galardón de más muertes', mejora: 1, razas: { humano: 2, orco: 2, ghoul: 1 } },
      vivos:   { nombre: 'Subasta de los veteranos', por: 'ganar el galardón de más supervivientes', mejora: 1, razas: null },
      ocho:    { nombre: 'Subasta del ejército', por: 'pelear con 8 convocados', mejora: 0, lotesGrandes: true, razas: { goblin: 3, orco: 2, humano: 2 } },
      uno:     { nombre: 'Subasta del campeón solitario', por: 'pelear con 1 solo convocado', mejora: 2, razas: null },
    },
    // reyes de otras ciudades (de distintas razas) que aparecen en los coliseos de historia  // nombres PROVISIONAL (Manu)
    REYES: [
      { nombre: 'Gorbash', ciudad: 'Krag-Tor', raza: 'orco' },
      { nombre: 'Vespasia', ciudad: 'Capua', raza: 'humano' },
      { nombre: 'Snik el Rico', ciudad: 'Fangal', raza: 'goblin' },
      { nombre: 'Hrodmar', ciudad: 'Hielofirme', raza: 'gigante' },
      { nombre: 'Mortecino', ciudad: 'la Ciudad Hueca', raza: 'ghoul' },
      { nombre: 'Tiberón', ciudad: 'Ostia', raza: 'humano' },
      { nombre: 'Kulgrim el Tuerto', ciudad: 'Roca Roja', raza: 'orco' },
      { nombre: 'Gnasha', ciudad: 'las Cloacas', raza: 'goblin' },
      { nombre: 'Ymir II', ciudad: 'los Picos', raza: 'gigante' },
      { nombre: 'Ulmo el Necrarca', ciudad: 'Tumbaseca', raza: 'ghoul' },
      { nombre: 'Casio Magno', ciudad: 'Pompeya', raza: 'humano' },
      { nombre: 'Augusta', ciudad: 'Roma', raza: 'humano' },
    ],
    // 7 mazmorras, una después de cada coliseo de historia del 3 al 9 (decidido por Merlin)
    // 3 oleadas y el jefe; el jefe no deja rendidos. Jefes: los humanoides que eligió Merlin + 2 inventados (Talos y Licaón) para revisar
    mazmorras: [
      { jefe: 'minotauro', nombre: 'El Laberinto', despuesDe: 3 },
      { jefe: 'medusa', nombre: 'La Cueva de Piedra', despuesDe: 4 },
      { jefe: 'aquiles', nombre: 'La Tumba del Héroe', despuesDe: 5 },
      { jefe: 'licaon', nombre: 'El Bosque Aullante', despuesDe: 6 },
      { jefe: 'arbol', nombre: 'La Arboleda Vieja', despuesDe: 7 },
      { jefe: 'ciclope', nombre: 'La Isla del Cíclope', despuesDe: 8 },
      { jefe: 'talos', nombre: 'La Fragua de Bronce', despuesDe: 9 },
    ],
    oleadas: [4, 6, 8],    // enemigos por oleada  // PROVISIONAL
    // monstruos inmortales: se curan sacrificando esclavos; cuánto cura cada esclavo según su tier  // PROVISIONAL
    sacrificio: { D: 10, C: 20, B: 35, A: 55, S: 100 },
  },
  // jefes de mazmorra (no se caen ni se rinden, no les cortás nada hasta que están casi muertos, y barren a los de al lado):
  // base = raza que usa para moverse y pelear; aguante divide el daño que recibe; fuerza multiplica el que hace  // números PROVISIONAL
  JEFES: {
    minotauro: { nombre: 'Asterión', titulo: 'el Minotauro', base: 'orco', altura: 2.5, peso: 260, aguante: 1.76, fuerza: 0.96, piel: '#6a4630', arma: 'martillo', escudo: 'ninguno', armadura: 'ninguna', monstruo: true, oro: 120 },
    medusa:    { nombre: 'Medusa', titulo: 'la de la mirada de piedra', base: 'humano', altura: 1.85, peso: 80, aguante: 1.7, fuerza: 0.9, piel: '#7a9a6a', arma: 'lanza', escudo: 'chico', armadura: 'ligera', monstruo: true, oro: 150 },
    aquiles:   { nombre: 'Aquiles', titulo: 'el de los pies ligeros', base: 'humano', altura: 1.9, peso: 92, aguante: 2.31, fuerza: 1.08, arma: 'lanza', escudo: 'grande', armadura: 'pesada', monstruo: false, oro: 180 },
    licaon:    { nombre: 'Licaón', titulo: 'rey de los lobos', base: 'lobo', altura: 2.4, peso: 190, aguante: 2.48, fuerza: 1.14, piel: '#5a4a3e', arma: 'garras', escudo: 'ninguno', armadura: 'ninguna', monstruo: true, oro: 210 },
    arbol:     { nombre: 'Raíz Antigua', titulo: 'el guerrero árbol', base: 'gigante', altura: 3.6, peso: 600, aguante: 2.7, fuerza: 1.15, piel: '#6a5434', arma: 'garrote', escudo: 'ninguno', armadura: 'ninguna', monstruo: true, oro: 240 },
    ciclope:   { nombre: 'Polifemo', titulo: 'el cíclope', base: 'gigante', altura: 3.9, peso: 700, aguante: 3.58, fuerza: 1.32, piel: '#c0a080', arma: 'garrote', escudo: 'ninguno', armadura: 'ninguna', monstruo: true, oro: 270 },
    talos:     { nombre: 'Talos', titulo: 'el gigante de bronce', base: 'gigante', altura: 4.1, peso: 900, aguante: 4.0, fuerza: 1.38, piel: '#b07a3a', arma: 'martillo', escudo: 'ninguno', armadura: 'ninguna', monstruo: true, oro: 320 },
    // el jefe final: baja cuando cae su ejército de resucitados (decidido por Merlin)  // números PROVISIONAL
    diablo:    { nombre: 'El Diablo', titulo: 'señor del inframundo', base: 'gigante', altura: 3.7, peso: 650, aguante: 6.5, fuerza: 1.6, piel: '#a8221a', arma: 'lanza', escudo: 'ninguno', armadura: 'ninguna', monstruo: true, oro: 0 },
  },
  // esbirros de cada mazmorra: las 3 oleadas son de los suyos (lista aprobada por Merlin)
  ESBIRROS: {
    minotauro: { nombre: 'Hombre toro', raza: 'orco', piel: '#7a5034', altura: 2.15 },
    medusa:    { nombre: 'Hombre serpiente', raza: 'humano', piel: '#5f8a4a' },
    aquiles:   { nombre: 'Mirmidón', raza: 'humano', equipo: { arma: 'lanza', escudo: 'grande', armadura: 'pesada' } },
    licaon:    { nombre: 'Hombre lobo', raza: 'lobo' },
    arbol:     { nombre: 'Hombre de raíz', raza: 'orco', piel: '#6a5434' },
    ciclope:   { nombre: 'Gigante joven', raza: 'gigante', piel: '#c0a080', altura: 2.5 },
    talos:     { nombre: 'Autómata de bronce', raza: 'humano', piel: '#b07a3a', sinSangre: true },
  },
};
root.REGLAS = REGLAS;
if (typeof module !== 'undefined') module.exports = REGLAS;
})(typeof window !== 'undefined' ? window : globalThis);
