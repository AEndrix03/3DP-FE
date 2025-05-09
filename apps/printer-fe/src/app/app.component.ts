import { Component, OnDestroy } from '@angular/core';
import { TokenManagerService } from '@3-dp-fe/praetor-auth-kit';
import { RouterOutlet } from '@angular/router';
import { Subject } from 'rxjs';

@Component({
  selector: 'printer-root',
  imports: [RouterOutlet],
  template: '<router-outlet></router-outlet>',
})
export class AppComponent implements OnDestroy {
  private readonly unsubscribe = new Subject<void>();

  constructor(private readonly praetorTokenManager: TokenManagerService) {
    this.praetorTokenManager.start();
  }

  ngOnDestroy() {
    this.unsubscribe.next();
    this.unsubscribe.complete();
  }
}
