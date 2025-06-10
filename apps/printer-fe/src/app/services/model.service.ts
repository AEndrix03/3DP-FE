import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ModelDto, ModelSaveDto } from '../core/models/model.models';
import { Observable } from 'rxjs';
import { UriCostants } from '../core/costants/uri-costants';

@Injectable({
  providedIn: 'root',
})
export class ModelService {
  constructor(private readonly http: HttpClient) {}

  public getAllModels(): Observable<ModelDto[]> {
    return this.http.get<ModelDto[]>(`${UriCostants.modelsUrl}/all`);
  }

  public getModelById(id: string): Observable<ModelDto> {
    const params = new HttpParams().set('id', id);

    return this.http.get<ModelDto>(`${UriCostants.modelsUrl}`, {
      params,
    });
  }

  public saveModel(model: ModelSaveDto): Observable<string> {
    return this.http.patch<string>(`${UriCostants.modelsUrl}`, model);
  }
}
