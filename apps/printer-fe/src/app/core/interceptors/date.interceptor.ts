import { HttpEvent, HttpHandlerFn, HttpInterceptorFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Interceptor funzionale per trasformare automaticamente le stringhe ISO date in oggetti Date
 */
export const dateInterceptor: HttpInterceptorFn = (
  req: HttpRequest<any>,
  next: HttpHandlerFn
): Observable<HttpEvent<any>> => {
  
  // Espressione regolare ISO 8601 per identificare stringhe di date
  const ISO_8601_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
  
  /**
   * Trasforma ricorsivamente le stringhe di date in oggetti Date
   */
  const transformDates = (body: any): any => {
    if (!body || typeof body !== 'object') {
      return body;
    }
    
    for (const key of Object.keys(body)) {
      const value = body[key];
      
      // Trasforma stringhe in date
      if (typeof value === 'string' && ISO_8601_REGEX.test(value)) {
        body[key] = new Date(value);
      } 
      // Processa ricorsivamente oggetti nidificati
      else if (value && typeof value === 'object') {
        transformDates(value);
      }
    }
    
    return body;
  };
  
  return next(req).pipe(
    map(event => {
      if (event instanceof HttpResponse) {
        // Clona la risposta per mantenerla immutabile
        const clonedResponse = event.clone({ 
          body: transformDates(event.body) 
        });
        return clonedResponse;
      }
      return event;
    })
  );
};