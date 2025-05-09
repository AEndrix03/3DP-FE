import { Component, OnDestroy } from '@angular/core';
import {
  PraetorActionsService,
  TokenManagerService,
} from '@3-dp-fe/praetor-auth-kit';
import { Router, RouterOutlet } from '@angular/router';
import { Subject, takeUntil, tap } from 'rxjs';

@Component({
  selector: 'printer-root',
  imports: [RouterOutlet],
  template: '<router-outlet></router-outlet>',
})
export class AppComponent implements OnDestroy {
  private readonly unsubscribe = new Subject<void>();

  constructor(
    private readonly praetorTokenManager: TokenManagerService,
    private readonly praetorActionsService: PraetorActionsService,
    private readonly router: Router
  ) {
    this.praetorTokenManager.start();

    this.praetorActionsService.login$
      .pipe(
        takeUntil(this.unsubscribe),
        tap(() => this.router.navigate(['dashboard']))
      )
      .subscribe();
  }

  ngOnDestroy() {
    this.unsubscribe.next();
    this.unsubscribe.complete();
  }
}
