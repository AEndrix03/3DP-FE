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
    return this.http.get<ModelSimpleDto[]>(`${UriCostants.modelsUrl}`);
  }

  public uploadModel(file: File): Observable<string> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<string>(`${UriCostants.modelsUrl}/upload`, formData);
  }

  public downloadGlb(id: string): Observable<Blob> {
    const params = new HttpParams().set('id', id);

    return this.http.get(`${UriCostants.modelsUrl}/download/glb`, {
      params,
      responseType: 'blob',
    });
  }
}
