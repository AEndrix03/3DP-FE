import { Provider } from '@angular/core';
import {
  PRAETOR_API_URL,
  PRAETOR_APPLICATION_NAME,
  PRAETOR_AUTH_APPLICATION_NAME,
} from './api.token';
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
  applicationName: string,
  authApplicationName: string,
  config?: PraetorInjectionConfig
): Provider[] {
  const providers: Provider[] = [
    { provide: PRAETOR_API_URL, useValue: url },
    { provide: PRAETOR_APPLICATION_NAME, useValue: applicationName },
    { provide: PRAETOR_AUTH_APPLICATION_NAME, useValue: authApplicationName },
  ];

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
