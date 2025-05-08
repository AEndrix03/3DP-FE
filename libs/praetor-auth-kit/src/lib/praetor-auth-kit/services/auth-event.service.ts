import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { LoginResponseDto } from '../models/login.models';

export type AuthEvent =
  | { type: 'loginSuccess'; payload: LoginResponseDto }
  | { type: 'logout' };

@Injectable({ providedIn: 'root' })
export class AuthEventsService {
  private readonly authEvents$ = new Subject<AuthEvent>();

  emit(event: AuthEvent) {
    this.authEvents$.next(event);
  }

  events$ = this.authEvents$.asObservable();
}
