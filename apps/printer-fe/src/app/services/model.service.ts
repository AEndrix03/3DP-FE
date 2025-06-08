import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ModelSimpleDto } from '../core/models/model.models';
import { Observable } from 'rxjs';
import { UriCostants } from '../core/costants/uri-costants';

@Injectable({
  providedIn: 'root',
})
export class ModelService {
  constructor(private readonly http: HttpClient) {}

  public getAllModels(): Observable<ModelSimpleDto[]> {
    return this.http.get<ModelSimpleDto[]>(`${UriCostants.modelsUrl}/file`);
  }

  public downloadGlb(id: string): Observable<Blob> {
    const params = new HttpParams().set('id', id);

    return this.http.get(`${UriCostants.modelsUrl}/file/download/glb`, {
      params,
      responseType: 'blob',
    });
  }
}
