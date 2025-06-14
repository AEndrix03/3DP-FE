import {
  Component,
  effect,
  Signal,
  signal,
  untracked,
  viewChild,
  WritableSignal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  BehaviorSubject,
  filter,
  map,
  Subject,
  switchMap,
  take,
  takeUntil,
  tap,
} from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { ModelDetailInfoComponent } from './model-detail-info/model-detail-info.component';
import { ModelService } from 'apps/printer-fe/src/app/services/model.service';
import { FileService } from 'apps/printer-fe/src/app/services/file.service';
import { ModelDto } from 'apps/printer-fe/src/app/core/models/model.models';
import { ModelDetailPreviewComponent } from './model-detail-preview/model-detail-preview.component';
import { PageTitleComponent } from '../../../../core/components/shared/page-title/page-title.component';
import { ModelDetailTabsComponent } from './model-detail-tabs/model-detail-tabs.component';
import { ButtonModule } from 'primeng/button';
import { saveAs } from 'file-saver';

@Component({
  selector: 'printer-model-detail',
  imports: [
    CommonModule,
    ModelDetailPreviewComponent,
    ModelDetailInfoComponent,
    PageTitleComponent,
    ModelDetailTabsComponent,
    ButtonModule,
  ],
  templateUrl: './model-detail.component.html',
})
export class ModelDetailComponent {
  protected readonly model: WritableSignal<ModelDto> = signal(null);
  protected readonly preview: WritableSignal<Blob> = signal(null);

  private readonly _info: Signal<ModelDetailInfoComponent> = viewChild(
    ModelDetailInfoComponent
  );

  private readonly modelSubject: BehaviorSubject<string> =
    new BehaviorSubject<string>(null);

  private readonly unsubscribe$: Subject<void> = new Subject<void>();

  constructor(
    private readonly activatedRoute: ActivatedRoute,
    private readonly modelService: ModelService,
    private readonly fileService: FileService,
    private readonly router: Router
  ) {
    this.activatedRoute.queryParamMap
      .pipe(
        filter((map) => map != null),
        take(1),
        map((map) => map.get('id')),
        tap((id) => this.modelSubject.next(id))
      )
      .subscribe();

    this.modelSubject
      .asObservable()
      .pipe(
        takeUntil(this.unsubscribe$),
        filter((id) => id != null),
        switchMap((id) => this.modelService.getModelById(id)),
        tap((model) => this.model.set(model))
      )
      .subscribe();

    effect(() =>
      this.model()
        ? this.fileService
            .downloadGlb(this.model().resourceId)
            .subscribe((blob) => this.preview.set(blob))
        : null
    );
  }

  protected downloadStl() {
    this.fileService
      .download(this.model().resourceId)
      .pipe(tap((blob) => saveAs(blob, `${this.model().name}.stl`)))
      .subscribe();
  }

  protected save() {
    this.modelService
      .saveModel(untracked(() => this._info().data))
      .pipe(tap((id) => this.modelSubject.next(id)))
      .subscribe();
  }

  protected back() {
    this.router.navigate(['jobs']);
  }
}
