import { inject, Injectable } from '@angular/core';
import {
  PraetorActionsService,
  TokenManagerService,
} from '@3-dp-fe/praetor-auth-kit';
import { tap } from 'rxjs';
import { Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class AppInitService {
  constructor(
    private readonly praetorTokenManager: TokenManagerService,
    private readonly praetorActionsService: PraetorActionsService,
    private readonly router: Router
  ) {}

  public init() {
    this.startTokenManage();
    this.initAuthActions();
  }

  private startTokenManage() {
    this.praetorTokenManager.start();
  }

  private initAuthActions() {
    this.praetorActionsService.logged$
      .pipe(tap(() => this.router.navigate(['dashboard'])))
      .subscribe();
  }
}

export const initializeAppFn = () => {
  const initService = inject(AppInitService);
  initService.init();
};
