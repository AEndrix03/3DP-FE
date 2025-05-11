import { Component, signal, WritableSignal } from '@angular/core';
import { PrivateSidebarComponent } from './private-sidebar/private-sidebar.component';
import { PrivateNavbarComponent } from './private-navbar/private-navbar.component';
import { Router, RouterOutlet } from '@angular/router';

@Component({
  selector: 'printer-layout-private',
  imports: [PrivateSidebarComponent, PrivateNavbarComponent, RouterOutlet],
  templateUrl: './layout-private.component.html',
})
export class LayoutPrivateComponent {
  public readonly visibleSidebar: WritableSignal<boolean> = signal(true);
  public readonly userRole: WritableSignal<string> = signal('');

  constructor(private readonly router: Router) {}

  public logout() {
    this.router.navigate(['logout']);
  }

  public goToProfile() {
    this.router.navigate(['profile']);
  }
}
