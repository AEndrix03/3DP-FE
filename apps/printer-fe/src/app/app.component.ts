import { Component } from '@angular/core';
import { TokenManagerService } from '@3-dp-fe/praetor-auth-kit';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'printer-root',
  imports: [RouterOutlet],
  template: '<router-outlet></router-outlet>',
})
export class AppComponent {
  constructor(private readonly praetorTokenManager: TokenManagerService) {
    this.praetorTokenManager.start();
  }
}
