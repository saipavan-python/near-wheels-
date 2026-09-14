// Curated automotive photography (Unsplash CDN). Deterministic per-seed picks
// so a listing always renders the same editorial image set.

const U = (id: string, w = 1600) =>
  `https://images.unsplash.com/${id}?q=80&w=${w}&auto=format&fit=crop`;

export const IMGS = {
  hero: U("photo-1544636331-e26879cd4d9b", 2400), // orange supercar, dramatic front
  heroYellowA: U("photo-1590362891991-f776e747a588", 2400), // yellow supercar
  heroYellowB: U("photo-1542282088-fe8426682b8f", 2400), // yellow classic car
  cta: U("photo-1553440569-bcc63803a83d", 2400), // coupe profile at dusk
  aiSide: U("photo-1449965408869-eaa3f722e40d", 1200), // hands on the wheel
  garageWide: U("photo-1487754180451-c456f719a1fc", 1600),
  driversHero: U("photo-1494905998402-395d579af36f", 2400), // modern steering wheel cabin
  driverProfile: "/images/driver-profile.jpg", // user-selected portrait for driver profiles
  farmField: U("photo-1625246333195-78d9c38ad449", 2400), // tractor in green field
};

const POOLS: Record<string, string[]> = {
  premium: [
    "photo-1494976388531-d1058494cdd8", // muscle car front grille
    "photo-1552519507-da3b142c6e3d", // blue performance coupe
    "photo-1553440569-bcc63803a83d", // silver coupe profile
    "photo-1541899481282-d53bffe3c35d", // grey sedan
    "photo-1511919884226-fd3cad34687c", // black car head-on
  ],
  road: [
    "photo-1502877338535-766e1452684a", // car on road, sunset
    "photo-1568605117036-5fe5e7bab0b7", // white car forest road
    "photo-1469854523086-cc02fe5d8800", // van on desert highway
    "photo-1533473359331-0135ef1b58bf", // highway dusk
  ],
  interior: [
    "photo-1449965408869-eaa3f722e40d", // steering wheel hands
    "photo-1489824904134-891ab64532f1", // cabin interior
  ],
  workshop: [
    "photo-1487754180451-c456f719a1fc", // mechanic under car
    "photo-1504222490345-c075b6008014", // workshop tools wall
    "photo-1530046339160-ce3e530c7d2f", // engine bay
  ],
  farm: [
    "photo-1625246333195-78d9c38ad449", // tractor in field
    "photo-1500937386664-56d1dfef3854", // harvest hands
  ],
};

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pick(pool: string[], seed: string): string {
  return U(pool[hash(seed) % pool.length]);
}

/** Main editorial photo for any listing title/category. */
/** User-selected spray-drone photo, served locally. */
export const DRONE_IMG = "/images/drone.jpg";

export function vehicleImage(seed: string, category?: string): string {
  const t = `${seed} ${category || ""}`.toLowerCase();
  if (/tractor|rotavator|cultivator|harvester|tanker/.test(t)) return pick(POOLS.farm, seed);
  if (/drone|spray/.test(t)) return DRONE_IMG;
  if (/scorpio|innova|ertiga|xylo|xuv|suv|jeep|sumo|bolero/.test(t)) return pick([...POOLS.premium, ...POOLS.road], seed);
  if (/auto|rickshaw/.test(t)) return pick(POOLS.road, seed);
  if (/shine|pulsar|splendor|bike|scooter|activa/.test(t)) return pick(POOLS.road, seed);
  return pick([...POOLS.premium, ...POOLS.road], seed);
}

/** Gallery set for a detail page: hero + alternates + interior. */
export function vehicleGallery(seed: string, category?: string): string[] {
  const t = `${seed} ${category || ""}`.toLowerCase();
  const h = hash(seed);
  if (/drone/.test(t)) {
    return [DRONE_IMG, IMGS.farmField, U(POOLS.interior[h % POOLS.interior.length]), IMGS.farmField];
  }
  const base =
    /tractor|harvester|tanker/.test(t)
      ? POOLS.farm
      : [...POOLS.premium, ...POOLS.road];
  return [U(base[h % base.length]), U(base[(h + 1) % base.length]), U(POOLS.interior[h % POOLS.interior.length]), U(base[(h + 2) % base.length])];
}

/** All human-portrait slots use the user-selected driver photo (no stock faces). */
export function portraitImage(_seed?: string): string {
  return "/images/driver-profile.jpg";
}

export function garageImage(seed: string): string {
  return pick(POOLS.workshop, seed);
}

