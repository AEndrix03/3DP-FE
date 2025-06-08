import { Component, effect, signal, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  BehaviorSubject,
  filter,
  map,
  Subject,
  take,
  takeUntil,
  tap,
} from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { ModelService } from 'apps/printer-fe/src/app/services/model.service';
import { ModelDetailDto } from 'apps/printer-fe/src/app/core/models/model.models';
import { ModelDetailPreviewComponent } from './model-detail-preview/model-detail-preview.component';
import { ModelDetailInfoComponent } from "./model-detail-info/model-detail-info.component";

@Component({
  selector: 'printer-model-detail',
  imports: [CommonModule, ModelDetailPreviewComponent, ModelDetailInfoComponent],
  templateUrl: './model-detail.component.html',
})
export class ModelDetailComponent {
  protected readonly id: WritableSignal<string> = signal(null);
  protected readonly model: WritableSignal<ModelDetailDto> = signal(null);
  protected readonly preview: WritableSignal<Blob> = signal(null);

  private readonly modelSubject: BehaviorSubject<string> =
    new BehaviorSubject<string>(null);

  private readonly unsubscribe$: Subject<void> = new Subject<void>();

  constructor(
    private readonly activatedRoute: ActivatedRoute,
    private readonly modelService: ModelService
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
        tap((id) => this.id.set(id)),
        filter((id) => id != null)
        // Ottieni model
      )
      .subscribe();

    effect(() =>
      this.id()
        ? this.modelService
            .downloadGlb(this.id())
            .subscribe((blob) => this.preview.set(blob))
        : null
    );
  }
}
