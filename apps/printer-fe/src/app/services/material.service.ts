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

  /**
   * Get all materials
   */
  public getAllMaterials(): Observable<MaterialDto[]> {
    return this.http.get<MaterialDto[]>(`${UriCostants.materialUrl}`);
  }

  /**
   * Get material by ID
   */
  public getMaterialById(id: string): Observable<MaterialDto> {
    return this.http.get<MaterialDto>(`${UriCostants.materialUrl}/${id}`);
  }

  /**
   * Save material (create or update using PATCH)
   * The backend will handle create/update logic based on presence of ID
   */
  public saveMaterial(material: MaterialDto): Observable<string> {
    return this.http.patch<string>(`${UriCostants.materialUrl}`, material);
  }

  /**
   * Delete a material by ID
   */
  public deleteMaterial(id: string): Observable<void> {
    return this.http.delete<void>(`${UriCostants.materialUrl}/${id}`);
  }

  /**
   * Search materials with filters
   */
  public searchMaterials(filters: {
    name?: string;
    type?: string;
    brand?: string;
  }): Observable<MaterialDto[]> {
    const params = new URLSearchParams();

    if (filters.name) params.append('name', filters.name);
    if (filters.type) params.append('type', filters.type);
    if (filters.brand) params.append('brand', filters.brand);

    const queryString = params.toString();
    const url = queryString
      ? `${UriCostants.materialUrl}/search?${queryString}`
      : `${UriCostants.materialUrl}`;

    return this.http.get<MaterialDto[]>(url);
  }

  /**
   * Get materials by type
   */
  public getMaterialsByType(type: string): Observable<MaterialDto[]> {
    return this.http.get<MaterialDto[]>(
      `${UriCostants.materialUrl}/type/${type}`
    );
  }

  /**
   * Get materials by brand
   */
  public getMaterialsByBrand(brand: string): Observable<MaterialDto[]> {
    return this.http.get<MaterialDto[]>(
      `${UriCostants.materialUrl}/brand/${brand}`
    );
  }

  /**
   * Get all available material types
   */
  public getMaterialTypes(): Observable<string[]> {
    return this.http.get<string[]>(`${UriCostants.materialUrl}/types`);
  }

  /**
   * Get all available brands
   */
  public getMaterialBrands(): Observable<string[]> {
    return this.http.get<string[]>(`${UriCostants.materialUrl}/brands`);
  }
}
