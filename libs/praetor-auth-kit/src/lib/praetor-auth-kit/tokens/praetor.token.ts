import { Provider } from '@angular/core';
import { PRAETOR_API_URL } from './api-url.token';
import {
  PRAETOR_BEARER_ACCESS_TOKEN_NAME,
  PRAETOR_BEARER_INCLUDE_URLS,
  PRAETOR_BEARER_REFRESH_TOKEN_NAME,
  PRAETOR_BEARER_STORAGE_STRATEGY,
  StorageStrategy,
} from './bearer-config.token';

export interface PraetorInjectionConfig {
  acccessToken?: string;
  refreshToken?: string;
  storageType: StorageStrategy;
  interceptedUrls: string[];
}

export function providePraetor(
  url: string,
  config?: PraetorInjectionConfig
): Provider[] {
  const providers: Provider[] = [{ provide: PRAETOR_API_URL, useValue: url }];

  if (config) {
    if (config.acccessToken) {
      providers.push({
        provide: PRAETOR_BEARER_ACCESS_TOKEN_NAME,
        useValue: config.acccessToken,
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
    if (config.interceptedUrls) {
      providers.push({
        provide: PRAETOR_BEARER_INCLUDE_URLS,
        useValue: config.interceptedUrls,
      });
    }
  }

  return providers;
}
