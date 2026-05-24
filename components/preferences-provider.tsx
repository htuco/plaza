"use client";

import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { GameId } from "@/lib/db/schema";

export type ThemePreference = "light" | "dark";
export type LanguagePreference = "en" | "bs";

type TranslationArg = string | number;
type TranslationEntry = string | ((...args: TranslationArg[]) => string);
type GameCopy = {
  displayName: string;
  tagline: string;
};
type GameDetails = {
  rules: string[];
  example: string;
};
type PreferencesSnapshot = {
  theme: ThemePreference;
  language: LanguagePreference;
};

const THEME_KEY = "plaza-theme";
const LANGUAGE_KEY = "plaza-language";

const translations: Record<LanguagePreference, Record<string, TranslationEntry>> = {
  en: {
    "prefs.theme": "Theme",
    "prefs.light": "Light",
    "prefs.dark": "Dark",
    "prefs.language": "Language",
    "home.subtitle": "Party games for the crew. Send a room code, start playing.",
    "home.startRoom": "Start a room",
    "home.joinRoom": "Join a room",
    "home.games": "Games",
    "home.footer": "built for the crew",
    "form.nickname": "Player name",
    "form.nicknamePlaceholder": "Player name",
    "form.roomCode": "Room code",
    "form.roomCodePlaceholder": "ABCDE",
    "form.startRoom": "Start a room",
    "form.join": "Join",
    "game.soon": "Soon",
    "game.rules": "Rules",
    "game.example": "Example",
    "lobby.roomCode": "Room code",
    "lobby.playingAs": "Playing as",
    "lobby.host": "host",
    "lobby.players": (count) => `Players (${count})`,
    "lobby.pickGame": "Pick a game",
    "lobby.startGame": "Start game",
    "lobby.needPlayers": (count) => `Need at least ${count} players to start.`,
    "lobby.gameComingSoon": "This game is coming soon.",
    "lobby.pickGameFirst": "Pick a game first.",
    "lobby.waitingForHostGame": "Waiting for the host to pick and start a game.",
    "notFound.title": "Room not found",
    "notFound.body": "Double-check the code, or start a new room.",
    "notFound.back": "Back to Plaza",
    "placeholder.roomNotReady": (roomCode) => `Room ${roomCode} - gameplay not yet implemented.`,
    "placeholder.asocijacije": (roomCode) => `Room ${roomCode} - board not yet implemented.`,
    "placeholder.guessTheSong": (roomCode) =>
      `Room ${roomCode} - Spotify auth + iTunes preview pipeline not yet implemented.`,
    "gradovi.phase.setup": "Settings",
    "gradovi.phase.writing": "Writing",
    "gradovi.phase.review": "Review answers",
    "gradovi.phase.finished": "Final scores",
    "gradovi.phase.reveal": "Results",
    "gradovi.timer": "Time",
    "gradovi.timerWarning": "Time is almost up",
    "gradovi.timeUp": "Time is up",
    "gradovi.timeUpNote": "Answers are locking now.",
    "gradovi.notice.gameStart": "Game starts",
    "gradovi.notice.newRound": "New round",
    "gradovi.notice.letter": (letter) => `Letter ${letter}`,
    "gradovi.notice.final": "Final scores",
    "gradovi.notice.finalNote": "The game is complete.",
    "gradovi.settings.title": "Game settings",
    "gradovi.settings.roundTime": "Round time",
    "gradovi.settings.rounds": "Rounds",
    "gradovi.settings.seconds": "sec",
    "gradovi.settings.note": (minSeconds, maxRounds) =>
      `Minimum round time is ${minSeconds}s. Max ${maxRounds} rounds.`,
    "gradovi.categories.optional": "Optional categories",
    "gradovi.categories.selected": (count) => `${count} categories`,
    "gradovi.round": (round, total) => `Round ${round}/${total}`,
    "gradovi.submitted": (count, total) => `Submitted ${count}/${total}`,
    "gradovi.locked": "Your answers are locked.",
    "gradovi.saveSettings": "Save settings",
    "gradovi.startRound": (round) => `Start round ${round}`,
    "gradovi.waitStartRound": (round) => `Waiting for the host to start round ${round}.`,
    "gradovi.answerPlaceholder": (category, letter) => `${category} on ${letter}`,
    "gradovi.saving": "Saving...",
    "gradovi.submitAnswers": "Submit answers",
    "gradovi.reveal": "Reveal",
    "gradovi.scoreboard": "Scoreboard",
    "gradovi.answers": "Answers",
    "gradovi.you": "you",
    "gradovi.reportCount": (count) => `${count} report${Number(count) === 1 ? "" : "s"}`,
    "gradovi.status.review": "review",
    "gradovi.status.valid": "valid",
    "gradovi.status.invalid": "invalid",
    "gradovi.valid": "Valid",
    "gradovi.invalid": "Invalid",
    "gradovi.report": "Report",
    "gradovi.reported": "Reported",
    "gradovi.aiCheck": "AI check",
    "gradovi.aiChecking": "Checking...",
    "gradovi.lockScores": "Lock scores",
    "gradovi.waitingHostReview": "Waiting for host review",
    "gradovi.backToLaunchpad": "Back to launchpad",
    "gradovi.waitingForHost": "Waiting for host",
    "gradovi.hostCloseNote": "The host can close this session for everyone.",
    "imposteri.phase.reveal": "Reveal roles",
    "imposteri.phase.clues": "Give clues",
    "imposteri.phase.vote": "Vote",
    "imposteri.phase.result": "Result",
    "imposteri.round": (round) => `Round ${round}`,
    "imposteri.role.crew": "Crew",
    "imposteri.role.impostor": "Impostor",
    "imposteri.yourInfo": "Your card",
    "imposteri.category": "Category",
    "imposteri.secretWord": "Secret word",
    "imposteri.secretHidden": "Hidden",
    "imposteri.impostorHintLabel": "Your hint",
    "imposteri.impostorHint": "Blend in, read the room, and survive the vote.",
    "imposteri.crewHint": "Give clues carefully and find who does not know the word.",
    "imposteri.notInRound": "You joined after this round started. Wait for the next round.",
    "imposteri.startClues": "Start clues",
    "imposteri.waitingHost": "Waiting for host",
    "imposteri.submitted": (count, total) => `${count}/${total} voted`,
    "imposteri.startVote": "Start vote",
    "imposteri.waitingHostVote": "Waiting for the host to open voting.",
    "imposteri.vote": "Vote for the impostor",
    "imposteri.voteHint": "Tap a player to lock in your vote. Time out = impostor wins.",
    "imposteri.voted": "voted",
    "imposteri.timeLeft": "Time",
    "imposteri.cluesOfflineHint":
      "Go around the table — say one related word for the secret. Two passes, then vote.",
    "imposteri.firstPlayer": "First to clue",
    "imposteri.voteTimedOut": "Time ran out before a clear vote — impostor wins.",
    "imposteri.overlay.clues.kicker": "Round",
    "imposteri.overlay.clues.title": "Clues begin",
    "imposteri.overlay.clues.note": "Two passes around the table.",
    "imposteri.overlay.vote.kicker": "Vote",
    "imposteri.overlay.vote.title": "Voting starts",
    "imposteri.overlay.vote.note": "Pick the impostor before time runs out.",
    "imposteri.overlay.victory.kicker": "You won",
    "imposteri.overlay.defeat.kicker": "You lost",
    "imposteri.overlay.victory.note": "+1 point for your team.",
    "imposteri.overlay.defeat.note": "Better luck next round.",
    "imposteri.overlay.crewCaught.title": "Impostor caught",
    "imposteri.overlay.impostorEscaped.title": "Impostor escaped",
    "imposteri.crewWon": "Crew caught the impostor",
    "imposteri.impostorsWon": "Impostor escaped",
    "imposteri.ejected": (name) => `${name} was voted out.`,
    "imposteri.noEjection": "The vote was tied, so the impostor wins.",
    "imposteri.impostors": "Impostors",
    "imposteri.votes": "Votes",
    "imposteri.nextRound": "Next round",
    "error.generic": "Something went wrong.",
  },
  bs: {
    "prefs.theme": "Tema",
    "prefs.light": "Svijetla",
    "prefs.dark": "Tamna",
    "prefs.language": "Jezik",
    "home.subtitle": "Party igre za raju. Pošalji kod sobe i krenite igrati.",
    "home.startRoom": "Napravi sobu",
    "home.joinRoom": "Uđi u sobu",
    "home.games": "Igre",
    "home.footer": "napravljeno za raju",
    "form.nickname": "Ime igrača",
    "form.nicknamePlaceholder": "Ime igrača",
    "form.roomCode": "Kod sobe",
    "form.roomCodePlaceholder": "ABCDE",
    "form.startRoom": "Napravi sobu",
    "form.join": "Uđi",
    "game.soon": "Uskoro",
    "game.rules": "Pravila",
    "game.example": "Primjer",
    "lobby.roomCode": "Kod sobe",
    "lobby.playingAs": "Igraš kao",
    "lobby.host": "host",
    "lobby.players": (count) => `Igrači (${count})`,
    "lobby.pickGame": "Izaberi igru",
    "lobby.startGame": "Pokreni igru",
    "lobby.needPlayers": (count) => `Treba najmanje ${count} igrača za start.`,
    "lobby.gameComingSoon": "Ova igra dolazi uskoro.",
    "lobby.pickGameFirst": "Prvo izaberi igru.",
    "lobby.waitingForHostGame": "Čekamo hosta da izabere i pokrene igru.",
    "notFound.title": "Soba nije pronađena",
    "notFound.body": "Provjeri kod ili napravi novu sobu.",
    "notFound.back": "Nazad na Plazu",
    "placeholder.roomNotReady": (roomCode) => `Soba ${roomCode} - gameplay još nije napravljen.`,
    "placeholder.asocijacije": (roomCode) => `Soba ${roomCode} - tabla još nije napravljena.`,
    "placeholder.guessTheSong": (roomCode) =>
      `Soba ${roomCode} - Spotify auth + iTunes preview još nisu napravljeni.`,
    "gradovi.phase.setup": "Postavke",
    "gradovi.phase.writing": "Pisanje",
    "gradovi.phase.review": "Pregled odgovora",
    "gradovi.phase.finished": "Konačni rezultat",
    "gradovi.phase.reveal": "Rezultati",
    "gradovi.timer": "Vrijeme",
    "gradovi.timerWarning": "Vrijeme ističe",
    "gradovi.timeUp": "Vrijeme je isteklo",
    "gradovi.timeUpNote": "Odgovori se zaključavaju.",
    "gradovi.notice.gameStart": "Igra počinje",
    "gradovi.notice.newRound": "Nova runda",
    "gradovi.notice.letter": (letter) => `Slovo ${letter}`,
    "gradovi.notice.final": "Konačni rezultat",
    "gradovi.notice.finalNote": "Igra je završena.",
    "gradovi.settings.title": "Postavke igre",
    "gradovi.settings.roundTime": "Vrijeme runde",
    "gradovi.settings.rounds": "Runde",
    "gradovi.settings.seconds": "sek",
    "gradovi.settings.note": (minSeconds, maxRounds) =>
      `Minimalno vrijeme runde je ${minSeconds}s. Maksimalno ${maxRounds} rundi.`,
    "gradovi.categories.optional": "Dodatne kategorije",
    "gradovi.categories.selected": (count) => `${count} kategorija`,
    "gradovi.round": (round, total) => `Runda ${round}/${total}`,
    "gradovi.submitted": (count, total) => `Predano ${count}/${total}`,
    "gradovi.locked": "Tvoji odgovori su zaključani.",
    "gradovi.saveSettings": "Sačuvaj postavke",
    "gradovi.startRound": (round) => `Pokreni rundu ${round}`,
    "gradovi.waitStartRound": (round) => `Čekamo hosta da pokrene rundu ${round}.`,
    "gradovi.answerPlaceholder": (category, letter) => `${category} na ${letter}`,
    "gradovi.saving": "Spašavam...",
    "gradovi.submitAnswers": "Predaj odgovore",
    "gradovi.reveal": "Otkrij",
    "gradovi.scoreboard": "Tabela",
    "gradovi.answers": "Odgovori",
    "gradovi.you": "ti",
    "gradovi.reportCount": (count) =>
      `${count} ${Number(count) === 1 ? "prijava" : "prijava"}`,
    "gradovi.status.review": "pregled",
    "gradovi.status.valid": "ispravno",
    "gradovi.status.invalid": "neispravno",
    "gradovi.valid": "Ispravno",
    "gradovi.invalid": "Neispravno",
    "gradovi.report": "Prijavi",
    "gradovi.reported": "Prijavljeno",
    "gradovi.aiCheck": "AI provjera",
    "gradovi.aiChecking": "Provjeravam...",
    "gradovi.lockScores": "Zaključaj bodove",
    "gradovi.waitingHostReview": "Čekamo hosta da pregleda",
    "gradovi.backToLaunchpad": "Nazad na launchpad",
    "gradovi.waitingForHost": "Čekamo hosta",
    "gradovi.hostCloseNote": "Host može zatvoriti sesiju za sve.",
    "imposteri.phase.reveal": "Otkrivanje uloga",
    "imposteri.phase.clues": "Davanje hintova",
    "imposteri.phase.vote": "Glasanje",
    "imposteri.phase.result": "Rezultat",
    "imposteri.round": (round) => `Runda ${round}`,
    "imposteri.role.crew": "Ekipa",
    "imposteri.role.impostor": "Imposter",
    "imposteri.yourInfo": "Tvoja karta",
    "imposteri.category": "Kategorija",
    "imposteri.secretWord": "Tajna riječ",
    "imposteri.secretHidden": "Sakriveno",
    "imposteri.impostorHintLabel": "Tvoj hint",
    "imposteri.impostorHint": "Uklopi se, čitaj sobu i preživi glasanje.",
    "imposteri.crewHint": "Daj pažljiv hint i pronađi ko ne zna riječ.",
    "imposteri.notInRound": "Ušao/la si nakon početka runde. Čekaj sljedeću rundu.",
    "imposteri.startClues": "Kreni sa hintovima",
    "imposteri.waitingHost": "Čekamo hosta",
    "imposteri.submitted": (count, total) => `${count}/${total} glasalo`,
    "imposteri.startVote": "Pokreni glasanje",
    "imposteri.waitingHostVote": "Čekamo hosta da otvori glasanje.",
    "imposteri.vote": "Glasaj za impostera",
    "imposteri.voteHint":
      "Tapni igrača da daš glas. Ako vrijeme istekne — imposter pobjeđuje.",
    "imposteri.voted": "glasao/la",
    "imposteri.timeLeft": "Vrijeme",
    "imposteri.cluesOfflineHint":
      "Idite ukrug — svako kaže jednu srodnu riječ za tajnu. Dva kruga, pa glasanje.",
    "imposteri.firstPlayer": "Prvi/a daje hint",
    "imposteri.voteTimedOut": "Vrijeme je isteklo — imposter pobjeđuje.",
    "imposteri.overlay.clues.kicker": "Runda",
    "imposteri.overlay.clues.title": "Počinju hintovi",
    "imposteri.overlay.clues.note": "Dva kruga oko stola.",
    "imposteri.overlay.vote.kicker": "Glasanje",
    "imposteri.overlay.vote.title": "Počinje glasanje",
    "imposteri.overlay.vote.note": "Pronađi impostera prije isteka vremena.",
    "imposteri.overlay.victory.kicker": "Pobijedio/la si",
    "imposteri.overlay.defeat.kicker": "Izgubio/la si",
    "imposteri.overlay.victory.note": "+1 bod za tvoj tim.",
    "imposteri.overlay.defeat.note": "Više sreće u sljedećoj rundi.",
    "imposteri.overlay.crewCaught.title": "Izbacili ste impostera",
    "imposteri.overlay.impostorEscaped.title": "Imposter je pobjegao",
    "imposteri.crewWon": "Ekipa je uhvatila impostera",
    "imposteri.impostorsWon": "Imposter je pobjegao",
    "imposteri.ejected": (name) => `${name} je izglasan/a.`,
    "imposteri.noEjection": "Glasanje je neriješeno — imposter pobjeđuje.",
    "imposteri.impostors": "Imposteri",
    "imposteri.votes": "Glasovi",
    "imposteri.nextRound": "Sljedeća runda",
    "error.generic": "Nešto je pošlo po zlu.",
  },
};

const gameCopies: Record<LanguagePreference, Record<GameId, GameCopy>> = {
  en: {
    imposteri: {
      displayName: "Imposteri",
      tagline: "Find who doesn't know the secret word.",
    },
    asocijacije: {
      displayName: "Asocijacije",
      tagline: "Crack the four columns and the final solution.",
    },
    "gradovi-i-sela": {
      displayName: "Gradovi i Sela",
      tagline: "A letter drops - race to fill the categories.",
    },
    "guess-the-song": {
      displayName: "Guess the Song",
      tagline: "Name the track before anyone else.",
    },
  },
  bs: {
    imposteri: {
      displayName: "Imposteri",
      tagline: "Pronađite ko ne zna tajnu riječ.",
    },
    asocijacije: {
      displayName: "Asocijacije",
      tagline: "Otključajte kolone i konačno rješenje.",
    },
    "gradovi-i-sela": {
      displayName: "Gradovi i Sela",
      tagline: "Slovo je izvučeno - popunite kategorije prije ostalih.",
    },
    "guess-the-song": {
      displayName: "Pogodi pjesmu",
      tagline: "Pogodi pjesmu prije ostalih.",
    },
  },
};

const gameDetails: Record<LanguagePreference, Record<GameId, GameDetails>> = {
  en: {
    imposteri: {
      rules: [
        "Everyone except the impostor sees the same secret word.",
        "Players describe the word without saying it directly.",
        "Everyone submits one clue, then the table discusses.",
        "After the discussion, vote for the player who sounds lost.",
      ],
      example:
        "Secret word: beach. Most players say sand, waves, summer. The impostor only sees the category and tries to blend in.",
    },
    asocijacije: {
      rules: [
        "The board has four columns of clues.",
        "Guess a column solution to unlock that part of the puzzle.",
        "Use all column solutions to find the final answer.",
      ],
      example:
        "Clues: sun, rain, snow, wind -> weather. Four solved columns then point to the final solution.",
    },
    "gradovi-i-sela": {
      rules: [
        "The host sets the round time and total number of rounds.",
        "Each round reveals one letter. Write one answer per category that starts with that letter.",
        "Submit before time runs out. Valid unique answers score 10, duplicated valid answers score 5.",
        "After reveal, the host reviews answers and players can report questionable ones.",
      ],
      example:
        "Letter S: city Sarajevo, country Srbija, animal slon, plant suncokret. If two players write Sarajevo, both get 5 for that category.",
    },
    "guess-the-song": {
      rules: [
        "A short song preview plays for everyone.",
        "Type the title or artist before the others.",
        "Faster correct guesses score more points.",
      ],
      example:
        "A preview starts. One player writes Billie Jean, another writes Michael Jackson; both can be accepted depending on the round settings.",
    },
  },
  bs: {
    imposteri: {
      rules: [
        "Svi osim impostera vide istu tajnu riječ.",
        "Igrači opisuju riječ bez direktnog izgovaranja.",
        "Svako preda jedan clue, pa onda ide diskusija.",
        "Nakon rasprave glasate za igrača koji zvuči izgubljeno.",
      ],
      example:
        "Tajna riječ: plaža. Većina kaže pijesak, valovi, ljeto. Imposter vidi samo kategoriju i pokušava se uklopiti.",
    },
    asocijacije: {
      rules: [
        "Tabla ima četiri kolone sa pojmovima.",
        "Pogodi rješenje kolone da otključaš taj dio slagalice.",
        "Rješenja kolona vode do konačnog rješenja.",
      ],
      example:
        "Pojmovi: sunce, kiša, snijeg, vjetar -> vrijeme. Četiri riješene kolone zatim vode do konačnog rješenja.",
    },
    "gradovi-i-sela": {
      rules: [
        "Host bira vrijeme runde i ukupan broj rundi.",
        "Svaka runda dobije jedno slovo. U svaku kategoriju upiši odgovor koji počinje tim slovom.",
        "Predaj prije isteka vremena. Ispravan jedinstven odgovor nosi 10, a duplikat 5 bodova.",
        "Nakon otkrivanja host pregleda odgovore, a igrači mogu prijaviti sumnjive odgovore.",
      ],
      example:
        "Slovo S: grad Sarajevo, država Srbija, životinja slon, biljka suncokret. Ako dvoje napišu Sarajevo, oboje dobijaju 5 za tu kategoriju.",
    },
    "guess-the-song": {
      rules: [
        "Svima se pusti kratak preview pjesme.",
        "Upiši naslov ili izvođača prije ostalih.",
        "Brži tačni odgovori nose više bodova.",
      ],
      example:
        "Krene preview. Jedan igrač upiše Billie Jean, drugi Michael Jackson; oba odgovora mogu biti prihvaćena zavisno od postavki runde.",
    },
  },
};

const localizedErrors: Record<LanguagePreference, Record<string, string>> = {
  en: {},
  bs: {
    "Pick a nickname (1–20 chars).": "Izaberi nadimak (1-20 znakova).",
    "Room code is 5 letters/digits.": "Kod sobe ima 5 slova ili brojeva.",
    "Room not found.": "Soba nije pronađena.",
    "Unknown game.": "Nepoznata igra.",
    "Room is not in lobby.": "Soba nije u lobbyju.",
    "Game already started.": "Igra je već počela.",
    "Pick a game first.": "Prvo izaberi igru.",
    "Only the host can pick a game.": "Samo host može izabrati igru.",
    "Only the host can start.": "Samo host može pokrenuti igru.",
    "Player not in room.": "Igrač nije u sobi.",
    "Only the host can close the room.": "Samo host može zatvoriti sobu.",
    "Room is not in a game.": "Soba trenutno nije u igri.",
    "Wrong game for this room.": "Pogrešna igra za ovu sobu.",
    "Room is not in Gradovi i Sela.": "Soba nije u Gradovi i Sela igri.",
    "Game state not found.": "Stanje igre nije pronađeno.",
    "Missing intent.": "Nedostaje akcija.",
    "Invalid Gradovi i Sela action.": "Neispravna Gradovi i Sela akcija.",
    "Only the host can change settings.": "Samo host može mijenjati postavke.",
    "Only the host can change categories.": "Samo host može mijenjati kategorije.",
    "Categories are locked after the game starts.": "Kategorije su zaključane nakon početka igre.",
    "Settings are locked during the round.": "Postavke su zaključane tokom runde.",
    "Game is already finished.": "Igra je već završena.",
    "Only the host can start a round.": "Samo host može pokrenuti rundu.",
    "Lock the current round first.": "Prvo zaključaj trenutnu rundu.",
    "Reveal the current round first.": "Prvo otkrij trenutnu rundu.",
    "Only the host can reveal before time runs out.": "Samo host može otkriti prije isteka vremena.",
    "Round is not accepting answers.": "Runda trenutno ne prima odgovore.",
    "Only the host can review answers.": "Samo host može pregledati odgovore.",
    "Round is not in review.": "Runda nije u pregledu.",
    "Unknown category.": "Nepoznata kategorija.",
    "Unknown player.": "Nepoznat igrač.",
    "Only the host can lock the round.": "Samo host može zaključati rundu.",
    "Only the host can run AI validation.": "Samo host može pokrenuti AI provjeru.",
    "AI validation is only available during review.": "AI provjera je dostupna samo tokom pregleda.",
    "AI validator is unavailable. Check Gemini API key or continue with host review.":
      "AI validator nije dostupan. Provjeri Gemini API key ili nastavi host pregled.",
    "AI did not return usable suggestions. Continue with host review.":
      "AI nije vratio upotrebljive prijedloge. Nastavi host pregled.",
    "Time is up.": "Vrijeme je isteklo.",
    "Answers are already submitted.": "Odgovori su već predani.",
    "Invalid Imposteri action.": "Neispravna Imposteri akcija.",
    "Player is not in this round.": "Igrač nije u ovoj rundi.",
    "Only the host can advance the game.": "Samo host može pomjeriti igru dalje.",
    "Finish the current round first.": "Prvo završi trenutnu rundu.",
    "Clues are not open right now.": "Clueovi trenutno nisu otvoreni.",
    "Write a clue first.": "Prvo napiši clue.",
    "Voting is not open right now.": "Glasanje trenutno nije otvoreno.",
    "You cannot vote for yourself.": "Ne možeš glasati za sebe.",
    "Nothing to advance right now.": "Trenutno nema šta dalje.",
    "Voting is still open.": "Glasanje je još otvoreno.",
    "Something went wrong.": "Nešto je pošlo po zlu.",
  },
};

type PreferencesContextValue = {
  theme: ThemePreference;
  language: LanguagePreference;
  setTheme: (theme: ThemePreference) => void;
  setLanguage: (language: LanguagePreference) => void;
  t: (key: string, ...args: TranslationArg[]) => string;
  gameCopy: (gameId: GameId) => GameCopy;
  gameDetails: (gameId: GameId) => GameDetails;
  localizeError: (message: string) => string;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function isTheme(value: string | null): value is ThemePreference {
  return value === "light" || value === "dark";
}

function isLanguage(value: string | null): value is LanguagePreference {
  return value === "en" || value === "bs";
}

function browserLanguage(): LanguagePreference {
  if (typeof navigator === "undefined") return "en";
  const language = navigator.languages?.[0] ?? navigator.language;
  return language?.toLowerCase().startsWith("bs") ? "bs" : "en";
}

function browserTheme(): ThemePreference {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readStoredTheme(): ThemePreference {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(THEME_KEY);
  return isTheme(stored) ? stored : browserTheme();
}

function readStoredLanguage(): LanguagePreference {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem(LANGUAGE_KEY);
  return isLanguage(stored) ? stored : browserLanguage();
}

function translate(
  language: LanguagePreference,
  key: string,
  ...args: TranslationArg[]
): string {
  const entry = translations[language][key] ?? translations.en[key] ?? key;
  return typeof entry === "function" ? entry(...args) : entry;
}

function translateError(message: string, language: LanguagePreference): string {
  const exact = localizedErrors[language][message] ?? localizedErrors.en[message];
  if (exact) return exact;

  const needPlayers = message.match(/^Need at least (\d+) players?\.?$/);
  if (needPlayers) return translate(language, "lobby.needPlayers", needPlayers[1]);

  const comingSoon = message.match(/^(.+) is coming soon\.$/);
  if (comingSoon && language === "bs") return `${comingSoon[1]} dolazi uskoro.`;

  return message;
}

const defaultSnapshot: PreferencesSnapshot = {
  theme: "light",
  language: "en",
};
let currentSnapshot = defaultSnapshot;
const listeners = new Set<() => void>();

function sameSnapshot(a: PreferencesSnapshot, b: PreferencesSnapshot): boolean {
  return a.theme === b.theme && a.language === b.language;
}

function readBrowserSnapshot(): PreferencesSnapshot {
  return {
    theme: readStoredTheme(),
    language: readStoredLanguage(),
  };
}

function emitPreferences() {
  listeners.forEach((listener) => listener());
}

function setPreferenceSnapshot(next: PreferencesSnapshot, persist: boolean) {
  if (sameSnapshot(currentSnapshot, next)) return;
  currentSnapshot = next;

  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = next.theme;
    document.documentElement.lang = next.language;
  }

  if (persist && typeof window !== "undefined") {
    window.localStorage.setItem(THEME_KEY, next.theme);
    window.localStorage.setItem(LANGUAGE_KEY, next.language);
  }

  emitPreferences();
}

function getPreferenceSnapshot() {
  return currentSnapshot;
}

function getServerPreferenceSnapshot() {
  return defaultSnapshot;
}

function subscribeToPreferences(listener: () => void) {
  listeners.add(listener);

  if (typeof window !== "undefined") {
    setPreferenceSnapshot(readBrowserSnapshot(), false);

    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_KEY || event.key === LANGUAGE_KEY) {
        setPreferenceSnapshot(readBrowserSnapshot(), false);
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  }

  return () => {
    listeners.delete(listener);
  };
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { theme, language } = useSyncExternalStore(
    subscribeToPreferences,
    getPreferenceSnapshot,
    getServerPreferenceSnapshot,
  );

  const value = useMemo<PreferencesContextValue>(
    () => ({
      theme,
      language,
      setTheme: (nextTheme) =>
        setPreferenceSnapshot({ theme: nextTheme, language }, true),
      setLanguage: (nextLanguage) =>
        setPreferenceSnapshot({ theme, language: nextLanguage }, true),
      t: (key, ...args) => translate(language, key, ...args),
      gameCopy: (gameId) => gameCopies[language][gameId] ?? gameCopies.en[gameId],
      gameDetails: (gameId) => gameDetails[language][gameId] ?? gameDetails.en[gameId],
      localizeError: (message) => translateError(message, language),
    }),
    [language, theme],
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error("usePreferences must be used inside PreferencesProvider");
  }
  return context;
}
