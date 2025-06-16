import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { SlicingResultDto } from '../core/models/slicing.models';
import { Observable } from 'rxjs';
import { UriCostants } from '../core/costants/uri-costants';

@Injectable({
  providedIn: 'root',
})
export class SlicingService {
  constructor(private readonly http: HttpClient) {}

  public getSlicingResultById(id: string): Observable<SlicingResultDto> {
    const params = new HttpParams().set('id', id);

    return this.http.get<SlicingResultDto>(`${UriCostants.slicingUrl}`, {
      params,
    });
  }

  public getSlicingResultBySourceId(
    id: string
  ): Observable<SlicingResultDto[]> {
    const params = new HttpParams().set('id', id);

    return this.http.get<SlicingResultDto[]>(
      `${UriCostants.slicingUrl}/source`,
      {
        params,
      }
    );
  }
}
