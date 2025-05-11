import { inject } from '@angular/core';
import {
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { TokenStorageService } from '../services/token/token-storage.service';
import {
  PRAETOR_BEARER_EXCLUDE_URLS,
  PRAETOR_BEARER_INCLUDE_URLS,
} from '../tokens/bearer-config.token';
import { Observable } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<any>,
  next: HttpHandlerFn
): Observable<HttpEvent<any>> => {
  const tokenStorage = inject(TokenStorageService);
  const includeUrls = inject(PRAETOR_BEARER_INCLUDE_URLS);
  const excludeUrls = inject(PRAETOR_BEARER_EXCLUDE_URLS);

  const token = tokenStorage.getAccessToken();

  const isExcluded = excludeUrls.some((pattern) => req.url.includes(pattern));

  const isIncluded =
    includeUrls.length === 0 ||
    includeUrls.some((pattern) => req.url.includes(pattern));

  const shouldAttachToken = !isExcluded && isIncluded;

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
