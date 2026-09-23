import type { CategoryChoice, HigherLowerCategory, HigherLowerItem } from "./types";

// Curated static deck — no live API (Google has no official search-volume
// API). Every value is the approximate *average monthly Google searches*,
// worldwide, rounded, as estimated from public keyword-volume data (2026).
// One metric for everything, so any two items are a fair comparison.
type Seed = readonly [id: string, label: string, searches: number];

const K = 1_000;
const M = 1_000_000;

const SEEDS: Record<HigherLowerCategory, readonly Seed[]> = {
  poznati: [
    ["taylor-swift", "Taylor Swift", 9 * M],
    ["cristiano-ronaldo", "Cristiano Ronaldo", 11 * M],
    ["lionel-messi", "Lionel Messi", 8 * M],
    ["elon-musk", "Elon Musk", 7.5 * M],
    ["donald-trump", "Donald Trump", 20 * M],
    ["kim-kardashian", "Kim Kardashian", 3.4 * M],
    ["beyonce", "Beyoncé", 3 * M],
    ["rihanna", "Rihanna", 2.7 * M],
    ["drake", "Drake", 4 * M],
    ["mrbeast", "MrBeast", 4.5 * M],
    ["kylie-jenner", "Kylie Jenner", 2.5 * M],
    ["zendaya", "Zendaya", 2.2 * M],
    ["keanu-reeves", "Keanu Reeves", 1.8 * M],
    ["leonardo-dicaprio", "Leonardo DiCaprio", 1.6 * M],
    ["andrew-tate", "Andrew Tate", 2 * M],
    ["pope-francis", "Papa Franjo", 1.4 * M],
    ["mark-zuckerberg", "Mark Zuckerberg", 1.2 * M],
    ["bill-gates", "Bill Gates", 1.1 * M],
    ["jeff-bezos", "Jeff Bezos", 900 * K],
    ["shakira", "Shakira", 3.7 * M],
    ["dua-lipa", "Dua Lipa", 1.5 * M],
    ["king-charles", "Kralj Charles", 700 * K],
    ["albert-einstein", "Albert Einstein", 2.4 * M],
    ["nikola-tesla", "Nikola Tesla", 1.3 * M],
    ["mona-lisa", "Mona Lisa", 800 * K],
    ["khaby-lame", "Khaby Lame", 450 * K],
  ],
  sport: [
    ["football", "Fudbal (football)", 25 * M],
    ["champions-league", "Liga prvaka", 16 * M],
    ["nba", "NBA", 30 * M],
    ["formula-1", "Formula 1", 12 * M],
    ["real-madrid", "Real Madrid", 14 * M],
    ["fc-barcelona", "FC Barcelona", 10 * M],
    ["manchester-united", "Manchester United", 9 * M],
    ["premier-league", "Premier liga", 18 * M],
    ["lebron-james", "LeBron James", 3.5 * M],
    ["novak-djokovic", "Novak Đoković", 2.7 * M],
    ["rafael-nadal", "Rafael Nadal", 1.6 * M],
    ["roger-federer", "Roger Federer", 1.2 * M],
    ["luka-doncic", "Luka Dončić", 2.4 * M],
    ["nikola-jokic", "Nikola Jokić", 1.4 * M],
    ["kylian-mbappe", "Kylian Mbappé", 5 * M],
    ["erling-haaland", "Erling Haaland", 3 * M],
    ["lewis-hamilton", "Lewis Hamilton", 2 * M],
    ["max-verstappen", "Max Verstappen", 2.8 * M],
    ["usain-bolt", "Usain Bolt", 600 * K],
    ["michael-jordan", "Michael Jordan", 2.3 * M],
    ["ufc", "UFC", 11 * M],
    ["wimbledon", "Wimbledon", 4 * M],
    ["tour-de-france", "Tour de France", 1.9 * M],
    ["olympics", "Olimpijske igre", 7 * M],
    ["chess", "Šah (chess)", 9.5 * M],
    ["darts", "Pikado (darts)", 1.5 * M],
  ],
  "film-muzika": [
    ["netflix", "Netflix", 150 * M],
    ["spotify", "Spotify", 90 * M],
    ["game-of-thrones", "Game of Thrones", 3 * M],
    ["breaking-bad", "Breaking Bad", 2.2 * M],
    ["stranger-things", "Stranger Things", 4.5 * M],
    ["the-simpsons", "The Simpsons", 2 * M],
    ["friends", "Friends (serija)", 1.3 * M],
    ["harry-potter", "Harry Potter", 5 * M],
    ["star-wars", "Star Wars", 4 * M],
    ["titanic", "Titanic (film)", 1.1 * M],
    ["barbie", "Barbie", 6 * M],
    ["oppenheimer", "Oppenheimer", 1.6 * M],
    ["spongebob", "SpongeBob", 3.4 * M],
    ["peppa-pig", "Peppa Pig", 2.6 * M],
    ["squid-game", "Squid Game", 3.8 * M],
    ["the-beatles", "The Beatles", 1.5 * M],
    ["queen", "Queen (bend)", 900 * K],
    ["eminem", "Eminem", 3 * M],
    ["michael-jackson", "Michael Jackson", 3.6 * M],
    ["bts", "BTS", 7 * M],
    ["bad-bunny", "Bad Bunny", 6.5 * M],
    ["the-weeknd", "The Weeknd", 2.4 * M],
    ["billie-eilish", "Billie Eilish", 2.8 * M],
    ["eurovision", "Eurosong", 1.8 * M],
    ["oscars", "Oscar (nagrada)", 1.2 * M],
    ["shrek", "Shrek", 1.7 * M],
  ],
  hrana: [
    ["pizza", "Pizza", 55 * M],
    ["mcdonalds", "McDonald's", 45 * M],
    ["kfc", "KFC", 20 * M],
    ["burger-king", "Burger King", 14 * M],
    ["starbucks", "Starbucks", 16 * M],
    ["coca-cola", "Coca-Cola", 3.5 * M],
    ["sushi", "Sushi", 9 * M],
    ["pancakes", "Palačinke (pancakes)", 4.5 * M],
    ["lasagna", "Lazanje", 3.2 * M],
    ["banana", "Banana", 5.5 * M],
    ["avocado", "Avokado", 3 * M],
    ["nutella", "Nutella", 1.8 * M],
    ["red-bull", "Red Bull", 2.6 * M],
    ["ramen", "Ramen", 2.2 * M],
    ["tacos", "Tacos", 6.5 * M],
    ["croissant", "Kroasan", 1.3 * M],
    ["baklava", "Baklava", 1.1 * M],
    ["kebab", "Kebab", 2.5 * M],
    ["hummus", "Humus", 1.6 * M],
    ["brownies", "Brownies", 3.8 * M],
    ["cheesecake", "Cheesecake", 2.8 * M],
    ["ketchup", "Kečap", 700 * K],
    ["tiramisu", "Tiramisu", 1.5 * M],
    ["protein-shake", "Protein shake", 550 * K],
    ["matcha", "Matcha", 2 * M],
    ["pad-thai", "Pad Thai", 1.4 * M],
  ],
  "brendovi-tech": [
    ["youtube", "YouTube", 1_200 * M],
    ["google", "Google", 900 * M],
    ["facebook", "Facebook", 700 * M],
    ["amazon", "Amazon", 600 * M],
    ["instagram", "Instagram", 350 * M],
    ["whatsapp", "WhatsApp", 250 * M],
    ["chatgpt", "ChatGPT", 500 * M],
    ["gmail", "Gmail", 300 * M],
    ["tiktok", "TikTok", 200 * M],
    ["twitter-x", "Twitter / X", 90 * M],
    ["iphone", "iPhone", 30 * M],
    ["samsung", "Samsung", 22 * M],
    ["tesla", "Tesla", 12 * M],
    ["nike", "Nike", 18 * M],
    ["adidas", "Adidas", 11 * M],
    ["ikea", "IKEA", 25 * M],
    ["playstation", "PlayStation", 9 * M],
    ["minecraft", "Minecraft", 20 * M],
    ["fortnite", "Fortnite", 10 * M],
    ["roblox", "Roblox", 40 * M],
    ["zara", "Zara", 15 * M],
    ["lego", "LEGO", 8 * M],
    ["bmw", "BMW", 7 * M],
    ["ferrari", "Ferrari", 4 * M],
    ["bitcoin", "Bitcoin", 17 * M],
    ["nvidia", "NVIDIA", 6 * M],
  ],
  mjesta: [
    ["paris", "Pariz", 6 * M],
    ["london", "London", 5.5 * M],
    ["new-york", "New York", 7 * M],
    ["dubai", "Dubai", 6.5 * M],
    ["tokyo", "Tokio", 3.5 * M],
    ["rome", "Rim", 2.4 * M],
    ["barcelona-city", "Barcelona (grad)", 2.8 * M],
    ["istanbul", "Istanbul", 4 * M],
    ["bali", "Bali", 3 * M],
    ["maldives", "Maldivi", 1.8 * M],
    ["iceland", "Island", 1.6 * M],
    ["egypt", "Egipat", 3.6 * M],
    ["mount-everest", "Mount Everest", 900 * K],
    ["eiffel-tower", "Eiffelov toranj", 1.2 * M],
    ["grand-canyon", "Grand Canyon", 1.4 * M],
    ["venice", "Venecija", 1.3 * M],
    ["santorini", "Santorini", 1.1 * M],
    ["disneyland", "Disneyland", 4.5 * M],
    ["las-vegas", "Las Vegas", 5 * M],
    ["amsterdam", "Amsterdam", 3.2 * M],
    ["vienna", "Beč", 2 * M],
    ["prague", "Prag", 1.7 * M],
    ["machu-picchu", "Machu Picchu", 700 * K],
    ["sahara", "Sahara", 600 * K],
    ["antarctica", "Antarktika", 1 * M],
    ["hawaii", "Havaji", 3.8 * M],
  ],
  "historija-pojmovi": [
    ["world-war-2", "Drugi svjetski rat", 3.5 * M],
    ["world-war-1", "Prvi svjetski rat", 2 * M],
    ["titanic-ship", "Potonuće Titanika", 500 * K],
    ["moon-landing", "Slijetanje na Mjesec", 350 * K],
    ["roman-empire", "Rimsko carstvo", 1.3 * M],
    ["ancient-egypt", "Stari Egipat", 1 * M],
    ["pyramids", "Piramide u Gizi", 800 * K],
    ["cold-war", "Hladni rat", 900 * K],
    ["berlin-wall", "Berlinski zid", 450 * K],
    ["napoleon", "Napoleon", 2.2 * M],
    ["cleopatra", "Kleopatra", 1.1 * M],
    ["vikings", "Vikinzi", 1.6 * M],
    ["dinosaurs", "Dinosaurusi", 4 * M],
    ["black-death", "Crna kuga", 400 * K],
    ["chernobyl", "Černobil", 1.5 * M],
    ["hiroshima", "Hirošima", 700 * K],
    ["columbus", "Kristofor Kolumbo", 1.2 * M],
    ["french-revolution", "Francuska revolucija", 600 * K],
    ["ottoman-empire", "Osmansko carstvo", 1.4 * M],
    ["aztecs", "Asteci", 550 * K],
    ["samurai", "Samuraji", 1.8 * M],
    ["renaissance", "Renesansa", 750 * K],
    ["industrial-revolution", "Industrijska revolucija", 850 * K],
    ["great-wall", "Kineski zid", 950 * K],
    ["stonehenge", "Stonehenge", 650 * K],
    ["atlantis", "Atlantida", 1.9 * M],
  ],
  regional: [
    ["sarajevo", "Sarajevo", 1.4 * M],
    ["beograd", "Beograd", 1.8 * M],
    ["zagreb", "Zagreb", 1.6 * M],
    ["split", "Split", 1.3 * M],
    ["dubrovnik", "Dubrovnik", 1.2 * M],
    ["mostar", "Mostar", 400 * K],
    ["banja-luka", "Banja Luka", 450 * K],
    ["tuzla", "Tuzla", 300 * K],
    ["budva", "Budva", 700 * K],
    ["ohrid", "Ohrid", 350 * K],
    ["plitvice", "Plitvička jezera", 550 * K],
    ["bled", "Bled", 600 * K],
    ["kotor", "Kotor", 500 * K],
    ["cevapi", "Ćevapi", 250 * K],
    ["burek", "Burek", 350 * K],
    ["rakija", "Rakija", 200 * K],
    ["ajvar", "Ajvar", 180 * K],
    ["sarajevo-film-festival", "Sarajevo Film Festival", 60 * K],
    ["exit-festival", "EXIT festival", 150 * K],
    ["crvena-zvezda", "Crvena zvezda", 900 * K],
    ["dinamo-zagreb", "Dinamo Zagreb", 700 * K],
    ["partizan", "Partizan", 800 * K],
    ["fk-sarajevo", "FK Sarajevo", 120 * K],
    ["zeljeznicar", "FK Željezničar", 90 * K],
    ["bascarsija", "Baščaršija", 100 * K],
    ["jugoslavija", "Jugoslavija", 1 * M],
  ],
};

export const HIGHER_LOWER_ITEMS: readonly HigherLowerItem[] = (
  Object.entries(SEEDS) as [HigherLowerCategory, readonly Seed[]][]
).flatMap(([category, seeds]) =>
  seeds.map(([id, label, searches]) => ({ id, label, category, searches: Math.round(searches) })),
);

export const HIGHER_LOWER_CATEGORIES = Object.keys(SEEDS) as HigherLowerCategory[];

// Neighbours closer than this ratio feel like a coin flip, so the deck
// builder avoids them.
const MIN_RATIO = 1.1;

function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function isFairPair(a: HigherLowerItem, b: HigherLowerItem): boolean {
  const high = Math.max(a.searches, b.searches);
  const low = Math.min(a.searches, b.searches);
  return low > 0 && high / low >= MIN_RATIO;
}

// Builds a chain of `length` items where no two neighbours tie or near-tie.
export function buildDeck(choice: CategoryChoice, length: number): HigherLowerItem[] {
  const pool = shuffle(
    choice === "miks"
      ? HIGHER_LOWER_ITEMS
      : HIGHER_LOWER_ITEMS.filter((item) => item.category === choice),
  );
  const deck: HigherLowerItem[] = [];
  while (deck.length < length && pool.length > 0) {
    const last = deck[deck.length - 1];
    let index = last ? pool.findIndex((item) => isFairPair(last, item)) : 0;
    // No fair partner left: fall back to anything that isn't an exact tie.
    if (index === -1) index = pool.findIndex((item) => item.searches !== last.searches);
    if (index === -1) break;
    deck.push(pool.splice(index, 1)[0]);
  }
  return deck;
}
