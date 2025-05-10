import { Provider } from '@angular/core';
import { PRAETOR_API_URL } from './api-url.token';
import {
  PRAETOR_BEARER_ACCESS_TOKEN_NAME,
  PRAETOR_BEARER_EXCLUDE_URLS,
  PRAETOR_BEARER_INCLUDE_URLS,
  PRAETOR_BEARER_REFRESH_TOKEN_NAME,
  PRAETOR_BEARER_STORAGE_STRATEGY,
  StorageStrategy,
} from './bearer-config.token';

export interface PraetorInjectionConfig {
  accessToken?: string;
  refreshToken?: string;
  storageType?: StorageStrategy;
  includedUrls?: string[];
  excludedUrls?: string[];
}

export function providePraetor(
  url: string,
  config?: PraetorInjectionConfig
): Provider[] {
  const providers: Provider[] = [{ provide: PRAETOR_API_URL, useValue: url }];

  if (config) {
    if (config.accessToken) {
      providers.push({
        provide: PRAETOR_BEARER_ACCESS_TOKEN_NAME,
        useValue: config.accessToken,
      });
    }
    if (config.refreshToken) {
      providers.push({
        provide: PRAETOR_BEARER_REFRESH_TOKEN_NAME,
        useValue: config.refreshToken,
      });
    }
    if (config.storageType) {
      providers.push({
        provide: PRAETOR_BEARER_STORAGE_STRATEGY,
        useValue: config.storageType,
      });
    }
    if (config.includedUrls) {
      providers.push({
        provide: PRAETOR_BEARER_INCLUDE_URLS,
        useValue: config.includedUrls,
      });
    }
    if (config.excludedUrls) {
      providers.push({
        provide: PRAETOR_BEARER_EXCLUDE_URLS,
        useValue: config.excludedUrls,
      });
    }
  }

  return providers;
}
