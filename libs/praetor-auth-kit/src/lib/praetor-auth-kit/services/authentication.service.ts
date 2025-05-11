import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PRAETOR_API_URL } from '../tokens/api.token';
import { LoginRequestDto, LoginResponseDto } from '../models/login.models';
import {
  RegisterRequestDto,
  RegisterResponseDto,
} from '../models/register.models';
import { ChangePasswordDto } from '../models/change-password.models';
import { RefreshRequestDto, RefreshResponseDto } from '../models/tokens.models';

@Injectable({ providedIn: 'root' })
export class AuthenticationService {
  private readonly praetorUrl: string = inject(PRAETOR_API_URL);

  constructor(private readonly http: HttpClient) {}

  login(request: LoginRequestDto): Observable<LoginResponseDto> {
    return this.http.post<LoginResponseDto>(
      `${this.praetorUrl}/authentication/login`,
      request
    );
  }

  register(request: RegisterRequestDto): Observable<RegisterResponseDto> {
    return this.http.post<RegisterResponseDto>(
      `${this.praetorUrl}/authentication/register`,
      request
    );
  }

  changePassword(request: ChangePasswordDto): Observable<void> {
    return this.http.post<void>(
      `${this.praetorUrl}/authentication/change-password`,
      request
    );
  }

  refresh(refreshRequest: RefreshRequestDto): Observable<RefreshResponseDto> {
    return this.http.post<RefreshResponseDto>(
      `${this.praetorUrl}/authentication/refresh`,
      refreshRequest
    );
  }
}
