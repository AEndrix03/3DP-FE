import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MaterialDto } from '../core/models/material.models';
import { Observable } from 'rxjs';
import { UriCostants } from '../core/costants/uri-costants';

@Injectable({
  providedIn: 'root',
})
export class MaterialService {
  constructor(private readonly http: HttpClient) {}

  public getAllMaterials(): Observable<MaterialDto[]> {
    return this.http.get<MaterialDto[]>(`${UriCostants.materialUrl}`);
  }
}
