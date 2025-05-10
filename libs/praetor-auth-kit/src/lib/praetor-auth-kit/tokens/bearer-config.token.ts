import { InjectionToken } from '@angular/core';

export type StorageStrategy = 'session' | 'local';

export const PRAETOR_BEARER_STORAGE_STRATEGY =
  new InjectionToken<StorageStrategy>('PRAETOR_BEARER_STORAGE_STRATEGY', {
    providedIn: 'root',
    factory: () => 'session',
  });

export const PRAETOR_BEARER_ACCESS_TOKEN_NAME = new InjectionToken<string>(
  'PRAETOR_BEARER_ACCESS_TOKEN_NAME',
  {
    providedIn: 'root',
    factory: () => 'praetorAccessToken',
  }
);

export const PRAETOR_BEARER_REFRESH_TOKEN_NAME = new InjectionToken<string>(
  'PRAETOR_BEARER_REFRESH_TOKEN_NAME',
  {
    providedIn: 'root',
    factory: () => 'praetorRefreshToken',
  }
);

export const PRAETOR_BEARER_INCLUDE_URLS = new InjectionToken<string[]>(
  'PRAETOR_BEARER_INCLUDE_URLS',
  {
    providedIn: 'root',
    factory: () => ['/praetor'],
  }
);

export const PRAETOR_BEARER_EXCLUDE_URLS = new InjectionToken<string[]>(
  'PRAETOR_BEARER_EXCLUDE_URLS',
  {
    providedIn: 'root',
    factory: () => [
      '/praetor/authentication/login',
      '/praetor/authentication/refresh',
    ],
  }
);
