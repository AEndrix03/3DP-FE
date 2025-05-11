import {
  Component,
  computed,
  effect,
  Input,
  Signal,
  signal,
  WritableSignal,
} from '@angular/core';
import { Button, ButtonSeverity } from 'primeng/button';
import { ThemeModeService } from './theme-mode.service';

@Component({
  selector: 'printer-theme-mode-button',
  imports: [Button],
  templateUrl: './theme-mode-button.component.html',
})
export class ThemeModeButtonComponent {
  @Input() outlined: boolean = false;
  @Input() rounded: boolean = false;
  @Input() text: boolean = false;
  @Input() severity: ButtonSeverity;

  public readonly theme: WritableSignal<ThemeMode> = signal('dark');
  public readonly userPreferedTheme: WritableSignal<ThemeMode> =
    signal('light');
  public readonly _icon: Signal<string> = computed(() =>
    this.theme() === 'dark' ? 'pi pi-moon' : 'pi pi-sun'
  );

  constructor(private readonly themeModeService: ThemeModeService) {
    this.userPreferedTheme.set(this.themeModeService.getUserPreferedTheme());

    effect(() => this.theme.set(this.userPreferedTheme()));
    effect(() => this._toggle(this.theme()));
  }

  public toggle() {
    this.theme.set(this.theme() === 'dark' ? 'light' : 'dark');
  }

  private _toggle(theme: ThemeMode) {
    if (theme === 'light' && this.themeModeService.enabledDarkMode()) {
      this.themeModeService.toggleThemeMode();
    } else if (theme === 'dark' && this.themeModeService.enabledLightMode()) {
      this.themeModeService.toggleThemeMode();
    }
  }
}

export type ThemeMode = 'light' | 'dark';
