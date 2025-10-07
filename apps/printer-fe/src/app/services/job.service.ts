import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { UriCostants } from '../core/costants/uri-costants';
import { JobStartRequestDto } from '../core/models/job.models';

@Injectable({
  providedIn: 'root',
})
export class JobService {
  constructor(private readonly http: HttpClient) {}

  public startPrint(request: JobStartRequestDto): Observable<string> {
    return this.http.post<string>(`${UriCostants.jobUrl}/start`, request);
  }
}
