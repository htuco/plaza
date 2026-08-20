import type { HigherLowerCategory, HigherLowerRoundItem } from "./types";

export interface HigherLowerItemSeed {
  id: string;
  label: string;
  value: number;
  unit: string;
}

// Curated static deck — no live API. Numbers are approximate/rounded on
// purpose (order-of-magnitude comparisons), so the deck doesn't need
// constant upkeep. Internet/media figures as of 2026; trivia figures are
// stable long-term facts.
export const HIGHER_LOWER_ITEMS: Record<HigherLowerCategory, readonly HigherLowerItemSeed[]> = {
  internet: [
    { id: "yt-mrbeast", label: "MrBeast (YouTube)", value: 400_000_000, unit: "pretplatnika" },
    { id: "yt-tseries", label: "T-Series (YouTube)", value: 290_000_000, unit: "pretplatnika" },
    { id: "yt-pewdiepie", label: "PewDiePie (YouTube)", value: 111_000_000, unit: "pretplatnika" },
    { id: "ig-cristiano", label: "Cristiano Ronaldo (Instagram)", value: 650_000_000, unit: "pratilaca" },
    { id: "ig-messi", label: "Lionel Messi (Instagram)", value: 500_000_000, unit: "pratilaca" },
    { id: "ig-selenagomez", label: "Selena Gomez (Instagram)", value: 420_000_000, unit: "pratilaca" },
    { id: "tt-khaby", label: "Khaby Lame (TikTok)", value: 162_000_000, unit: "pratilaca" },
    { id: "tt-charlidamelio", label: "Charli D'Amelio (TikTok)", value: 155_000_000, unit: "pratilaca" },
    { id: "song-blindinglights", label: "\"Blinding Lights\" (Spotify streams)", value: 4_500_000_000, unit: "striminga" },
    { id: "song-shapeofyou", label: "\"Shape of You\" (Spotify streams)", value: 4_000_000_000, unit: "striminga" },
    { id: "song-oldtownroad", label: "\"Old Town Road\" (Spotify streams)", value: 2_000_000_000, unit: "striminga" },
    { id: "movie-avatar", label: "Avatar (svjetska zarada)", value: 2_900_000_000, unit: "$" },
    { id: "movie-avengersendgame", label: "Avengers: Endgame (svjetska zarada)", value: 2_800_000_000, unit: "$" },
    { id: "movie-titanic", label: "Titanic (svjetska zarada)", value: 2_260_000_000, unit: "$" },
    { id: "app-instagram", label: "Instagram (preuzimanja svih vremena)", value: 5_000_000_000, unit: "preuzimanja" },
    { id: "app-tiktok", label: "TikTok (preuzimanja svih vremena)", value: 4_600_000_000, unit: "preuzimanja" },
  ],
  trivia: [
    { id: "pop-india", label: "Indija (stanovništvo)", value: 1_440_000_000, unit: "stanovnika" },
    { id: "pop-usa", label: "SAD (stanovništvo)", value: 335_000_000, unit: "stanovnika" },
    { id: "pop-germany", label: "Njemačka (stanovništvo)", value: 84_000_000, unit: "stanovnika" },
    { id: "pop-tokyo", label: "Tokio (stanovništvo grada)", value: 14_000_000, unit: "stanovnika" },
    { id: "pop-newyork", label: "New York (stanovništvo grada)", value: 8_300_000, unit: "stanovnika" },
    { id: "animal-cheetah", label: "Gepard (najveća brzina)", value: 120, unit: "km/h" },
    { id: "animal-lion", label: "Lav (najveća brzina)", value: 80, unit: "km/h" },
    { id: "animal-elephant", label: "Slon (životni vijek)", value: 70, unit: "godina" },
    { id: "animal-tortoise", label: "Divovska kornjača (životni vijek)", value: 150, unit: "godina" },
    { id: "animal-dog", label: "Pas (životni vijek)", value: 13, unit: "godina" },
    { id: "year-moonlanding", label: "Prvo slijetanje na Mjesec", value: 1969, unit: "godina" },
    { id: "year-internet", label: "Javni internet (World Wide Web)", value: 1991, unit: "godina" },
    { id: "year-berlinwall", label: "Pad Berlinskog zida", value: 1989, unit: "godina" },
    { id: "mountain-everest", label: "Mount Everest (visina)", value: 8849, unit: "m" },
    { id: "river-nile", label: "Rijeka Nil (dužina)", value: 6650, unit: "km" },
    { id: "river-amazon", label: "Rijeka Amazon (dužina)", value: 6400, unit: "km" },
  ],
  regional: [
    { id: "reg-pop-sarajevo", label: "Sarajevo (stanovništvo)", value: 275_000, unit: "stanovnika" },
    { id: "reg-pop-beograd", label: "Beograd (stanovništvo)", value: 1_170_000, unit: "stanovnika" },
    { id: "reg-pop-zagreb", label: "Zagreb (stanovništvo)", value: 800_000, unit: "stanovnika" },
    { id: "reg-pop-banjaluka", label: "Banja Luka (stanovništvo)", value: 185_000, unit: "stanovnika" },
    { id: "reg-pop-mostar", label: "Mostar (stanovništvo)", value: 105_000, unit: "stanovnika" },
    { id: "reg-pop-bih", label: "Bosna i Hercegovina (stanovništvo)", value: 3_200_000, unit: "stanovnika" },
    { id: "reg-pop-srbija", label: "Srbija (stanovništvo)", value: 6_600_000, unit: "stanovnika" },
    { id: "reg-pop-hrvatska", label: "Hrvatska (stanovništvo)", value: 3_850_000, unit: "stanovnika" },
    { id: "reg-mountain-maglic", label: "Maglić (visina)", value: 2386, unit: "m" },
    { id: "reg-mountain-triglav", label: "Triglav (visina)", value: 2864, unit: "m" },
    { id: "reg-river-drina", label: "Rijeka Drina (dužina)", value: 346, unit: "km" },
    { id: "reg-river-sava", label: "Rijeka Sava (dužina)", value: 990, unit: "km" },
    { id: "reg-year-nezavisnost-bih", label: "Nezavisnost Bosne i Hercegovine", value: 1992, unit: "godina" },
    { id: "reg-year-oi-sarajevo", label: "Zimske olimpijske igre u Sarajevu", value: 1984, unit: "godina" },
    { id: "reg-lake-skadar", label: "Skadarsko jezero (površina)", value: 370, unit: "km²" },
    { id: "reg-lake-plitvice", label: "Plitvička jezera (površina)", value: 2, unit: "km²" },
  ],
};

const CATEGORIES = Object.keys(HIGHER_LOWER_ITEMS) as HigherLowerCategory[];

export function randomCategory(): HigherLowerCategory {
  return CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
}

function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export function shuffledRoundItems(category: HigherLowerCategory): HigherLowerRoundItem[] {
  return shuffle(HIGHER_LOWER_ITEMS[category]).map((item) => ({ ...item }));
}
