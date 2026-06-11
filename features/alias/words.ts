// Seed word deck for Alias. BHS-friendly, everyday vocabulary — nothing obscure,
// political, or adult. Words are display-only (guessing happens out loud), so
// diacritics are kept where natural.

export interface AliasWordCategory {
  id: string;
  label: string;
  words: readonly string[];
}

export const ALIAS_WORD_DECK: readonly AliasWordCategory[] = [
  {
    id: "everyday",
    label: "Svakodnevnica",
    words: [
      "jastuk", "ogledalo", "kišobran", "novčanik", "četkica za zube",
      "peškir", "deka", "šolja", "kašika", "viljuška",
      "tanjir", "čaša", "stolica", "fotelja", "tepih",
      "zavjesa", "prozor", "balkon", "stepenice", "lift",
      "ključ", "brava", "utičnica", "sijalica", "daljinski",
      "punjač", "slušalice", "ruksak", "kofer", "naočale",
      "sat", "kalendar", "sveska", "olovka", "makaze",
      "ljepilo", "selotejp", "kanta za smeće", "metla", "usisivač",
    ],
  },
  {
    id: "food",
    label: "Hrana i piće",
    words: [
      "ćevapi", "burek", "sarma", "pita", "baklava",
      "palačinke", "kajmak", "ajvar", "kiseli kupus", "grah",
      "pljeskavica", "somun", "tufahija", "hurmašice", "halva",
      "limunada", "kafa", "čaj", "sok", "jogurt",
      "sladoled", "čokolada", "kokice", "pizza", "sendvič",
      "supa", "riža", "krompir", "paradajz", "krastavac",
      "paprika", "luk", "bijeli luk", "jabuka", "lubenica",
      "malina", "višnja", "orah", "med", "sir",
    ],
  },
  {
    id: "sport",
    label: "Sport",
    words: [
      "fudbal", "košarka", "odbojka", "rukomet", "tenis",
      "skijanje", "plivanje", "maraton", "biciklizam", "šah",
      "golman", "sudija", "penal", "korner", "ofsajd",
      "dres", "kopačke", "lopta", "gol", "koš",
      "reket", "mreža", "stadion", "navijači", "trener",
      "zlatna medalja", "olimpijada", "štoperica", "trening", "teretana",
      "sklekovi", "trčanje", "skok u dalj", "stoni tenis", "pikado",
    ],
  },
  {
    id: "culture",
    label: "Film i muzika",
    words: [
      "gitara", "harmonika", "bubnjevi", "violina", "klavir",
      "mikrofon", "koncert", "bina", "publika", "pjevač",
      "sevdalinka", "narodna muzika", "rok bend", "horor film", "crtani film",
      "komedija", "glumac", "režiser", "scenario", "kino",
      "kokice u kinu", "serija", "epizoda", "špica", "titlovi",
      "kamera", "fotografija", "selfi", "youtuber", "podcast",
      "radio", "televizija", "pozorište", "balet", "muzej",
    ],
  },
  {
    id: "geography",
    label: "Geografija",
    words: [
      "Sarajevo", "Mostar", "Banja Luka", "Tuzla", "Zenica",
      "Bjelašnica", "Jahorina", "Neretva", "Una", "Drina",
      "Jadransko more", "plaža", "ostrvo", "planina", "rijeka",
      "vodopad", "jezero", "most", "tvrđava", "čaršija",
      "selo", "glavni grad", "granica", "pasoš", "aerodrom",
      "autoput", "tunel", "pustinja", "vulkan", "ledenjak",
      "Eiffelov toranj", "piramide", "okean", "ekvator", "sjeverni pol",
    ],
  },
  {
    id: "objects",
    label: "Predmeti",
    words: [
      "džezva", "fildžan", "tepsija", "tespih", "fes",
      "šerpa", "tava", "rerna", "frižider", "veš mašina",
      "pegla", "fen", "brijač", "termometar", "flaster",
      "baterija", "ekran", "tastatura", "miš", "printer",
      "telefon", "tablet", "fotoaparat", "dvogled", "kompas",
      "šator", "vreća za spavanje", "roštilj", "sjekira", "čekić",
      "šrafciger", "ljestve", "kanta", "crijevo za vodu", "kosilica",
    ],
  },
  {
    id: "professions",
    label: "Zanimanja",
    words: [
      "doktor", "medicinska sestra", "zubar", "apotekar", "veterinar",
      "učitelj", "profesor", "direktor", "policajac", "vatrogasac",
      "pekar", "kuhar", "konobar", "kasapin", "frizer",
      "taksista", "vozač autobusa", "pilot", "stjuardesa", "kapetan",
      "poštar", "električar", "vodoinstalater", "stolar", "zidar",
      "advokat", "sudija u sudu", "novinar", "prevodilac", "programer",
      "glumica", "pjevačica", "slikar", "arhitekta", "astronaut",
    ],
  },
  {
    id: "animals",
    label: "Životinje",
    words: [
      "mačka", "pas", "konj", "krava", "ovca",
      "koza", "kokoš", "patka", "guska", "puran",
      "lav", "tigar", "medvjed", "vuk", "lisica",
      "zec", "jež", "vjeverica", "miš", "slon",
      "žirafa", "zebra", "majmun", "kengur", "panda",
      "delfin", "kit", "ajkula", "hobotnica", "rak",
      "orao", "sova", "golub", "papagaj", "pingvin",
      "zmija", "kornjača", "žaba", "pčela", "leptir",
    ],
  },
] as const;

export const ALL_ALIAS_WORDS: readonly string[] = ALIAS_WORD_DECK.flatMap(
  (category) => category.words,
);
