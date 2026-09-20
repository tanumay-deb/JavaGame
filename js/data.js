/* Prehistoric Fun Park (recreation) - static game data.
   Mechanics modelled on the 2007 J2ME park-management game; all artwork here is
   drawn procedurally in sprites.js, no original assets are used. */

const TILE_W = 64;            // isometric tile width  (screen px)
const TILE_H = 32;            // isometric tile height (screen px)
const LEVEL_H = 18;           // vertical px per "storey" used by sprites
const GRID_W = 36;            // the whole valley, in tiles
const GRID_H = 36;
const PLOT = 6;               // land is bought a plot at a time
const PLOTS_X = GRID_W / PLOT;
const PLOTS_Y = GRID_H / PLOT;
const MARGIN = 10;            // tiles of wild country drawn beyond the valley
const WILD = 34;              // how far scenery is scattered, so the corners of the view are never bare
const ROAD_Y = GRID_H + 3;    // the track that brings visitors, south of the park
const PLOT_BASE = 850;        // price of the first plot of land you buy
const PLOT_STEP = 480;        // each further plot costs this much more

const GROUND = { GRASS: 0, GRAVEL: 1, STONE: 2, WATER: 3, SAND: 4, ROAD: 5 };

const MONTH_SECONDS = 48;     // real seconds per in-game month at 1x speed
const FIGHT_AT = 18;          // happiness below which tempers can flare
const DAYS_PER_MONTH = 28;

/* ---------------------------------------------------------------- palettes */
const PALETTE = {
  grass:      ['#5fa148', '#64a74c', '#5c9d45', '#62a44a'],
  grassAlt:   ['#72ad52', '#569444', '#69a64e', '#7cb257'],
  grassDry:   '#a8ad5f',        // sun-bleached meadow on the high ground
  grassDeep:  '#3d7a3c',        // damp, shaded hollows
  grassDark:  '#477c33',
  gravel:     '#b39a6c',
  gravelEdge: '#8f7a52',
  stone:      '#b9bcc4',
  stoneEdge:  '#8d9099',
  sand:       '#d9c48a',
  water:      '#2f7fb5',
  waterLite:  '#57a8d8',
  wood:       '#8a5a33',
  woodDark:   '#6b431f',
  thatch:     '#c9a24a',
  thatchDark: '#a8822f',
  hide:       '#c98f5e',
  bone:       '#e8e2cf',
  boneDark:   '#c6bfa6',
  rock:       '#9aa0a6',
  rockDark:   '#767c82'
};

const SKIN_TONES  = ['#f0c08a', '#d99b66', '#b97a4a', '#8d5a34', '#6b4226'];
const CLOTH_TONES = ['#c94f4f', '#4f7fc9', '#c9a24a', '#5aa85a', '#9b59b6', '#e07b39', '#3ea9a0'];
const HAIR_TONES  = ['#2b1d12', '#4a2f1a', '#6b4423', '#111111', '#7a5c3a'];

/* ------------------------------------------------------------- build items */
/* cat: ride | stall | service | decor | engine | path | staffpost
   w,h  : footprint in tiles
   ent/ext : local tile of entrance / exit (rides only)
   power: needs a dino treadmill in range
   need : visitor need this satisfies (stalls/services)
   worker: staff role required to operate                                     */
const ITEMS = {
  /* ---- paths ---- */
  gravel: { name: 'Gravel Path', cat: 'path', ground: GROUND.GRAVEL, cost: 6, comfort: 0.2, art: 'path', unlock: 0,
            desc: 'Cheap trail. Visitors can only walk on paths.' },
  stone:  { name: 'Stone Path', cat: 'path', ground: GROUND.STONE, cost: 18, comfort: 0.6, art: 'path', unlock: 2,
            desc: 'Smarter and more comfortable than gravel.' },

  /* ---- rides ---- */
  seesaw:     { name: 'Seesaw', cat: 'ride', w: 2, h: 1, cost: 260, rating: 2, cap: 2, dur: 6, fee: 2, upkeep: 5,
                power: false, unlock: 0, art: 'seesaw', ent: [0, 0], ext: [1, 0] },
  trampoline: { name: 'Trampoline', cat: 'ride', w: 2, h: 2, cost: 460, rating: 3, cap: 4, dur: 8, fee: 3, upkeep: 8,
                power: false, unlock: 0, art: 'trampoline', ent: [0, 1], ext: [1, 1] },
  swing:      { name: 'Swing', cat: 'ride', w: 2, h: 2, cost: 620, rating: 4, cap: 4, dur: 9, fee: 4, upkeep: 10,
                power: false, unlock: 0, art: 'swing', ent: [0, 1], ext: [1, 1] },
  slide:      { name: 'Stone Slide', cat: 'ride', w: 3, h: 2, cost: 880, rating: 5, cap: 6, dur: 9, fee: 5, upkeep: 14,
                power: false, unlock: 1, art: 'slide', ent: [0, 1], ext: [2, 1] },
  range:      { name: 'Throwing Range', cat: 'ride', w: 3, h: 2, cost: 740, rating: 4, cap: 4, dur: 8, fee: 4, upkeep: 11,
                power: false, unlock: 1, art: 'range', ent: [0, 1], ext: [2, 1] },
  carousel:   { name: 'Carousel', cat: 'ride', w: 3, h: 3, cost: 1300, rating: 6, cap: 8, dur: 11, fee: 6, upkeep: 20,
                power: true, unlock: 2, art: 'carousel', ent: [0, 2], ext: [2, 2] },
  catapult:   { name: 'Catapult', cat: 'ride', w: 3, h: 2, cost: 1550, rating: 6, cap: 4, dur: 9, fee: 6, upkeep: 22,
                power: true, unlock: 3, art: 'catapult', ent: [0, 1], ext: [2, 1] },
  ferris:     { name: 'Ferris Wheel', cat: 'ride', w: 3, h: 3, cost: 2000, rating: 7, cap: 12, dur: 14, fee: 8, upkeep: 30,
                power: true, unlock: 4, art: 'ferris', ent: [0, 2], ext: [2, 2] },
  cave:       { name: 'Haunted Cave', cat: 'ride', w: 4, h: 3, cost: 2300, rating: 7, cap: 8, dur: 13, fee: 8, upkeep: 28,
                power: true, unlock: 5, art: 'cave', ent: [0, 2], ext: [3, 2] },
  tower:      { name: 'Drop Tower', cat: 'ride', w: 3, h: 3, cost: 2600, rating: 8, cap: 8, dur: 12, fee: 9, upkeep: 34,
                power: true, unlock: 7, art: 'tower', ent: [0, 2], ext: [2, 2] },
  chute:      { name: 'Water Chute', cat: 'ride', w: 4, h: 3, cost: 3000, rating: 9, cap: 8, dur: 14, fee: 10, upkeep: 38,
                power: true, unlock: 9, art: 'chute', ent: [0, 2], ext: [3, 2] },
  coaster:    { name: 'Roller Coaster', cat: 'ride', w: 5, h: 4, cost: 4600, rating: 10, cap: 16, dur: 16, fee: 13, upkeep: 55,
                power: true, unlock: 12, art: 'coaster', ent: [0, 3], ext: [4, 3] },

  /* ---- stalls & services ---- */
  snack:   { name: 'Snack Bar', cat: 'stall', w: 2, h: 1, cost: 420, price: 5, upkeep: 6, need: 'hunger', gain: 75,
             worker: 'salesman', unlock: 0, art: 'snack', desc: 'Satisfies hunger. Needs a salesman.' },
  drinks:  { name: 'Juice Hut', cat: 'stall', w: 1, h: 1, cost: 320, price: 4, upkeep: 5, need: 'thirst', gain: 80,
             worker: 'salesman', unlock: 0, art: 'drinks', desc: 'Quenches thirst. Needs a salesman.' },
  cafe:    { name: 'Cave Cafe', cat: 'stall', w: 2, h: 2, cost: 980, price: 8, upkeep: 12, need: 'hunger', gain: 100,
             worker: 'cook', unlock: 3, art: 'cafe', desc: 'Food, drink and a rest. Needs a cook.' },
  balloon: { name: 'Balloon Stand', cat: 'stall', w: 1, h: 1, cost: 280, price: 4, upkeep: 4, need: 'joy', gain: 60,
             worker: 'salesman', unlock: 4, art: 'balloon', desc: 'Raises happiness. Needs a salesman.' },
  toilet:  { name: 'Toilet Hut', cat: 'service', w: 2, h: 1, cost: 360, price: 0, upkeep: 6, need: 'bladder', gain: 100,
             worker: null, unlock: 0, art: 'toilet', desc: 'Free. Visitors get very unhappy without one.' },
  aid:     { name: 'Aid Post', cat: 'service', w: 2, h: 1, cost: 720, price: 0, upkeep: 9, need: 'health', gain: 100,
             worker: 'shaman', unlock: 5, art: 'aid', desc: 'Heals hurt visitors. Needs a shaman.' },
  gate:    { name: 'Ticket Office', cat: 'service', w: 2, h: 1, cost: 520, price: 0, upkeep: 4, need: null, gain: 0,
             worker: null, unlock: 1, art: 'gate', desc: 'Lets you charge an entrance fee.' },

  /* ---- power ---- */
  engine:  { name: 'Dino Treadmill', cat: 'engine', w: 2, h: 2, cost: 950, radius: 7, upkeep: 25, worker: 'rider',
             unlock: 2, art: 'engine', desc: 'Powers nearby rides. Needs a dino rider to turn it.' },

  /* ---- comfort & decor ---- */
  bench:   { name: 'Bench', cat: 'decor', w: 1, h: 1, cost: 70, upkeep: 1, rest: true, beauty: 1, unlock: 0, art: 'bench',
             desc: 'Tired visitors sit down instead of getting cross.' },
  sign:    { name: 'Signpost', cat: 'decor', w: 1, h: 1, cost: 90, upkeep: 1, sign: true, beauty: 1, unlock: 1, art: 'sign',
             desc: 'At a crossroads it helps visitors find their way.' },
  palm:    { name: 'Palm', cat: 'decor', w: 1, h: 1, cost: 90, upkeep: 1, beauty: 3, unlock: 0, art: 'palm' },
  bush:    { name: 'Fern', cat: 'decor', w: 1, h: 1, cost: 50, upkeep: 1, beauty: 2, unlock: 0, art: 'bush' },
  flowers: { name: 'Flowers', cat: 'decor', w: 1, h: 1, cost: 35, upkeep: 1, beauty: 2, unlock: 0, art: 'flowers' },
  rock:    { name: 'Boulder', cat: 'decor', w: 1, h: 1, cost: 60, upkeep: 1, beauty: 1, unlock: 0, art: 'rock' },
  torch:   { name: 'Torch', cat: 'decor', w: 1, h: 1, cost: 120, upkeep: 2, beauty: 2, light: true, unlock: 2, art: 'torch',
             desc: 'Pretty by day, lights the park at night.' },
  fountain:{ name: 'Tar Fountain', cat: 'decor', w: 2, h: 2, cost: 420, upkeep: 5, beauty: 6, unlock: 6, art: 'fountain' }
};

/* ------------------------------------------------------------------ staff */
const STAFF = {
  guard:     { name: 'Guard',      salary: 65, color: '#6d7f9b', desc: 'Stops fights breaking out nearby.' },
  repairman: { name: 'Repairman',  salary: 85, color: '#b5793a', desc: 'Walks to broken rides and fixes them.' },
  cook:      { name: 'Cook',       salary: 75, color: '#d9a441', desc: 'Runs a Cave Cafe.' },
  salesman:  { name: 'Salesman',   salary: 60, color: '#4f9d6a', desc: 'Runs a snack bar, juice hut or balloon stand.' },
  shaman:    { name: 'Shaman',     salary: 95, color: '#8e6fc0', desc: 'Heals visitors at an aid post.' },
  rider:     { name: 'Dino Rider', salary: 55, color: '#c2604a', desc: 'Turns a dino treadmill so rides get power.' }
};

const STAFF_ICON = { guard: '🛡', repairman: '🔧', cook: '🍲', salesman: '🧺', shaman: '🌿', rider: '🦕' };

/* --------------------------------------------------------------- visitors */
const NEED_INFO = {
  hunger:  { label: 'Hunger',  icon: '🍖', rate: 0.9 },
  thirst:  { label: 'Thirst',  icon: '💧', rate: 1.1 },
  bladder: { label: 'Toilet',  icon: '🚻', rate: 0.75 },
  energy:  { label: 'Energy',  icon: '💤', rate: 0.6 },
  health:  { label: 'Health',  icon: '🩹', rate: 0.0 },
  joy:     { label: 'Fun',     icon: '🎢', rate: 1.0 }
};

const BUILD_TABS = [
  { id: 'path',  label: 'Paths',  items: ['gravel', 'stone'] },
  { id: 'ride',  label: 'Rides',  items: ['seesaw', 'trampoline', 'swing', 'slide', 'range', 'carousel', 'catapult', 'ferris', 'cave', 'tower', 'chute', 'coaster'] },
  { id: 'shop',  label: 'Shops',  items: ['snack', 'drinks', 'cafe', 'balloon', 'toilet', 'aid', 'gate'] },
  { id: 'power', label: 'Power',  items: ['engine'] },
  { id: 'decor', label: 'Decor',  items: ['bench', 'sign', 'palm', 'bush', 'flowers', 'rock', 'torch', 'fountain'] },
  { id: 'land',  label: '🌄 Land', items: [] },
  { id: 'clear', label: '💥 Demolish', items: [] }
];

const OBJECTIVES = [
  { id: 'cash',      label: 'Cash in hand',        target: 12000 },
  { id: 'visitors',  label: 'Visitors in park',    target: 60 },
  { id: 'happiness', label: 'Average happiness %', target: 70 },
  { id: 'rides',     label: 'Working rides built', target: 8 },
  { id: 'land',      label: 'Plots of land owned',  target: 8 }
];
