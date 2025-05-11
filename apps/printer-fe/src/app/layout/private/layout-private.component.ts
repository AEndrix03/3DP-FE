import {
  Component,
  computed,
  inject,
  Signal,
  signal,
  WritableSignal,
} from '@angular/core';
import { PrivateSidebarComponent } from './private-sidebar/private-sidebar.component';
import { PrivateNavbarComponent } from './private-navbar/private-navbar.component';
import { Router, RouterOutlet } from '@angular/router';
import { userStore } from '@3-dp-fe/praetor-auth-kit';

@Component({
  selector: 'printer-layout-private',
  imports: [PrivateSidebarComponent, PrivateNavbarComponent, RouterOutlet],
  templateUrl: './layout-private.component.html',
})
export class LayoutPrivateComponent {
  private readonly userStore = inject(userStore);

  public readonly visibleSidebar: WritableSignal<boolean> = signal(true);
  public readonly userRole: Signal<string>;

  constructor(private readonly router: Router) {
    this.userRole = computed(
      () =>
        (this.userStore.activeRoleId() != null && this.userStore.user() != null
          ? this.userStore.user()?.roles[this.userStore.activeRoleId() ?? '']
          : 'No Role') ?? 'ERROR'
    );
  }

  public logout() {
    this.router.navigate(['logout']);
  }

  public goToProfile() {
    this.router.navigate(['profile']);
  }
}
