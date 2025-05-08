import { Component } from '@angular/core';
import { LoginComponent, TokenManagerService } from '@3-dp-fe/praetor-auth-kit';

@Component({
  selector: 'app-root',
  imports: [LoginComponent],
  templateUrl: './app.component.html',
})
export class AppComponent {
  constructor(private readonly praetorTokenManager: TokenManagerService) {
    this.praetorTokenManager.start();
  }
}
