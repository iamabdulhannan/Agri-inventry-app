import './storage-polyfill' // localStorage on native (expo-sqlite) before anything reads it

/** Small device preferences (language, theme, selected org). Never throws. */
export const prefs = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  set(key: string, value: string | null) {
    try {
      if (value === null) localStorage.removeItem(key)
      else localStorage.setItem(key, value)
    } catch {
      /* ignore */
    }
  },
}
