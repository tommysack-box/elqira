// Abstract storage service interface
// Uses IndexedDB for persistence with an in-memory cache for synchronous reads.

interface StorageService {
  initialize(): Promise<void>;
  get<T>(key: string): T | null;
  set<T>(key: string, value: T): void;
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
  private initialized = false;
  private cache = new Map<string, unknown>();
  private writeChain: Promise<void> = Promise.resolve();

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const db = await this.openDatabase();
    await this.loadCache(db);
    this.initialized = true;
  }

  get<T>(key: string): T | null {
    return this.cache.has(key) ? (this.cache.get(key) as T) : null;
  }

  set<T>(key: string, value: T): void {
    this.cache.set(key, value);
    this.enqueueWrite(async () => {
      const db = await this.openDatabase();
      await this.runRequest(this.objectStore(db, 'readwrite').put({ key, value } satisfies StoredRecord));
    });
  }

  remove(key: string): void {
    this.cache.delete(key);
    this.enqueueWrite(async () => {
      const db = await this.openDatabase();
      await this.runRequest(this.objectStore(db, 'readwrite').delete(key));
    });
  }

  private enqueueWrite(action: () => Promise<void>) {
    this.writeChain = this.writeChain
      .then(action)
      .catch(() => {
        console.error('[StorageService] Failed to persist data to IndexedDB');
      });
  }

  private async loadCache(db: IDBDatabase): Promise<void> {
    const rows = await this.runRequest<StoredRecord[]>(this.objectStore(db, 'readonly').getAll());
    this.cache = new Map(rows.map((row) => [row.key, row.value]));
  }

  private objectStore(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
    return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
  }

  private openDatabase(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'key' });
          }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
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
}

export const storageService: StorageService = new IndexedDbStorageService();
