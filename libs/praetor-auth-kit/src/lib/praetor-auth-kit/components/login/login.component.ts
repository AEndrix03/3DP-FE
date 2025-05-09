import { Component, signal, WritableSignal } from '@angular/core';
import { MessageService } from 'primeng/api';
import {
  AuthenticationService,
  AuthEventsService,
  LoginFormComponent,
  LoginRequestDto,
  PraetorActionsService,
} from '@3-dp-fe/praetor-auth-kit';
import { Toast } from 'primeng/toast';
import { ReactiveFormsModule } from '@angular/forms';
import { catchError, filter, finalize } from 'rxjs/operators';
import { of, tap } from 'rxjs';

@Component({
  selector: 'praetor-login',
  imports: [Toast, ReactiveFormsModule, LoginFormComponent],
  templateUrl: './login.component.html',
  providers: [MessageService],
})
export class LoginComponent {
  public readonly loading: WritableSignal<boolean> = signal(false);

  constructor(
    private readonly messageService: MessageService,
    private readonly authenticationService: AuthenticationService,
    private readonly authEventService: AuthEventsService,
    private readonly praetorActionsService: PraetorActionsService
  ) {}

  doLogin(request: LoginRequestDto) {
    this.loading.set(true);
    this.authenticationService
      .login(request)
      .pipe(
        catchError(() => {
          this.showError();
          return of(null);
        }),
        filter((payload) => payload != null),
        tap(() => this.showSuccess()),
        tap((payload) => this.authEventService.loginSuccess(payload)),
        tap(() => this.praetorActionsService.emitLoginAction()),
        finalize(() => this.loading.set(false))
      )
      .subscribe();
  }

  doChangePassword() {
    this.praetorActionsService.emitChangePasswordAction();
  }

  private showSuccess(): void {
    this.messageService.add({
      severity: 'success',
      summary: 'Login successful',
      detail: 'Welcome back!',
    });
  }

  private showError(): void {
    this.messageService.add({
      severity: 'error',
      summary: 'Login failed',
      detail: 'Email or password are incorrect',
    });
  }
}
