import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { UriCostants } from '../../core/costants/uri-costants';
import { SlicingPropertyDto } from '../../core/models/slicing/slicing-property.models';

@Injectable({
  providedIn: 'root',
})
export class SlicingPropertyService {
  constructor(private readonly http: HttpClient) {}

  public getUserSlicingProfiles(id: string): Observable<SlicingPropertyDto[]> {
    const params = new HttpParams().set('userId', id);

    return this.http.get<SlicingPropertyDto[]>(
      `${UriCostants.slicingPropertyUrl}`,
      {
        params,
      }
    );
  }

  public saveSlicingProfile(profile: SlicingPropertyDto): Observable<string> {
    return this.http.patch<string>(
      `${UriCostants.slicingPropertyUrl}`,
      profile
    );
  }
}
