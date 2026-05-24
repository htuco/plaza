// Human-friendly room codes: short, uppercase, no ambiguous chars (0/O, 1/I, etc.).
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 5;

export function generateRoomCode(): string {
  const chars: string[] = [];
  for (let i = 0; i < CODE_LENGTH; i++) {
    chars.push(ALPHABET[Math.floor(Math.random() * ALPHABET.length)]);
  }
  return chars.join("");
}

export function normalizeRoomCode(input: string): string {
  return input.trim().toUpperCase();
}

export function isValidRoomCode(input: string): boolean {
  const normalized = normalizeRoomCode(input);
  if (normalized.length !== CODE_LENGTH) return false;
  for (const ch of normalized) {
    if (!ALPHABET.includes(ch)) return false;
  }
  return true;
}
