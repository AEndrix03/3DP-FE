import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  PRAETOR_BEARER_ACCESS_TOKEN_NAME,
  PRAETOR_BEARER_REFRESH_TOKEN_NAME,
  PRAETOR_BEARER_STORAGE_STRATEGY,
  StorageStrategy,
} from '../../tokens/bearer-config.token';

@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  private readonly isBrowser: boolean;

  constructor(
    @Inject(PLATFORM_ID) platformId: Object,
    @Inject(PRAETOR_BEARER_STORAGE_STRATEGY)
    private readonly strategy: StorageStrategy,
    @Inject(PRAETOR_BEARER_ACCESS_TOKEN_NAME)
    private readonly ACCESS_TOKEN_KEY: string,
    @Inject(PRAETOR_BEARER_REFRESH_TOKEN_NAME)
    private readonly REFRESH_TOKEN_KEY: string
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  private get storage(): Storage | null {
    if (!this.isBrowser) return null;
    return this.strategy === 'session' ? sessionStorage : localStorage;
  }

  getAccessToken(): string | null {
    return this.storage?.getItem(this.ACCESS_TOKEN_KEY) ?? null;
  }

  getRefreshToken(): string | null {
    return this.storage?.getItem(this.REFRESH_TOKEN_KEY) ?? null;
  }

  saveTokens(access: string, refresh: string): void {
    this.storage?.setItem(this.ACCESS_TOKEN_KEY, access);
    this.storage?.setItem(this.REFRESH_TOKEN_KEY, refresh);
  }

  clearTokens(): void {
    this.storage?.removeItem(this.ACCESS_TOKEN_KEY);
    this.storage?.removeItem(this.REFRESH_TOKEN_KEY);
  }
}
