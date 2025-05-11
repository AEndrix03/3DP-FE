import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PRAETOR_API_URL } from '../tokens/api.token';
import { UserDto } from '../models/user.models';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly praetorUrl: string = inject(PRAETOR_API_URL);

  constructor(private readonly http: HttpClient) {}

  getMe(): Observable<UserDto> {
    return this.http.get<UserDto>(`${this.praetorUrl}/user/me`);
  }
}
