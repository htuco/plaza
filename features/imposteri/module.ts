import type { GameModule } from "@/features/registry";
import {
  VOTE_DURATION_SECONDS,
  type ImposteriIntent,
  type ImposteriRoundResult,
  type ImposteriState,
  type ImposteriView,
  type Phase,
  type Role,
} from "./types";
import { ImposteriClient } from "./client";

const WORD_DECK = [
  {
    category: "Hrana",
    words: [
      { word: "cevapi", hint: "zar" },
      { word: "burek", hint: "tepsija" },
      { word: "sarma", hint: "list kupusa" },
      { word: "pita", hint: "tanko tijesto" },
      { word: "doner", hint: "rotirajuci raznjic" },
      { word: "sogan dolma", hint: "luk" },
      { word: "japrak", hint: "vinov list" },
      { word: "begova corba", hint: "krem juha" },
      { word: "klepe", hint: "punjeno tijesto" },
      { word: "tufahija", hint: "jabuka" },
      { word: "baklava", hint: "med" },
      { word: "kadaif", hint: "tanke niti" },
      { word: "hurmasice", hint: "sirup" },
      { word: "halva", hint: "tahana" },
      { word: "lokum", hint: "secerni kub" },
      { word: "ajvar", hint: "paprika" },
      { word: "kajmak", hint: "skorup" },
      { word: "sir", hint: "mlijecno" },
      { word: "kiseli kupus", hint: "zimnica" },
      { word: "feferon", hint: "ljuto" },
      { word: "palacinke", hint: "tava" },
      { word: "krofne", hint: "fritiranje" },
      { word: "sladoled", hint: "hladno" },
      { word: "cokolada", hint: "kakao" },
      { word: "kokice", hint: "kino" },
      { word: "pizza", hint: "italija" },
      { word: "hamburger", hint: "brza hrana" },
      { word: "sendvic", hint: "izmedju kruha" },
      { word: "lepinja", hint: "okrugla pljosnata" },
      { word: "somun", hint: "ramazan" },
      { word: "kruh", hint: "pecenje" },
      { word: "rostilj", hint: "vatra" },
      { word: "pljeskavica", hint: "mljeveno meso" },
      { word: "rolat", hint: "kremasti zavoj" },
      { word: "supa", hint: "kasika" },
      { word: "grah", hint: "lonac" },
      { word: "pilav", hint: "riza" },
      { word: "musaka", hint: "krompir slojevi" },
      { word: "punjene paprike", hint: "rajcica iznutra" },
      { word: "feluga", hint: "pjenasti kolac" },
      { word: "tulumbe", hint: "topli sirup" },
    ],
  },
  {
    category: "Pice",
    words: [
      { word: "bosanska kafa", hint: "fildzan" },
      { word: "espresso", hint: "talijanski apparat" },
      { word: "nescafe", hint: "instant" },
      { word: "caj od ruze", hint: "latica" },
      { word: "salep", hint: "zima" },
      { word: "boza", hint: "kiselo zito" },
      { word: "rakija", hint: "domaca" },
      { word: "loza", hint: "groznjak" },
      { word: "sljivovica", hint: "voce iz aprila" },
      { word: "travarica", hint: "biljke" },
      { word: "pelinkovac", hint: "gorko" },
      { word: "vino", hint: "casa noge" },
      { word: "pivo", hint: "pjena" },
      { word: "sok od bazge", hint: "ljetni cvijet" },
      { word: "limunada", hint: "kiselo zuto" },
      { word: "cedevita", hint: "prah u vodi" },
      { word: "kompot", hint: "kuhano voce" },
      { word: "mlijeko", hint: "krava" },
      { word: "jogurt", hint: "uz burek" },
      { word: "kefir", hint: "fermentirano" },
      { word: "voda iz cesme", hint: "obicno" },
    ],
  },
  {
    category: "Mjesto",
    words: [
      { word: "Bascarsija", hint: "stara carsija" },
      { word: "Vijecnica", hint: "pruge fasade" },
      { word: "Sebilj", hint: "fontana golubovi" },
      { word: "Latinska cuprija", hint: "Princip" },
      { word: "Bjelasnica", hint: "olimpijada" },
      { word: "Jahorina", hint: "ski staze" },
      { word: "Trebevic", hint: "bob staza" },
      { word: "Vrelo Bosne", hint: "izvor" },
      { word: "Skenderija", hint: "dvorana" },
      { word: "Kosevo", hint: "stadion" },
      { word: "Marindvor", hint: "tornjevi" },
      { word: "Ilidza", hint: "termalni izvori" },
      { word: "Mostarski most", hint: "skakaci" },
      { word: "Pocitelj", hint: "kamene kule" },
      { word: "Kravice", hint: "vodopadi" },
      { word: "Una", hint: "smaragdna rijeka" },
      { word: "Plivska jezera", hint: "Jajce blizu" },
      { word: "Travnik", hint: "Andric grad" },
      { word: "Jajce", hint: "vodopad u gradu" },
      { word: "Visegrad", hint: "cuprija na Drini" },
      { word: "Banja Luka", hint: "Vrbas" },
      { word: "Tuzla", hint: "so" },
      { word: "Zenica", hint: "celicana" },
      { word: "Brcko", hint: "distrikt" },
      { word: "pijaca Markale", hint: "tezge" },
      { word: "kino", hint: "ekran u mraku" },
      { word: "aerodrom", hint: "pista" },
      { word: "biblioteka", hint: "tihe police" },
      { word: "stadion", hint: "navijaci" },
      { word: "hotel", hint: "kljuc na recepciji" },
      { word: "pekara", hint: "rani jutarnji miris" },
      { word: "ascinica", hint: "domaca jela" },
      { word: "kafana", hint: "muzika i dim" },
      { word: "dzamija", hint: "minaret" },
      { word: "crkva", hint: "zvonik" },
      { word: "tekija", hint: "dervisi" },
      { word: "hamam", hint: "para" },
      { word: "carsija", hint: "tezge i radnje" },
      { word: "skola", hint: "tabla i kreda" },
      { word: "fakultet", hint: "predavaonica" },
      { word: "vrtic", hint: "mali stolicii" },
      { word: "bolnica", hint: "bijela odjeca" },
      { word: "groblje", hint: "nisani" },
      { word: "park", hint: "klupe" },
      { word: "plaza", hint: "pijesak" },
    ],
  },
  {
    category: "Predmet",
    words: [
      { word: "fildzan", hint: "bez drske" },
      { word: "dzezva", hint: "duga drska" },
      { word: "tepsija", hint: "pec za pitu" },
      { word: "saksija", hint: "biljka unutra" },
      { word: "merdzan", hint: "perle" },
      { word: "tespih", hint: "33 zrna" },
      { word: "fes", hint: "crvena kapa" },
      { word: "dimije", hint: "siroke hlace" },
      { word: "tarabe", hint: "drvena ograda" },
      { word: "casa", hint: "voda unutra" },
      { word: "kasika", hint: "supa" },
      { word: "ibrik", hint: "lijevanje vode" },
      { word: "lonac", hint: "kuhinja" },
      { word: "sahan", hint: "okrugla zdjela" },
      { word: "telefon", hint: "ekran u dzepu" },
      { word: "daljinski", hint: "TV" },
      { word: "punjac", hint: "kabel" },
      { word: "naocale", hint: "stakla pred ocima" },
      { word: "novcanik", hint: "novci kartice" },
      { word: "kljucevi", hint: "brava" },
      { word: "kofer", hint: "putovanje" },
      { word: "kisobran", hint: "padavine" },
      { word: "gitara", hint: "zice" },
      { word: "harmonika", hint: "mijeh" },
      { word: "saz", hint: "dugi vrat" },
      { word: "saharica", hint: "secer" },
      { word: "tava", hint: "prizeno" },
      { word: "klompe", hint: "drvene" },
      { word: "papuce", hint: "kuca" },
      { word: "marama", hint: "oko glave" },
      { word: "sat", hint: "kazaljke" },
      { word: "kamera", hint: "objektiv" },
      { word: "knjiga", hint: "stranice" },
      { word: "biljeznica", hint: "linije" },
      { word: "olovka", hint: "pisanje" },
      { word: "kreda", hint: "tabla" },
    ],
  },
  {
    category: "Aktivnost",
    words: [
      { word: "kafenisanje", hint: "muhabet uz solju" },
      { word: "muhabet", hint: "duga prica" },
      { word: "ferijati", hint: "ljetna pauza" },
      { word: "izlet na Vrelo Bosne", hint: "fijaker" },
      { word: "rostiljada", hint: "dim u dvoristu" },
      { word: "teferic", hint: "izlet u prirodi" },
      { word: "ramazanski iftar", hint: "iza zalaska" },
      { word: "bajramska sofra", hint: "praznicni sto" },
      { word: "sevdah pjevanje", hint: "tugovanje" },
      { word: "kolo", hint: "krug igraca" },
      { word: "korzo", hint: "veceri carsije" },
      { word: "navijanje", hint: "ural i pjevanje" },
      { word: "skijanje", hint: "snijeg" },
      { word: "plivanje", hint: "voda" },
      { word: "kuhanje", hint: "lonac na stednjaku" },
      { word: "pecenje kafe", hint: "miris" },
      { word: "ribolov", hint: "strpljenje" },
      { word: "planinarenje", hint: "ranac" },
      { word: "kampovanje", hint: "sator" },
      { word: "karaoke", hint: "mikrofon" },
      { word: "trcanje", hint: "patike" },
      { word: "ples", hint: "ritam" },
      { word: "fudbal", hint: "lopta i mreza" },
      { word: "kosarka", hint: "kos" },
      { word: "sah", hint: "polje" },
      { word: "tablic", hint: "karte u dvije" },
      { word: "remi", hint: "set karata" },
      { word: "domine", hint: "tackice" },
      { word: "igranje pikada", hint: "meta" },
      { word: "selfi", hint: "okrenuta kamera" },
      { word: "subotnji rucak kod nene", hint: "miris doma" },
    ],
  },
  {
    category: "Lik",
    words: [
      { word: "komsija", hint: "preko zida" },
      { word: "raja", hint: "drustvo" },
      { word: "baja", hint: "stara skola" },
      { word: "deda", hint: "sjeda kosa" },
      { word: "nena", hint: "marama u kuhinji" },
      { word: "amidza", hint: "babin brat" },
      { word: "tetka", hint: "majcina sestra" },
      { word: "daidza", hint: "majcin brat" },
      { word: "snaha", hint: "novodosla" },
      { word: "punica", hint: "zenina majka" },
      { word: "kum", hint: "svadba i krstenje" },
      { word: "imam", hint: "vodja namaza" },
      { word: "hodza", hint: "vjeronauka" },
      { word: "softa", hint: "ucenik medrese" },
      { word: "carsijska gospoda", hint: "fini sesir" },
      { word: "burazer", hint: "drug iz raje" },
      { word: "frajer", hint: "kicos" },
      { word: "fora", hint: "duhovit lik" },
      { word: "lola", hint: "sevdalija u snu" },
      { word: "sevdalija", hint: "duga pjesma" },
      { word: "navijac", hint: "sal i bubanj" },
      { word: "taksista", hint: "zuti auto" },
      { word: "konobar", hint: "krpa o ramenu" },
      { word: "kelner", hint: "donosi pivo" },
      { word: "pekar", hint: "rano ustaje" },
      { word: "kasapin", hint: "noz i tezga" },
      { word: "berber", hint: "skare i britva" },
      { word: "doktor", hint: "bijeli mantil" },
      { word: "profesor", hint: "stipla u kabinetu" },
      { word: "policajac", hint: "uniforma" },
      { word: "vatrogasac", hint: "crijevo" },
      { word: "pilot", hint: "kabina iznad oblaka" },
      { word: "glumac", hint: "uloga" },
      { word: "pjevac", hint: "mikrofon i scena" },
      { word: "detektiv", hint: "lupa" },
      { word: "filmadzija", hint: "kamera na ramenu" },
      { word: "youtuber", hint: "kanal i pretplata" },
      { word: "predsjednik", hint: "govor s pozornice" },
      { word: "domar", hint: "kljuc kotlovnice" },
      { word: "carobnjak", hint: "stap i ples" },
    ],
  },
  {
    category: "Pojam",
    words: [
      { word: "sevdah", hint: "duboka ceznja" },
      { word: "merak", hint: "tihi uzitak" },
      { word: "rahatluk", hint: "potpuni mir" },
      { word: "cejf", hint: "raspolozenje" },
      { word: "adet", hint: "obicaj" },
      { word: "kismet", hint: "sudbina" },
      { word: "ahbab", hint: "prijatelj" },
      { word: "dert", hint: "tuga u dusi" },
      { word: "sabur", hint: "strpljenje" },
      { word: "berecat", hint: "blagoslov" },
      { word: "halal", hint: "dozvoljeno" },
      { word: "haram", hint: "zabranjeno" },
      { word: "inshallah", hint: "ako Bog da" },
      { word: "mashallah", hint: "kako je lijepo" },
      { word: "selam", hint: "pozdrav" },
      { word: "merhaba", hint: "dobar dan" },
      { word: "akrep", hint: "lukav lik" },
      { word: "belaj", hint: "nevolja" },
      { word: "kolajna", hint: "ogrlica" },
      { word: "bujrum", hint: "izvolite" },
      { word: "fasung", hint: "okrznut" },
      { word: "balkon na cetvrtom spratu", hint: "pogled niz ulicu" },
      { word: "snijeg u aprilu", hint: "neocekivano" },
      { word: "ramazan", hint: "mjesec posta" },
      { word: "bajram", hint: "tri dana slavlja" },
      { word: "nova godina", hint: "vatromet u ponoc" },
      { word: "svadba", hint: "bijela haljina" },
      { word: "tevhid", hint: "spomen umrlih" },
      { word: "akika", hint: "rodjenje djeteta" },
      { word: "imendan", hint: "ime i slavlje" },
      { word: "matura", hint: "kraj srednje" },
    ],
  },
  {
    category: "Zivotinja",
    words: [
      { word: "macka", hint: "prede" },
      { word: "pas", hint: "vjernost" },
      { word: "kornjaca", hint: "oklop" },
      { word: "konj", hint: "potkovica" },
      { word: "magarac", hint: "njak" },
      { word: "krava", hint: "vime" },
      { word: "ovca", hint: "vuna" },
      { word: "koza", hint: "rogovi" },
      { word: "kokos", hint: "jaja" },
      { word: "patka", hint: "gega po vodi" },
      { word: "guska", hint: "perje za jastuk" },
      { word: "puran", hint: "kruna na glavi" },
      { word: "lav", hint: "griva" },
      { word: "tigar", hint: "pruge" },
      { word: "medvjed", hint: "zimski san" },
      { word: "vuk", hint: "cezi" },
      { word: "lisica", hint: "lukava" },
      { word: "jez", hint: "bodlje" },
      { word: "vjeverica", hint: "lijesnik" },
      { word: "zec", hint: "duge usi" },
      { word: "miss", hint: "siri" },
      { word: "pacov", hint: "kanalizacija" },
      { word: "slijepi mis", hint: "leti nocu" },
      { word: "orao", hint: "kruzi iznad" },
      { word: "soko", hint: "brzi let" },
      { word: "vrabac", hint: "cvrkut" },
      { word: "golub", hint: "trg" },
      { word: "roda", hint: "dimnjak" },
      { word: "pcela", hint: "kosnica" },
      { word: "leptir", hint: "krila u boji" },
      { word: "komarac", hint: "ljetna nedaca" },
      { word: "muha", hint: "zuji" },
      { word: "pauk", hint: "mreza" },
      { word: "skorpija", hint: "rep s zaokom" },
      { word: "kit", hint: "mlaz vode" },
      { word: "delfin", hint: "skace iz mora" },
      { word: "som", hint: "brkovi pod vodom" },
      { word: "pastrmka", hint: "potocna" },
    ],
  },
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isPhase(value: unknown): value is Phase {
  return value === "reveal" || value === "clues" || value === "vote" || value === "result";
}

function isRole(value: unknown): value is Role {
  return value === "crew" || value === "impostor";
}

function isImposteriIntent(value: unknown): value is ImposteriIntent {
  if (!isRecord(value) || typeof value.kind !== "string") return false;
  if (value.kind === "cast-vote") return typeof value.targetId === "string";
  return (
    value.kind === "advance-phase" ||
    value.kind === "start-round" ||
    value.kind === "resolve-vote"
  );
}

function pickOne<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function emptyPlayerMap<T>(playerIds: string[], value: () => T): Record<string, T> {
  return Object.fromEntries(playerIds.map((id) => [id, value()]));
}

function pickWord(previousSecretWord = "") {
  const category = pickOne(WORD_DECK);
  const candidates = category.words.filter((entry) => entry.word !== previousSecretWord);
  const choice = pickOne(candidates.length > 0 ? candidates : category.words);
  return {
    category: category.category,
    secretWord: choice.word,
    impostorHint: choice.hint,
  };
}

function createRoles(playerIds: string[]): Record<string, Role> {
  if (playerIds.length === 0) return {};
  const impostorId = pickOne(playerIds);
  return Object.fromEntries(
    playerIds.map((id) => [id, id === impostorId ? "impostor" : "crew"]),
  );
}

function startRound(
  current: Pick<ImposteriState, "hostId" | "scores" | "round" | "secretWord">,
  playerIds: string[],
): ImposteriState {
  const { category, secretWord, impostorHint } = pickWord(current.secretWord);
  const startPlayerId = playerIds.length > 0 ? pickOne(playerIds) : null;
  return {
    phase: "reveal",
    category,
    secretWord,
    impostorHint,
    roles: createRoles(playerIds),
    startPlayerId,
    votes: {},
    voteDeadlineAt: null,
    scores: emptyPlayerMap(playerIds, () => 0),
    result: null,
    round: current.round + 1,
    hostId: current.hostId,
  };
}

function normalizeStringMap(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

function normalizeNumberMap(value: unknown, playerIds: string[]): Record<string, number> {
  const raw = isRecord(value) ? value : {};
  return Object.fromEntries(
    playerIds.map((playerId) => {
      const score = raw[playerId];
      return [playerId, typeof score === "number" && Number.isFinite(score) ? score : 0];
    }),
  );
}

function normalizeRoles(value: unknown): Record<string, Role> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, Role] => isRole(entry[1])),
  );
}

function normalizeStringNumberMap(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, number] =>
        typeof entry[1] === "number" && Number.isFinite(entry[1]),
    ),
  );
}

function normalizeResult(value: unknown): ImposteriRoundResult | null {
  if (!isRecord(value)) return null;
  return {
    ejectedPlayerId: typeof value.ejectedPlayerId === "string" ? value.ejectedPlayerId : null,
    tiedPlayerIds: Array.isArray(value.tiedPlayerIds)
      ? value.tiedPlayerIds.filter((id): id is string => typeof id === "string")
      : [],
    crewWon: value.crewWon === true,
    impostorIds: Array.isArray(value.impostorIds)
      ? value.impostorIds.filter((id): id is string => typeof id === "string")
      : [],
    secretWord: typeof value.secretWord === "string" ? value.secretWord : "",
    category: typeof value.category === "string" ? value.category : "",
    voteCounts: normalizeStringNumberMap(value.voteCounts),
    timedOut: value.timedOut === true,
  };
}

function normalizeState(state: ImposteriState): ImposteriState {
  const roles = normalizeRoles(state.roles);
  const playerIds = Object.keys(roles);
  const safePlayerIds = playerIds.length >= 3 ? playerIds : Object.keys(state.votes ?? {});
  const basePlayerIds = safePlayerIds.length >= 3 ? safePlayerIds : playerIds;
  const normalizedRoles =
    basePlayerIds.length > 0 && Object.values(roles).includes("impostor")
      ? roles
      : createRoles(basePlayerIds);
  const normalizedPlayerIds = Object.keys(normalizedRoles);
  const fallbackWord = pickWord(state.secretWord);
  const startPlayerId =
    typeof state.startPlayerId === "string" && normalizedRoles[state.startPlayerId]
      ? state.startPlayerId
      : normalizedPlayerIds.length > 0
        ? pickOne(normalizedPlayerIds)
        : null;

  return {
    phase: isPhase(state.phase) ? state.phase : "reveal",
    category:
      typeof state.category === "string" && state.category.length > 0
        ? state.category
        : fallbackWord.category,
    secretWord:
      typeof state.secretWord === "string" && state.secretWord.length > 0
        ? state.secretWord
        : fallbackWord.secretWord,
    impostorHint:
      typeof state.impostorHint === "string" && state.impostorHint.length > 0
        ? state.impostorHint
        : fallbackWord.impostorHint,
    roles: normalizedRoles,
    startPlayerId,
    votes: normalizeStringMap(state.votes),
    voteDeadlineAt:
      typeof state.voteDeadlineAt === "string" && state.voteDeadlineAt.length > 0
        ? state.voteDeadlineAt
        : null,
    scores: normalizeNumberMap(state.scores, normalizedPlayerIds),
    result: normalizeResult(state.result),
    round: typeof state.round === "number" && state.round > 0 ? Math.floor(state.round) : 1,
    hostId: typeof state.hostId === "string" ? state.hostId : normalizedPlayerIds[0] ?? "",
  };
}

function knownPlayerIds(state: ImposteriState): string[] {
  return Object.keys(state.roles);
}

function isKnownPlayer(state: ImposteriState, playerId: string): boolean {
  return state.roles[playerId] !== undefined;
}

function allVotesSubmitted(state: ImposteriState): boolean {
  return knownPlayerIds(state).every((playerId) => Boolean(state.votes[playerId]));
}

function resolveVotes(state: ImposteriState, timedOut: boolean): ImposteriState {
  const playerIds = knownPlayerIds(state);
  const voteCounts = emptyPlayerMap(playerIds, () => 0);
  for (const targetId of Object.values(state.votes)) {
    if (voteCounts[targetId] !== undefined) voteCounts[targetId] += 1;
  }

  const highestVoteCount = Math.max(0, ...Object.values(voteCounts));
  const tiedPlayerIds =
    highestVoteCount > 0
      ? Object.entries(voteCounts)
          .filter(([, count]) => count === highestVoteCount)
          .map(([playerId]) => playerId)
      : [];

  const impostorIds = playerIds.filter((playerId) => state.roles[playerId] === "impostor");
  const cleanPlurality = tiedPlayerIds.length === 1;
  const ejectedPlayerId = cleanPlurality ? tiedPlayerIds[0] : null;

  // Tie or no votes → impostor wins. Clean plurality on impostor → crew wins.
  const crewWon = cleanPlurality && state.roles[ejectedPlayerId!] === "impostor";

  const scores = { ...state.scores };
  for (const playerId of playerIds) {
    if (
      (crewWon && state.roles[playerId] === "crew") ||
      (!crewWon && state.roles[playerId] === "impostor")
    ) {
      scores[playerId] = (scores[playerId] ?? 0) + 1;
    }
  }

  return {
    ...state,
    phase: "result",
    voteDeadlineAt: null,
    scores,
    result: {
      ejectedPlayerId,
      tiedPlayerIds: cleanPlurality ? [] : tiedPlayerIds,
      crewWon,
      impostorIds,
      secretWord: state.secretWord,
      category: state.category,
      voteCounts,
      timedOut,
    },
  };
}

export const imposteriModule: GameModule<ImposteriState, ImposteriIntent, ImposteriView> = {
  id: "imposteri",
  displayName: "Imposteri",
  tagline: "Find who doesn't know the secret word.",
  minPlayers: 3,
  maxPlayers: 12,

  initialState: ({ playerIds, hostId }) => {
    return startRound(
      {
        hostId,
        scores: emptyPlayerMap(playerIds, () => 0),
        round: 0,
        secretWord: "",
      },
      playerIds,
    );
  },

  reduce: (state, rawIntent, ctx) => {
    if (!isImposteriIntent(rawIntent)) throw new Error("Invalid Imposteri action.");
    const intent = rawIntent;
    const current = normalizeState(state);

    if (!isKnownPlayer(current, ctx.playerId)) {
      throw new Error("Player is not in this round.");
    }

    if (intent.kind === "start-round") {
      if (ctx.playerId !== current.hostId) throw new Error("Only the host can start a round.");
      if (current.phase !== "result") throw new Error("Finish the current round first.");
      const nextPlayerIds = ctx.playerIds.length > 0 ? ctx.playerIds : knownPlayerIds(current);
      const nextScores = emptyPlayerMap(nextPlayerIds, () => 0);
      for (const playerId of nextPlayerIds) {
        nextScores[playerId] = current.scores[playerId] ?? 0;
      }
      return {
        ...startRound(current, nextPlayerIds),
        scores: nextScores,
      };
    }

    if (intent.kind === "advance-phase") {
      if (ctx.playerId !== current.hostId) throw new Error("Only the host can advance the game.");
      if (current.phase === "reveal") {
        return { ...current, phase: "clues" };
      }
      if (current.phase === "clues") {
        const deadline = new Date(ctx.now.getTime() + VOTE_DURATION_SECONDS * 1000);
        return {
          ...current,
          phase: "vote",
          votes: {},
          voteDeadlineAt: deadline.toISOString(),
        };
      }
      throw new Error("Nothing to advance right now.");
    }

    if (intent.kind === "resolve-vote") {
      if (current.phase !== "vote") throw new Error("Voting is not open right now.");
      const deadline = current.voteDeadlineAt ? new Date(current.voteDeadlineAt) : null;
      const expired = !!deadline && ctx.now.getTime() >= deadline.getTime();
      const everyoneVoted = allVotesSubmitted(current);
      if (!expired && !everyoneVoted) {
        throw new Error("Voting is still open.");
      }
      return resolveVotes(current, expired && !everyoneVoted);
    }

    if (current.phase !== "vote") throw new Error("Voting is not open right now.");
    if (!isKnownPlayer(current, intent.targetId)) throw new Error("Unknown player.");
    if (intent.targetId === ctx.playerId) throw new Error("You cannot vote for yourself.");
    const deadline = current.voteDeadlineAt ? new Date(current.voteDeadlineAt) : null;
    if (deadline && ctx.now.getTime() >= deadline.getTime()) {
      // Deadline has passed — refuse new votes, resolve with what we have.
      return resolveVotes(current, true);
    }
    const next = {
      ...current,
      votes: {
        ...current.votes,
        [ctx.playerId]: intent.targetId,
      },
    };
    return allVotesSubmitted(next) ? resolveVotes(next, false) : next;
  },

  redact: (state, playerId): ImposteriView => {
    const current = normalizeState(state);
    const isInRound = current.roles[playerId] !== undefined;
    const myRole: Role = isInRound ? current.roles[playerId] : "crew";
    const result = current.phase === "result" ? current.result : null;
    const showSecret = isInRound && (myRole === "crew" || current.phase === "result");

    const showHint = isInRound && myRole === "impostor" && current.phase !== "result";

    return {
      phase: current.phase,
      myRole,
      category: current.category,
      secretWord: showSecret ? current.secretWord : null,
      impostorHint: showHint ? current.impostorHint : null,
      startPlayerId: current.startPlayerId,
      myVote: current.votes[playerId] ?? null,
      votedPlayerIds: Object.keys(current.votes),
      votes: current.phase === "result" ? current.votes : {},
      voteDeadlineAt: current.phase === "vote" ? current.voteDeadlineAt : null,
      voteDurationSeconds: VOTE_DURATION_SECONDS,
      scores: current.scores,
      result,
      round: current.round,
      isHost: playerId === current.hostId,
      isInRound,
    };
  },

  ClientComponent: ImposteriClient,
};
