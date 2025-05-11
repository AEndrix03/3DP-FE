import {
  computed,
  Injectable,
  Signal,
  signal,
  WritableSignal,
} from '@angular/core';
import { ThemeMode } from './theme-mode-button.component';

@Injectable({
  providedIn: 'root',
})
export class ThemeModeService {
  private readonly _darkMode: WritableSignal<boolean> = signal(true);
  public readonly darkMode: Signal<boolean> = computed(() => this._darkMode());

  public getUserPreferedTheme(): ThemeMode {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }

  public enabledDarkMode(): boolean {
    return (
      document
        .querySelector('html')
        ?.classList?.contains('printer-dark-mode') === true
    );
  }

  public enabledLightMode(): boolean {
    return (
      document
        .querySelector('html')
        ?.classList?.contains('printer-dark-mode') === false
    );
  }

  public toggleThemeMode() {
    document.querySelector('html')?.classList.toggle('printer-dark-mode');
    this._darkMode.set(this.enabledDarkMode());
  }
}
