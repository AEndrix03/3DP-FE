import {
  Component,
  computed,
  signal,
  Signal,
  WritableSignal,
} from '@angular/core';
import { PageTitleComponent } from '../../../core/components/shared/page-title/page-title.component';
import { JobsQueueComponent } from './jobs-queue/jobs-queue.component';
import { JobSimpleDto } from '../../../core/models/job.models';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { AsyncPipe } from '@angular/common';
import { JobsModelsGridComponent } from './jobs-models-grid/jobs-models-grid.component';
import { ModelSimpleDto } from '../../../core/models/model.models';

@Component({
  selector: 'printer-jobs',
  imports: [
    PageTitleComponent,
    JobsQueueComponent,
    AsyncPipe,
    JobsModelsGridComponent,
  ],
  templateUrl: './jobs.component.html',
})
export class JobsComponent {
  private readonly loading: WritableSignal<boolean> = signal(false);
  protected readonly isLoading: Signal<boolean> = computed(() =>
    this.loading()
  );

  private readonly jobSubject$: Subject<JobSimpleDto[]> = new BehaviorSubject<
    JobSimpleDto[]
  >([]);
  private readonly modelsSubject$: Subject<ModelSimpleDto[]> =
    new BehaviorSubject<ModelSimpleDto[]>([]);
  protected readonly jobList$: Observable<JobSimpleDto[]> =
    this.jobSubject$.asObservable();
  protected readonly modelList$: Observable<ModelSimpleDto[]> =
    this.modelsSubject$.asObservable();

  constructor() {
    this.modelsSubject$.next([
      {
        id: 'none',
        name: 'Cube',
      },
    ]);
  }

  protected addModel() {}

  onJobSelected(jobId: string) {}
}
