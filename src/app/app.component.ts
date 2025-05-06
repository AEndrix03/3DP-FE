import {Component} from '@angular/core';
import {LoginComponent} from '../../projects/praetor-auth/src/lib/components/login/login.component';

@Component({
  selector: 'app-root',
  imports: [LoginComponent],
  templateUrl: './app.component.html',
})
export class AppComponent {
}
