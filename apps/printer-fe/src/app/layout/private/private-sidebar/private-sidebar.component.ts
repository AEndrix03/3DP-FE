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
import { ThemeModeService } from '../../../core/components/shared/theme-mode-button/theme-mode.service';

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
  protected readonly collapsed: WritableSignal<boolean> = signal(true);

  protected readonly navItems = [
    {
      icon: 'pi pi-home',
      label: 'Dashboard',
      route: '/dashboard',
    },
    { icon: 'pi pi-box', label: 'Jobs', route: '/jobs' },
    {
      icon: 'pi pi-print',
      label: 'Printers',
      route: '/printers',
    },
    {
      icon: 'pi pi-th-large',
      label: 'Materials',
      route: '/materials',
    },
    {
      icon: 'pi pi-cog',
      label: 'Settings',
      route: '/settings',
    },
  ];

  constructor(private readonly themeService: ThemeModeService) {
    this.isDarkMode.set(this.themeService.darkMode());
    effect(() => this.isDarkMode.set(this.themeService.darkMode()));
  }

  toggleCollapse(): void {
    this.collapsed.set(!this.collapsed());
  }
}
