import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class PraetorActionsService {
  private readonly _login$: Subject<void> = new Subject<void>();
  private readonly _logged$: Subject<void> = new Subject<void>();
  private readonly _logout$: Subject<void> = new Subject<void>();
  private readonly _changePassword$: Subject<void> = new Subject<void>();
  private readonly _changedPassword$: Subject<void> = new Subject<void>();

  public readonly login$: Observable<void> = this._login$.asObservable();
  public readonly logged$: Observable<void> = this._logged$.asObservable();
  public readonly logout$: Observable<void> = this._logout$.asObservable();
  public readonly changePassword$: Observable<void> =
    this._changePassword$.asObservable();
  public readonly changedPassword$: Observable<void> =
    this._changedPassword$.asObservable();

  public emitLoginAction() {
    this._login$.next();
  }

  public emitLoggedAction() {
    this._logged$.next();
  }

  public emitLogoutAction() {
    this._logout$.next();
  }

  public emitChangePasswordAction() {
    this._changePassword$.next();
  }

  public emitChangedPasswordAction() {
    this._changedPassword$.next();
  }
}
