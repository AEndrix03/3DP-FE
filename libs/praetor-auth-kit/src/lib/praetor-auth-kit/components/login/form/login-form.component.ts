import {
  Component,
  EventEmitter,
  input,
  InputSignal,
  Output,
} from '@angular/core';
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
import { LoginRequestDto } from '../../../models/login.models';

@Component({
  selector: 'praetor-login-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    InputTextModule,
    PasswordModule,
    ButtonModule,
  ],
  templateUrl: './login-form.component.html',
})
export class LoginFormComponent {
  readonly loginForm: FormGroup;
  readonly loading: InputSignal<boolean> = input(false);

  @Output() login = new EventEmitter<LoginRequestDto>();
  @Output() changePassword = new EventEmitter<void>();

  constructor(private readonly fb: FormBuilder) {
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
          updateOn: 'change',
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

  emitLoginEvent(): void {
    if (this.loginForm.valid) {
      this.login.emit(this.loginForm.value);
    } else {
      this.loginForm.markAllAsTouched();
    }
  }
}
