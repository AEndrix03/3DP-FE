import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { SlicingQueueCreateDto } from '../../core/models/slicing/slicing-queue.models';
import { UriCostants } from '../../core/costants/uri-costants';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class SlicingQueueService {
  constructor(private readonly http: HttpClient) {}

  public enqueueSlicing(request: SlicingQueueCreateDto): Observable<any> {
    return this.http.post(`${UriCostants.slicingQueueUrl}`, request);
  }
}
