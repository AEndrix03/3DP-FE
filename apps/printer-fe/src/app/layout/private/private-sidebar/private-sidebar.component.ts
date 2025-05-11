import {
  Component,
  effect,
  input,
  InputSignal,
  signal,
  WritableSignal,
} from '@angular/core';
import { CommonModule, NgClass, NgIf } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { SidebarModule } from 'primeng/sidebar';
import { ThemeModeService } from '../../../core/components/theme-mode-button/theme-mode.service';

@Component({
  selector: 'printer-private-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ButtonModule,
    TooltipModule,
    SidebarModule,
    NgClass,
    NgIf,
  ],
  templateUrl: './private-sidebar.component.html',
})
export class PrivateSidebarComponent {
  public readonly visible: InputSignal<boolean> = input.required();

  protected readonly isDarkMode: WritableSignal<boolean> = signal(false);

  constructor(private readonly themeService: ThemeModeService) {
    this.isDarkMode.set(this.themeService.darkMode());

    effect(() => this.isDarkMode.set(this.themeService.darkMode()));
  }
}
