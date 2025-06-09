import {
  ApplicationConfig,
  provideAppInitializer,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { appRoutes } from './app.routes';
import {
  provideClientHydration,
  withEventReplay,
} from '@angular/platform-browser';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import Preset from './core/styles/themes/preset';
import {
  authInterceptor,
  PRAETOR_LOGIN_EFFECTS,
  providePraetor,
} from '@3-dp-fe/praetor-auth-kit';
import { environment } from './environments/environment';
import {
  provideHttpClient,
  withFetch,
  withInterceptors,
} from '@angular/common/http';
import { initializeAppFn } from './core/services/app-init.service';
import { LoginEffectService } from './core/services/auth/login-effect.service';
import { dateInterceptor } from './core/interceptors/date.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideClientHydration(withEventReplay()),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideAppInitializer(initializeAppFn),
    provideRouter(appRoutes),
    provideAnimationsAsync(),
    provideHttpClient(
      withFetch(),
      withInterceptors([authInterceptor, dateInterceptor])
    ),
    providePraetor(
      environment.praetorApiUrl,
      environment.applicationName,
      environment.praetorAuthApplicationName
    ),
    {
      provide: PRAETOR_LOGIN_EFFECTS,
      useFactory: (s: LoginEffectService) => s.effect,
      deps: [LoginEffectService],
      multi: true,
    },
    providePrimeNG({
      theme: {
        preset: Preset,
        options: {
          darkModeSelector: '.printer-dark-mode',
        },
      },
    }),
  ],
};
