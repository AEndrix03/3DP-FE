import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { UriCostants } from '../core/costants/uri-costants';

@Injectable({
  providedIn: 'root',
})
export class FileService {
  constructor(private readonly http: HttpClient) {}

  public uploadModel(file: File): Observable<string> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<string>(`${UriCostants.filesUrl}/upload`, formData);
  }

  public uploadImage(file: File): Observable<string> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<string>(
      `${UriCostants.filesUrl}/upload/image`,
      formData
    );
  }

  public download(id: string): Observable<Blob> {
    const params = new HttpParams().set('id', id);

    return this.http.get(`${UriCostants.filesUrl}/download`, {
      params,
      responseType: 'blob',
    });
  }

  public downloadGlb(id: string): Observable<Blob> {
    const params = new HttpParams().set('id', id);

    return this.http.get(`${UriCostants.filesUrl}/download/glb`, {
      params,
      responseType: 'blob',
    });
  }
}
