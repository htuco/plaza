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
    "leave.action": "Leave room",
    "leave.title": "Leave this room?",
    "leave.note": "You can rejoin anytime with the room code.",
    "leave.hostNote":
      "You are the host — hosting passes to the next player. If you're the last one, the room closes.",
    "leave.stay": "Stay",
    "leave.confirm": "Leave",
    "leave.error": "Could not leave the room. Try again.",
    "code.copyAria": (code) => `Room code ${code} — tap to copy`,
    "code.copied": "Copied!",
    "code.tapToCopy": "Tap to copy",
    "home.kicker": "Party games for game night",
    "home.playable": "Playable",
    "home.players": (min, max) => `${min}–${max} players`,
    "home.heroNote": "No installs, no accounts. One room code and everyone's in.",
    "lobby.shareCode": "Share the code with your crew",
    "lobby.waitingForPlayers": "Waiting for more players to join…",
    "lobby.selectedGame": "Selected game",
    "lobby.hostControls": "Host controls",
    "alias.phase.setup": "Setup",
    "alias.roundOf": (round, total) => `Round ${round}/${total}`,
    "alias.setupTitle": "Teams & settings",
    "alias.turnIntroTitle": "Get ready",
    "alias.explainingTitle": "Explaining!",
    "alias.turnReviewTitle": "Turn review",
    "alias.finishedTitle": "Final result",
    "alias.scoreboard": "Teams",
    "alias.noPlayers": "No players yet",
    "alias.settings": "Settings",
    "alias.turnDuration": "Turn length",
    "alias.rounds": "Rounds",
    "alias.skipPenalty": "Skipping costs a point (−1)",
    "alias.teams": "Teams",
    "alias.teamCount": "Teams",
    "alias.assignTeam": (name) => `Assign ${name} to a team`,
    "alias.autoBalance": "Shuffle teams automatically",
    "alias.startGame": "Start game",
    "alias.teamRequirement": (count) => `Every team needs at least ${count} players.`,
    "alias.waitingForSetup": "The host is setting up teams. Hang tight…",
    "alias.upNext": "Up next",
    "alias.explains": "Explains",
    "alias.thatsYou": "that's you!",
    "alias.explainerInstructions": (seconds) =>
      `You'll see a word — explain it to your team without saying it. You have ${seconds} seconds.`,
    "alias.guesserInstructions": "Your teammate explains — shout your guesses out loud!",
    "alias.spectatorInstructions": (team) => `Team ${team} is playing. Watch and keep them honest.`,
    "alias.startTurn": "Start turn",
    "alias.waitingForExplainer": (name) => `Waiting for ${name} to start the turn.`,
    "alias.seconds": "seconds",
    "alias.dontSayIt": "Don't say this word",
    "alias.skip": "Skip",
    "alias.correct": "Correct",
    "alias.guessOutLoud": "Guess out loud!",
    "alias.watchAndWait": "Other team is playing",
    "alias.endTurnEarly": "End turn early",
    "alias.reviewInstructionsEditor": "Tap a word to flip it between correct and skipped, then confirm.",
    "alias.reviewInstructions": "The explainer confirms the results of this turn.",
    "alias.noWordsPlayed": "No words were played this turn.",
    "alias.confirmTurn": "Confirm & next turn",
    "alias.waitingConfirm": "Waiting for the explainer to confirm…",
    "alias.winner": "Winner",
    "alias.tie": "It's a tie!",
    "alias.playAgain": "Play again",
    "alias.spectatorNote": "You're spectating this game — the host can add you to a team next game.",
    "asocijacije.board": (round) => `Board ${round}`,
    "asocijacije.phase.setup": "How to play",
    "asocijacije.phase.playing": "Solve the board",
    "asocijacije.phase.finished": "Board solved",
    "asocijacije.solvedCount": (count) => `${count}/4 columns`,
    "asocijacije.rule1": "Reveal clues — each one hints at its column's solution.",
    "asocijacije.rule2": "Solve a column with fewer revealed clues for more points (2–10).",
    "asocijacije.rule3": "The four column solutions point to the final solution (10–26 points).",
    "asocijacije.start": "Start board",
    "asocijacije.waitingForHost": "Waiting for the host to start the board.",
    "asocijacije.columnAria": (label) => `Column ${label}`,
    "asocijacije.guessColumnAria": (label) => `Guess the solution for column ${label}`,
    "asocijacije.guess": "Guess",
    "asocijacije.finalSolution": "Final solution",
    "asocijacije.finalPlaceholder": "Final solution…",
    "asocijacije.finalAria": "Guess the final solution",
    "asocijacije.solvedBy": (name) => `Solved by ${name}`,
    "asocijacije.revealedByHost": "Revealed by the host",
    "asocijacije.revealAll": "Give up & reveal the board",
    "asocijacije.nextBoard": "Next board",
    "song.phase.setup": "Setup",
    "song.roundOf": (round, total) => `Round ${round}/${total}`,
    "song.setupTitle": "Pick the music",
    "song.playingTitle": "Listen & guess",
    "song.roundEndTitle": "Round result",
    "song.finishedTitle": "Final result",
    "song.source": "Music source",
    "song.customQuery": "…or search anything (artist, genre)",
    "song.customQueryPlaceholder": "e.g. Dino Merlin",
    "song.rounds": "Rounds",
    "song.roundTime": "Round time",
    "song.answerMode": "Guess what?",
    "song.mode.both": "Title + artist",
    "song.mode.title": "Title only",
    "song.mode.artist": "Artist only",
    "song.start": "Load songs & start",
    "song.loadingTracks": "Finding songs…",
    "song.previewNote": "Plays 30-second previews via the iTunes catalog — no account needed.",
    "song.waitingForSetup": "The host is picking the music. Hang tight…",
    "song.mysteryTrack": "Mystery track",
    "song.modeHint.both": "Guess the title and the artist",
    "song.modeHint.title": "Guess the song title",
    "song.modeHint.artist": "Guess the artist",
    "song.youGotIt": "You got it! Waiting for the others…",
    "song.guessPlaceholder.both": "Title or artist…",
    "song.guessPlaceholder.title": "Song title…",
    "song.guessPlaceholder.artist": "Artist…",
    "song.guessAria": "Your guess",
    "song.guess": "Guess",
    "song.miss": "Not it — try again!",
    "song.titleLabel": "Title",
    "song.artistLabel": "Artist",
    "song.endRound": "End round & reveal",
    "song.firstMatch": (name) => `${name} was fastest this round (+3).`,
    "song.nextRound": "Next round",
    "song.showResults": "Show final results",
    "song.matched": "got it",
    "song.finalScore": (points) => `${points} points`,
    "gradovi.filled": (filled, total) => `${filled}/${total} filled`,
    "gradovi.winner": "Winner",
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
    "leave.action": "Napusti sobu",
    "leave.title": "Napustiti sobu?",
    "leave.note": "Možeš se vratiti bilo kad sa kodom sobe.",
    "leave.hostNote":
      "Ti si host — hostovanje prelazi na sljedećeg igrača. Ako si zadnji/a, soba se zatvara.",
    "leave.stay": "Ostani",
    "leave.confirm": "Napusti",
    "leave.error": "Nije uspjelo napuštanje sobe. Pokušaj ponovo.",
    "code.copyAria": (code) => `Kod sobe ${code} — tapni za kopiranje`,
    "code.copied": "Kopirano!",
    "code.tapToCopy": "Tapni za kopiranje",
    "home.kicker": "Party igre za game night",
    "home.playable": "Spremno",
    "home.players": (min, max) => `${min}–${max} igrača`,
    "home.heroNote": "Bez instalacija i naloga. Jedan kod sobe i svi su unutra.",
    "lobby.shareCode": "Podijeli kod sa rajom",
    "lobby.waitingForPlayers": "Čekamo još igrača…",
    "lobby.selectedGame": "Izabrana igra",
    "lobby.hostControls": "Host kontrole",
    "alias.phase.setup": "Postavke",
    "alias.roundOf": (round, total) => `Runda ${round}/${total}`,
    "alias.setupTitle": "Timovi i postavke",
    "alias.turnIntroTitle": "Pripremite se",
    "alias.explainingTitle": "Objašnjavanje!",
    "alias.turnReviewTitle": "Pregled poteza",
    "alias.finishedTitle": "Konačni rezultat",
    "alias.scoreboard": "Timovi",
    "alias.noPlayers": "Još nema igrača",
    "alias.settings": "Postavke",
    "alias.turnDuration": "Trajanje poteza",
    "alias.rounds": "Runde",
    "alias.skipPenalty": "Preskakanje nosi −1 bod",
    "alias.teams": "Timovi",
    "alias.teamCount": "Timovi",
    "alias.assignTeam": (name) => `Dodijeli ${name} u tim`,
    "alias.autoBalance": "Automatski promiješaj timove",
    "alias.startGame": "Pokreni igru",
    "alias.teamRequirement": (count) => `Svaki tim treba najmanje ${count} igrača.`,
    "alias.waitingForSetup": "Host slaže timove. Samo malo…",
    "alias.upNext": "Na potezu",
    "alias.explains": "Objašnjava",
    "alias.thatsYou": "to si ti!",
    "alias.explainerInstructions": (seconds) =>
      `Vidjet ćeš riječ — objasni je svom timu bez da je izgovoriš. Imaš ${seconds} sekundi.`,
    "alias.guesserInstructions": "Saigrač objašnjava — pogađajte naglas!",
    "alias.spectatorInstructions": (team) => `Tim ${team} igra. Gledajte i držite ih poštenim.`,
    "alias.startTurn": "Kreni",
    "alias.waitingForExplainer": (name) => `Čekamo da ${name} krene.`,
    "alias.seconds": "sekundi",
    "alias.dontSayIt": "Ne izgovaraj ovu riječ",
    "alias.skip": "Preskoči",
    "alias.correct": "Tačno",
    "alias.guessOutLoud": "Pogađaj naglas!",
    "alias.watchAndWait": "Drugi tim igra",
    "alias.endTurnEarly": "Završi potez ranije",
    "alias.reviewInstructionsEditor": "Tapni riječ da je prebaciš između tačno i preskočeno, pa potvrdi.",
    "alias.reviewInstructions": "Objašnjavač potvrđuje rezultat ovog poteza.",
    "alias.noWordsPlayed": "Nijedna riječ nije odigrana u ovom potezu.",
    "alias.confirmTurn": "Potvrdi i dalje",
    "alias.waitingConfirm": "Čekamo da objašnjavač potvrdi…",
    "alias.winner": "Pobjednik",
    "alias.tie": "Neriješeno!",
    "alias.playAgain": "Igraj ponovo",
    "alias.spectatorNote": "Gledaš ovu igru — host te može ubaciti u tim za sljedeću.",
    "asocijacije.board": (round) => `Tabla ${round}`,
    "asocijacije.phase.setup": "Kako se igra",
    "asocijacije.phase.playing": "Riješi tablu",
    "asocijacije.phase.finished": "Tabla riješena",
    "asocijacije.solvedCount": (count) => `${count}/4 kolone`,
    "asocijacije.rule1": "Otkrivaj polja — svako je trag za rješenje svoje kolone.",
    "asocijacije.rule2": "Riješi kolonu s manje otkrivenih polja za više bodova (2–10).",
    "asocijacije.rule3": "Četiri rješenja kolona vode do konačnog rješenja (10–26 bodova).",
    "asocijacije.start": "Pokreni tablu",
    "asocijacije.waitingForHost": "Čekamo hosta da pokrene tablu.",
    "asocijacije.columnAria": (label) => `Kolona ${label}`,
    "asocijacije.guessColumnAria": (label) => `Pogodi rješenje kolone ${label}`,
    "asocijacije.guess": "Pogodi",
    "asocijacije.finalSolution": "Konačno rješenje",
    "asocijacije.finalPlaceholder": "Konačno rješenje…",
    "asocijacije.finalAria": "Pogodi konačno rješenje",
    "asocijacije.solvedBy": (name) => `Riješio/la ${name}`,
    "asocijacije.revealedByHost": "Otkrio host",
    "asocijacije.revealAll": "Predaj se i otkrij tablu",
    "asocijacije.nextBoard": "Sljedeća tabla",
    "song.phase.setup": "Postavke",
    "song.roundOf": (round, total) => `Runda ${round}/${total}`,
    "song.setupTitle": "Izaberi muziku",
    "song.playingTitle": "Slušaj i pogađaj",
    "song.roundEndTitle": "Rezultat runde",
    "song.finishedTitle": "Konačni rezultat",
    "song.source": "Izvor muzike",
    "song.customQuery": "…ili pretraži bilo šta (izvođač, žanr)",
    "song.customQueryPlaceholder": "npr. Dino Merlin",
    "song.rounds": "Runde",
    "song.roundTime": "Vrijeme runde",
    "song.answerMode": "Šta se pogađa?",
    "song.mode.both": "Naslov + izvođač",
    "song.mode.title": "Samo naslov",
    "song.mode.artist": "Samo izvođač",
    "song.start": "Učitaj pjesme i kreni",
    "song.loadingTracks": "Tražim pjesme…",
    "song.previewNote": "Pušta 30-sekundne preview-e iz iTunes kataloga — bez naloga.",
    "song.waitingForSetup": "Host bira muziku. Samo malo…",
    "song.mysteryTrack": "Misteriozna pjesma",
    "song.modeHint.both": "Pogodi naslov i izvođača",
    "song.modeHint.title": "Pogodi naslov pjesme",
    "song.modeHint.artist": "Pogodi izvođača",
    "song.youGotIt": "Pogodio/la si! Čekamo ostale…",
    "song.guessPlaceholder.both": "Naslov ili izvođač…",
    "song.guessPlaceholder.title": "Naslov pjesme…",
    "song.guessPlaceholder.artist": "Izvođač…",
    "song.guessAria": "Tvoj odgovor",
    "song.guess": "Pogodi",
    "song.miss": "Nije to — probaj opet!",
    "song.titleLabel": "Naslov",
    "song.artistLabel": "Izvođač",
    "song.endRound": "Završi rundu i otkrij",
    "song.firstMatch": (name) => `${name} je bio/la najbrži/a ovu rundu (+3).`,
    "song.nextRound": "Sljedeća runda",
    "song.showResults": "Prikaži konačni rezultat",
    "song.matched": "pogodio/la",
    "song.finalScore": (points) => `${points} bodova`,
    "gradovi.filled": (filled, total) => `${filled}/${total} popunjeno`,
    "gradovi.winner": "Pobjednik",
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
    alias: {
      displayName: "Alias",
      tagline: "Explain the word — just never say it.",
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
    alias: {
      displayName: "Alias",
      tagline: "Objasni riječ — samo je nemoj izgovoriti.",
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
    alias: {
      rules: [
        "Play in teams. One player explains words to their teammates.",
        "Never say the word itself (or its root) — describe around it.",
        "Each correct guess is +1; skips can cost −1 if the host enables it.",
        "Teams take turns; the highest score after all rounds wins.",
      ],
      example:
        "The word is 'guitar'. You say: an instrument with six strings you play around a campfire. Your team shouts 'guitar' — +1, next word!",
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
    alias: {
      rules: [
        "Igra se u timovima. Jedan igrač objašnjava riječi svom timu.",
        "Riječ se ne smije izgovoriti (ni korijen) — opisuj okolo.",
        "Svaka pogođena riječ nosi +1; preskakanje može nositi −1 ako host uključi.",
        "Timovi se smjenjuju; pobjeđuje tim s najviše bodova nakon svih rundi.",
      ],
      example:
        "Riječ je 'gitara'. Kažeš: instrument sa šest žica koji se svira kraj logorske vatre. Tim vikne 'gitara' — +1, sljedeća riječ!",
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
    "Invalid Alias action.": "Neispravna Alias akcija.",
    "Settings are locked after the game starts.": "Postavke su zaključane nakon početka igre.",
    "Teams are locked after the game starts.": "Timovi su zaključani nakon početka igre.",
    "Only the host can change teams.": "Samo host može mijenjati timove.",
    "Unknown team.": "Nepoznat tim.",
    "No turn to start right now.": "Trenutno nema poteza za pokretanje.",
    "Active team has no players left.": "Aktivni tim više nema igrača.",
    "Only the explainer can start the turn.": "Samo objašnjavač može pokrenuti potez.",
    "Turn is not running.": "Potez nije u toku.",
    "Only the explainer can mark words.": "Samo objašnjavač može označavati riječi.",
    "The turn is still running.": "Potez još traje.",
    "No turn to review.": "Nema poteza za pregled.",
    "Only the explainer or host can adjust results.":
      "Samo objašnjavač ili host mogu mijenjati rezultate.",
    "Only the explainer or host can confirm the turn.":
      "Samo objašnjavač ili host mogu potvrditi potez.",
    "Only the host can restart.": "Samo host može pokrenuti novu igru.",
    "Game is not finished yet.": "Igra još nije završena.",
    "Unknown word.": "Nepoznata riječ.",
    "Invalid Asocijacije action.": "Neispravna Asocijacije akcija.",
    "Unknown field.": "Nepoznato polje.",
    "Column is already solved.": "Kolona je već riješena.",
    "Wrong guess.": "Netačno.",
    "Board is already solved.": "Tabla je već riješena.",
    "Game is not running.": "Igra nije u toku.",
    "Only the host can reveal the board.": "Samo host može otkriti tablu.",
    "Invalid Guess the Song action.": "Neispravna Pogodi pjesmu akcija.",
    "Round is not running.": "Runda nije u toku.",
    "You already guessed this one.": "Već si pogodio/la ovu.",
    "The round is still running.": "Runda još traje.",
    "Round is still running.": "Runda još traje.",
    "Pick a music source first.": "Prvo izaberi izvor muzike.",
    "Room is not in Guess the Song.": "Soba nije u Pogodi pjesmu igri.",
    "No playable previews found for that source. Try another one.":
      "Nema dostupnih preview-a za taj izvor. Probaj drugi.",
    "Could not leave the room. Try again.": "Nije uspjelo napuštanje sobe. Pokušaj ponovo.",
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

  const teamSize = message.match(/^Each team needs at least (\d+) players?\.?$/);
  if (teamSize) return translate(language, "alias.teamRequirement", teamSize[1]);

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
