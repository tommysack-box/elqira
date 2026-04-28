// Abstract storage service interface
// Uses IndexedDB for persistence with an in-memory cache for synchronous reads.

interface StorageService {
  initialize(keys?: string[]): Promise<void>;
  isInitialized(): boolean;
  ensureLoaded(key: string): Promise<void>;
  isLoaded(key: string): boolean;
  areLoaded(keys: string[]): boolean;
  get<T>(key: string): T | null;
  set<T>(key: string, value: T): void;
  setMany(entries: StoredRecord[]): Promise<void>;
  remove(key: string): void;
}

const DB_NAME = 'elqira';
const DB_VERSION = 1;
const STORE_NAME = 'app_state';

type StoredRecord = {
  key: string;
  value: unknown;
};

class IndexedDbStorageService implements StorageService {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private initializationPromise: Promise<void> | null = null;
  private initialized = false;
  private cache = new Map<string, unknown>();
  private loadedKeys = new Set<string>();
  private loadPromises = new Map<string, Promise<void>>();
  private writeChain: Promise<void> = Promise.resolve();

  async initialize(keys: string[] = []): Promise<void> {
    if (!this.initialized) {
      if (!this.initializationPromise) {
        this.initializationPromise = this.openDatabase().then(() => {
          this.initialized = true;
        });
      }

      try {
        await this.initializationPromise;
      } finally {
        this.initializationPromise = null;
      }
    }

    if (keys.length > 0) {
      await Promise.all(keys.map((key) => this.ensureLoaded(key)));
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async ensureLoaded(key: string): Promise<void> {
    if (this.loadedKeys.has(key)) return;

    const existingPromise = this.loadPromises.get(key);
    if (existingPromise) {
      await existingPromise;
      return;
    }

    const loadPromise = (async () => {
      await this.initialize();
      const db = await this.openDatabase();
      const request = this.objectStore(db, 'readonly').get(key) as IDBRequest<StoredRecord | undefined>;
      const row = await this.runRequest(request);
      if (row) {
        this.cache.set(key, row.value);
      } else {
        this.cache.delete(key);
      }
      this.loadedKeys.add(key);
    })();

    this.loadPromises.set(key, loadPromise);

    try {
      await loadPromise;
    } finally {
      this.loadPromises.delete(key);
    }
  }

  isLoaded(key: string): boolean {
    return this.loadedKeys.has(key);
  }

  areLoaded(keys: string[]): boolean {
    return keys.every((key) => this.loadedKeys.has(key));
  }

  get<T>(key: string): T | null {
    return this.cache.has(key) ? (this.cache.get(key) as T) : null;
  }

  set<T>(key: string, value: T): void {
    this.cache.set(key, value);
    this.loadedKeys.add(key);
    void this.enqueueWrite(async () => {
      const db = await this.openDatabase();
      await this.runRequest(this.objectStore(db, 'readwrite').put({ key, value } satisfies StoredRecord));
    });
  }

  async setMany(entries: StoredRecord[]): Promise<void> {
    await this.enqueueWrite(async () => {
      const db = await this.openDatabase();
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      for (const entry of entries) {
        store.put(entry);
      }

      await this.runTransaction(transaction);

      for (const entry of entries) {
        this.cache.set(entry.key, entry.value);
        this.loadedKeys.add(entry.key);
      }
    });
  }

  remove(key: string): void {
    this.cache.delete(key);
    this.loadedKeys.add(key);
    void this.enqueueWrite(async () => {
      const db = await this.openDatabase();
      await this.runRequest(this.objectStore(db, 'readwrite').delete(key));
    });
  }

  private enqueueWrite<T>(action: () => Promise<T>): Promise<T> {
    const result = this.writeChain.then(action);
    this.writeChain = result
      .then(() => undefined)
      .catch(() => {
        console.error('[StorageService] Failed to persist data to IndexedDB');
      });

    return result;
  }

  private objectStore(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
    return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
  }

  private openDatabase(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const OPEN_TIMEOUT_MS = 5000;

        const timer = setTimeout(() => {
          this.dbPromise = null;
          reject(new Error('[StorageService] indexedDB.open() timed out'));
        }, OPEN_TIMEOUT_MS);

        const clearTimer = () => clearTimeout(timer);

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'key' });
          }
        };

        request.onsuccess = () => {
          clearTimer();
          resolve(request.result);
        };

        request.onerror = () => {
          clearTimer();
          this.dbPromise = null;
          reject(request.error);
        };

        request.onblocked = () => {
          clearTimer();
          this.dbPromise = null;
          reject(new Error('[StorageService] indexedDB.open() blocked by an existing connection'));
        };
      });
    }

    return this.dbPromise;
  }

  private runRequest<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private runTransaction(transaction: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error ?? new Error('[StorageService] Transaction aborted'));
    });
  }
}

export const storageService: StorageService = new IndexedDbStorageService();
