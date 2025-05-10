import { inject, Injectable } from '@angular/core';
import { TokenManagerService } from '@3-dp-fe/praetor-auth-kit';

@Injectable({ providedIn: 'root' })
export class AppInitService {
  constructor(private readonly praetorTokenManager: TokenManagerService) {}

  public init() {
    this.startTokenManager();
  }

  private startTokenManager() {
    this.praetorTokenManager.start();
  }
}

export const initializeAppFn = () => {
  const initService = inject(AppInitService);
  initService.init();
};
