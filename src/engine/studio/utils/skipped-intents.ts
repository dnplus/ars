const SKIP_STORAGE_KEY = 'ars-studio-skipped-intents';

export function readSkippedIntentIds(): Set<string> {
  try {
    const raw = localStorage.getItem(SKIP_STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is string => typeof x === 'string'));
  } catch {
    return new Set();
  }
}

export function writeSkippedIntentIds(set: Set<string>): void {
  try {
    localStorage.setItem(SKIP_STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    // ignore quota errors
  }
}
