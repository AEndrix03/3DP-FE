import { Router } from '@angular/router';
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LoginEffectService {
  constructor(private readonly router: Router) {}

  effect = () => this.router.navigate(['/dashboard']);
}
