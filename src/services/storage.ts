// Abstract storage service interface
// Allows swapping localStorage with IndexedDB or other backends

export interface StorageService {
  get<T>(key: string): T | null;
  set<T>(key: string, value: T): void;
  remove(key: string): void;
}

// LocalStorage implementation
class LocalStorageService implements StorageService {
  get<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : null;
    } catch {
      return null;
    }
  }

  set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      console.error('[StorageService] Failed to write to localStorage');
    }
  }

  remove(key: string): void {
    localStorage.removeItem(key);
  }
}

// Singleton export — swap this with an IndexedDB implementation when needed
export const storageService: StorageService = new LocalStorageService();
