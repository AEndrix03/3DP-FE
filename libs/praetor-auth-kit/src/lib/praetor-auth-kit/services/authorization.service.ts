import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PRAETOR_API_URL } from '../tokens/api.token';
import {
  AuthorizationRequestDto,
  AuthorizationResponseDto,
} from '../models/authorization.models';

@Injectable({ providedIn: 'root' })
export class AuthorizationService {
  private readonly praetorUrl: string = inject(PRAETOR_API_URL);

  constructor(private readonly http: HttpClient) {}

  authorize(
    request: AuthorizationRequestDto
  ): Observable<AuthorizationResponseDto> {
    return this.http.post<AuthorizationResponseDto>(
      `${this.praetorUrl}/authorization/authorize`,
      request
    );
  }
}
