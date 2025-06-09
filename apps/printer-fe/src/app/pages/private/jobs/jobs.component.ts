import {
  Component,
  computed,
  OnDestroy,
  OnInit,
  signal,
  Signal,
  WritableSignal,
} from '@angular/core';
import { PageTitleComponent } from '../../../core/components/shared/page-title/page-title.component';
import { JobsQueueComponent } from './jobs-queue/jobs-queue.component';
import { JobSimpleDto } from '../../../core/models/job.models';
import {
  BehaviorSubject,
  catchError,
  filter,
  finalize,
  map,
  Observable,
  of,
  Subject,
  takeUntil,
  tap,
} from 'rxjs';
import { AsyncPipe } from '@angular/common';
import { JobsModelsGridComponent } from './jobs-models-grid/jobs-models-grid.component';
import { createPrinter } from '@schematics/angular/third_party/github.com/Microsoft/TypeScript/lib/typescript';
import { Button } from 'primeng/button';
import { FileUpload, FileUploadHandlerEvent } from 'primeng/fileupload';
import { ModelService } from '../../../services/model.service';
import { Router } from '@angular/router';
import { ModelDto } from '../../../core/models/model.models';
import { FileService } from '../../../services/file.service';

@Component({
  selector: 'printer-jobs',
  imports: [
    PageTitleComponent,
    JobsQueueComponent,
    AsyncPipe,
    JobsModelsGridComponent,
    Button,
    FileUpload,
  ],
  templateUrl: './jobs.component.html',
})
export class JobsComponent implements OnInit, OnDestroy {
  private readonly loading: WritableSignal<boolean> = signal(false);
  protected readonly isLoading: Signal<boolean> = computed(() =>
    this.loading()
  );

  private readonly _glbModels: WritableSignal<Record<string, Blob>> = signal(
    {}
  );
  protected readonly glbModels: Signal<Record<string, Blob>> = computed(() =>
    this._glbModels()
  );

  private readonly jobSubject$: Subject<JobSimpleDto[]> = new BehaviorSubject<
    JobSimpleDto[]
  >([]);
  private readonly modelsSubject$: Subject<ModelDto[]> = new BehaviorSubject<
    ModelDto[]
  >([]);

  protected readonly jobList$: Observable<JobSimpleDto[]> =
    this.jobSubject$.asObservable();
  protected readonly modelList$: Observable<ModelDto[]> =
    this.modelsSubject$.asObservable();

  private readonly unsubscribe$ = new Subject<void>();

  constructor(
    private readonly fileService: FileService,
    private readonly modelService: ModelService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.loadModels();

    this.modelsSubject$
      .asObservable()
      .pipe(
        takeUntil(this.unsubscribe$),
        tap((models) =>
          models
            .filter((model) => this._glbModels()[model.id] == null)
            .forEach((model) => this.loadGlb(model.resourceId))
        )
      )
      .subscribe();
  }

  ngOnDestroy(): void {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }

  protected importModel(event: FileUploadHandlerEvent) {
    this.loading.set(true);
    this.fileService
      .uploadModel(event.files[0])
      .pipe(
        catchError(() => of(null)),
        filter((id) => id != null),
        tap(() => this.loadModels()),
        finalize(() => this.loading.set(false))
      )
      .subscribe();
  }

  protected onJobSelected(jobId: string) {
    // Questo metodo è attualmente vuoto, ma deve essere presente.
  }

  protected onModelSelected(modelId: string) {
    this.router.navigate(['jobs/model-detail'], {
      queryParams: { id: modelId },
    });
  }

  protected readonly createPrinter = createPrinter;

  private loadModels() {
    console.log('loadModels() called.');
    this.modelService
      .getAllModels()
      .pipe(
        catchError(() => of([])),
        tap((results) => {
          this.modelsSubject$.next(results);
          console.log('modelsSubject$ emitted results:', results);
        })
      )
      .subscribe();
  }

  private loadGlb(id: string) {
    console.log(`loadGlb() called for ID: ${id}`);
    this.fileService
      .downloadGlb(id)
      .pipe(
        catchError((err) => {
          console.error(`Error on loading glb with id: ${id}`, err);
          return of(null);
        }),
        filter((glb) => glb != null),
        map((glb) => {
          const glbs = { ...this._glbModels() };
          glbs[id] = glb;
          return glbs;
        }),
        tap((glbs) => {
          this._glbModels.set(glbs);
          console.log(
            `GLB model with id ${id} successfully added to _glbModels.`
          );
        })
      )
      .subscribe();
  }
}
