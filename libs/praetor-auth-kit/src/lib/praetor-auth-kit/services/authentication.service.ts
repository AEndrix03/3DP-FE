import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { LoginRequestDto, LoginResponseDto } from '../models/login.models';
import { Observable } from 'rxjs';
import { PRAETOR_API_URL } from '../tokens/api-url.token';

@Injectable({
  providedIn: 'root',
})
export class AuthenticationService {
  private readonly praetorUrl: string = inject(PRAETOR_API_URL);

  constructor(private readonly http: HttpClient) {}

  public login(request: LoginRequestDto): Observable<LoginResponseDto> {
    return this.http.post<LoginResponseDto>(
      `${this.praetorUrl}/authentication/login`,
      request
    );
  }
}
