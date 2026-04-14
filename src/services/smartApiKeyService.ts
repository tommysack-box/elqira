export interface SmartApiKeyService {
  get(): string;
  set(value: string): void;
  clear(): void;
}

class InMemorySmartApiKeyService implements SmartApiKeyService {
  private apiKey = '';

  get(): string {
    return this.apiKey;
  }

  set(value: string): void {
    this.apiKey = value;
  }

  clear(): void {
    this.apiKey = '';
  }
}

export const smartApiKeyService: SmartApiKeyService = new InMemorySmartApiKeyService();
