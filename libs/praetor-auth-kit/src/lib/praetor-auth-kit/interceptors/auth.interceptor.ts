import { inject } from '@angular/core';
import {
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { TokenStorageService } from '../services/token-storage.service';
import { PRAETOR_BEARER_INCLUDE_URLS } from '../tokens/bearer-config.token';
import { Observable } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<any>,
  next: HttpHandlerFn
): Observable<HttpEvent<any>> => {
  const tokenStorage = inject(TokenStorageService);
  const includeUrls = inject(PRAETOR_BEARER_INCLUDE_URLS);

  const token = tokenStorage.getAccessToken();
  const shouldAttachToken = includeUrls.some((url) => req.url.includes(url));

  if (token && shouldAttachToken) {
    const authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });
    return next(authReq);
  }

  return next(req);
};
