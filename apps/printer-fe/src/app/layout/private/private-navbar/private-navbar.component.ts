import {
  Component,
  EventEmitter,
  Input,
  Output,
  ViewChild,
} from '@angular/core';
import { Menu } from 'primeng/menu';
import { Avatar } from 'primeng/avatar';
import { ThemeModeButtonComponent } from '../../../core/components/shared/theme-mode-button/theme-mode-button.component';
import { NgOptimizedImage } from '@angular/common';

@Component({
  selector: 'printer-private-navbar',
  templateUrl: './private-navbar.component.html',
  standalone: true,
  imports: [Menu, Avatar, ThemeModeButtonComponent, NgOptimizedImage],
})
export class PrivateNavbarComponent {
  @Input() userRole: string = '';

  @Output() toggleSidebar = new EventEmitter<void>();
  @Output() profile = new EventEmitter<void>();
  @Output() logout = new EventEmitter<void>();

  @ViewChild('userMenu') userMenu!: Menu;

  userMenuItems = [
    {
      label: 'Profilo',
      icon: 'pi pi-user',
      command: () => this.profile.emit(),
    },
    {
      label: 'Logout',
      icon: 'pi pi-sign-out',
      command: () => this.logout.emit(),
    },
  ];

  toggleUserMenu(event: MouseEvent) {
    this.userMenu.toggle(event);
  }
}
