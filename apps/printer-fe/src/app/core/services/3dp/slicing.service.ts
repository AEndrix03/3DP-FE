import { Injectable } from '@angular/core';
import { UriFactory } from '../../utils/UriFactory';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { SlicingResultDto } from '../../models/slicing.models';

@Injectable({
  providedIn: 'root'
})
export class SlicingService {
  private readonly url = UriFactory.slicingApiUrl;

  constructor(private readonly http: HttpClient) {}

  /**
   * Get a slicing result by its ID
   * @param id The UUID of the slicing result
   * @returns An Observable of SlicingResultDto
   */
  getSlicingResultById(id: string): Observable<SlicingResultDto> {
    return this.http.get<SlicingResultDto>(`${this.url}/${id}`);
  }

  /**
   * Get all slicing results for a specific source file
   * @param sourceId The UUID of the source file
   * @returns An Observable of an array of SlicingResultDto
   */
  getAllSlicingResultBySourceId(sourceId: string): Observable<SlicingResultDto[]> {
    return this.http.get<SlicingResultDto[]>(`${this.url}/source/${sourceId}`);
  }

  /**
   * Delete a slicing result by its ID
   * @param id The UUID of the slicing result to delete
   * @returns An Observable of void
   */
  deleteSlicingResultById(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
