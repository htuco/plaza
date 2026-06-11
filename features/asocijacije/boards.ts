// Original Asocijacije boards (classic BHS quiz format, boards written for Plaza —
// not copied from any published quiz). 4 columns × 4 clues, each column has a
// solution, all four point to the final solution.

export interface AsocijacijeColumnSeed {
  hints: [string, string, string, string];
  solution: string;
  aliases?: string[];
}

export interface AsocijacijeBoardSeed {
  id: string;
  columns: [
    AsocijacijeColumnSeed,
    AsocijacijeColumnSeed,
    AsocijacijeColumnSeed,
    AsocijacijeColumnSeed,
  ];
  finalSolution: string;
  finalAliases?: string[];
}

export const ASOCIJACIJE_BOARDS: readonly AsocijacijeBoardSeed[] = [
  {
    id: "ljeto",
    columns: [
      { hints: ["more", "pijesak", "suncobran", "ručnik"], solution: "Plaža" },
      { hints: ["kornet", "kugla", "vanilija", "hladno"], solution: "Sladoled" },
      { hints: ["juni", "juli", "august", "bez škole"], solution: "Raspust", aliases: ["ferije"] },
      { hints: ["krema", "naočale", "ten", "koža"], solution: "Sunčanje" },
    ],
    finalSolution: "Ljeto",
  },
  {
    id: "sarajevo",
    columns: [
      { hints: ["golubovi", "fontana", "drvo", "simbol čaršije"], solution: "Sebilj" },
      { hints: ["žičara", "bob staza", "vidikovac", "planina iznad grada"], solution: "Trebević" },
      {
        hints: ["somun", "luk", "deset komada", "kajmak"],
        solution: "Ćevapi",
        aliases: ["cevapcici", "ćevapčići"],
      },
      {
        hints: ["1984", "baklja", "Vučko", "zimske igre"],
        solution: "Olimpijada",
        aliases: ["zoi", "olimpijske igre"],
      },
    ],
    finalSolution: "Sarajevo",
  },
  {
    id: "muzika",
    columns: [
      { hints: ["žice", "trzalica", "akordi", "kamp vatra"], solution: "Gitara" },
      { hints: ["bina", "publika", "ulaznica", "bis"], solution: "Koncert" },
      { hints: ["refren", "strofa", "stihovi", "melodija"], solution: "Pjesma" },
      { hints: ["gramofon", "igla", "vinil", "DJ"], solution: "Ploča", aliases: ["gramofonska ploca"] },
    ],
    finalSolution: "Muzika",
  },
  {
    id: "zima",
    columns: [
      { hints: ["pahulja", "grudvanje", "snjegović", "bijeli pokrivač"], solution: "Snijeg" },
      { hints: ["staza", "lift", "Jahorina", "štapovi"], solution: "Skijanje" },
      { hints: ["radijator", "drva", "peć", "kamin"], solution: "Grijanje" },
      {
        hints: ["vatromet", "ponoć", "odbrojavanje", "čestitke"],
        solution: "Nova godina",
        aliases: ["docek", "doček nove godine"],
      },
    ],
    finalSolution: "Zima",
  },
  {
    id: "fudbal",
    columns: [
      { hints: ["rukavice", "penal", "odbrana", "mreža iza leđa"], solution: "Golman" },
      { hints: ["travnjak", "tribine", "reflektori", "Koševo"], solution: "Stadion" },
      { hints: ["žuti", "crveni", "sudija", "prekršaj"], solution: "Karton" },
      {
        hints: ["trofej", "svake četiri godine", "reprezentacije", "finale"],
        solution: "Svjetsko prvenstvo",
        aliases: ["mundijal", "sp"],
      },
    ],
    finalSolution: "Fudbal",
    finalAliases: ["nogomet"],
  },
  {
    id: "svadba",
    columns: [
      { hints: ["bijela", "veo", "šlep", "mlada je nosi"], solution: "Vjenčanica" },
      { hints: ["zlato", "prst", "prosidba", "dijamant"], solution: "Prsten" },
      { hints: ["spratovi", "figurice na vrhu", "sječenje", "desert"], solution: "Torta" },
      { hints: ["gosti", "datum", "koverta", "spisak zvanica"], solution: "Pozivnica" },
    ],
    finalSolution: "Svadba",
    finalAliases: ["vjencanje"],
  },
  {
    id: "putovanje",
    columns: [
      { hints: ["pista", "prtljag", "carina", "let"], solution: "Aerodrom" },
      { hints: ["recepcija", "soba", "ključ", "doručak uključen"], solution: "Hotel" },
      { hints: ["kamera oko vrata", "mapa", "suveniri", "grupa s vodičem"], solution: "Turista" },
      { hints: ["šine", "kondukter", "stanica", "vagon"], solution: "Voz", aliases: ["vlak"] },
    ],
    finalSolution: "Putovanje",
    finalAliases: ["put"],
  },
  {
    id: "skola",
    columns: [
      { hints: ["sveska", "olovka", "gumica", "pernica"], solution: "Pribor" },
      { hints: ["petica", "jedinica", "dnevnik", "popravni"], solution: "Ocjena" },
      { hints: ["brojevi", "jednačina", "zadaci", "tablica množenja"], solution: "Matematika" },
      { hints: ["autobus", "cijeli razred", "višednevni izlet", "nastavnici paze"], solution: "Ekskurzija" },
    ],
    finalSolution: "Škola",
  },
] as const;

// BHS-friendly normalization: lowercase, trim, collapse whitespace, strip
// punctuation, and fold diacritics (č/ć→c, š→s, ž→z, đ→dj and đ→d variants).
export function normalizedGuessForms(input: string): string[] {
  const base = input
    .toLocaleLowerCase("bs")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  const djVariant = base
    .replaceAll("đ", "dj")
    .replaceAll("č", "c")
    .replaceAll("ć", "c")
    .replaceAll("š", "s")
    .replaceAll("ž", "z")
    .replaceAll("dž", "dz");
  const dVariant = base
    .replaceAll("đ", "d")
    .replaceAll("č", "c")
    .replaceAll("ć", "c")
    .replaceAll("š", "s")
    .replaceAll("ž", "z")
    .replaceAll("dž", "dz");
  return Array.from(new Set([djVariant, dVariant])).filter((form) => form.length > 0);
}

export function guessMatches(guess: string, answer: string, aliases: string[] = []): boolean {
  const guessForms = new Set(normalizedGuessForms(guess));
  if (guessForms.size === 0) return false;
  for (const candidate of [answer, ...aliases]) {
    for (const form of normalizedGuessForms(candidate)) {
      if (guessForms.has(form)) return true;
    }
  }
  return false;
}
