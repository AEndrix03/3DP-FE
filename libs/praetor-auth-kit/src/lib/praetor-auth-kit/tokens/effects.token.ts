import { InjectionToken } from '@angular/core';

export const PRAETOR_LOGIN_EFFECTS = new InjectionToken<
  () => void | Promise<void>
>('PRAETOR_LOGIN_EFFECTS');

export const PRAETOR_LOGOUT_EFFECTS = new InjectionToken<
  () => void | Promise<void>
>('PRAETOR_LOGOUT_EFFECTS');
