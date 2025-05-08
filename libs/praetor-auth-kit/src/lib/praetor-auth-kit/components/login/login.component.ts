import { Component, signal, WritableSignal } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { AuthenticationService } from '../../services/authentication.service';
import { catchError, filter, finalize, of, tap } from 'rxjs';

@Component({
  selector: 'praetor-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    InputTextModule,
    PasswordModule,
    ButtonModule,
    ToastModule,
  ],
  templateUrl: './login.component.html',
  providers: [MessageService],
})
export class LoginComponent {
  readonly loginForm: FormGroup;
  readonly loading: WritableSignal<boolean> = signal(false);

  constructor(
    private readonly fb: FormBuilder,
    private readonly messageService: MessageService,
    private readonly authenticationService: AuthenticationService
  ) {
    this.loginForm = this.fb.group({
      email: [
        '',
        {
          updateOn: 'blur',
          validators: [Validators.required, Validators.email],
        },
      ],
      password: [
        '',
        {
          updateOn: 'blur',
          validators: [Validators.required],
        },
      ],
    });
  }

  get emailFc(): FormControl {
    return this.loginForm.get('email') as FormControl;
  }

  get passwordFc(): FormControl {
    return this.loginForm.get('password') as FormControl;
  }

  onLogin(): void {
    if (this.loginForm.valid) {
      this.loading.set(true);
      this.authenticationService
        .login(this.loginForm.value)
        .pipe(
          catchError(() => {
            this.messageService.add({
              severity: 'error',
              summary: 'Login failed',
              detail: 'Email or password are incorrect',
            });
            return of(null);
          }),
          filter((res) => res != null),
          tap(() =>
            this.messageService.add({
              severity: 'success',
              summary: 'Login successful',
              detail: 'Welcome back!',
            })
          ),
          tap((res) => console.log(res)),
          finalize(() => this.loading.set(false))
        )
        .subscribe();
    } else {
      this.loginForm.markAllAsTouched();
    }
  }
}
