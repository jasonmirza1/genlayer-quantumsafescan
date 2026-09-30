type PreferenceStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type StorageAccess = () => PreferenceStorage | null;
const browserStorage: StorageAccess = () => typeof window === "undefined" ? null : window.localStorage;

// Wallet preferences are best-effort. Transaction recovery uses strict storage instead.
export function readWalletPreference(key: string, fallback: string | null = null, access: StorageAccess = browserStorage): string | null {
  try { const storage = access(); return storage ? storage.getItem(key) : fallback; }
  catch { return fallback; }
}

export function writeWalletPreference(key: string, value: string | null, access: StorageAccess = browserStorage): boolean {
  try {
    const storage = access();
    if (!storage) return false;
    if (value === null) storage.removeItem(key); else storage.setItem(key, value);
    return true;
  } catch { return false; }
}
