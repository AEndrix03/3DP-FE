import { InjectionToken, Provider } from '@angular/core';

export const PRAETOR_API_URL = new InjectionToken<string>('PRAETOR_API_URL');

export function providePraetor(url: string): Provider {
  return { provide: PRAETOR_API_URL, useValue: url };
}
