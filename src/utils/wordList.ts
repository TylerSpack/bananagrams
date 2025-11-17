let wordSet: Set<string> | null = null;

/**
 * Loads the word list from the public assets folder into memory as a Set.
 * Only loads once per session.
 */
export async function loadWordList(): Promise<void> {
  if (wordSet) return;
  // Use a base-aware URL so the asset resolves correctly in dev and when a
  // custom base (like a GitHub Pages homepage) is configured.
  const url = new URL('../assets/word_list.txt', import.meta.url).href;
  const response = await fetch(url);
  const text = await response.text();
  wordSet = new Set(text.split('\n'));
}

/**
 * Checks if the word list has been loaded.
 */
export function isWordListLoaded(): boolean {
  return wordSet !== null;
}

/**
 * Checks if a word is valid (exists in the loaded word list).
 * Returns false if the word list is not loaded yet.
 */
export function isWordValid(word: string): boolean {
  if (!wordSet) return false;
  return wordSet.has(word.toLowerCase());
}
