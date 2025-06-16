import {
  Component,
  computed,
  effect,
  signal,
  Signal,
  WritableSignal,
} from '@angular/core';
import { CommonModule, NgIf } from '@angular/common';
import { PageTitleComponent } from '../../../core/components/shared/page-title/page-title.component';
import { SlicingResultInfoComponent } from './slicing-result-info/slicing-result-info.component';
import { SlicingResultTabsComponent } from './slicing-result-tabs/slicing-result-tabs.component';
import { ActivatedRoute, Router } from '@angular/router';
import { ModelDetailPreviewComponent } from '../jobs/model-detail/model-detail-preview/model-detail-preview.component';
import { SlicingResultDto } from '../../../core/models/slicing.models';
import { SlicingService } from '../../../services/slicing.service';
import { FileService } from '../../../services/file.service';
import { map, switchMap, take, tap } from 'rxjs';

@Component({
  selector: 'printer-slicing-result',
  imports: [
    CommonModule,
    PageTitleComponent,
    SlicingResultInfoComponent,
    SlicingResultTabsComponent,
    ModelDetailPreviewComponent,
    NgIf,
  ],
  templateUrl: './slicing-result.component.html',
})
export class SlicingResultComponent {
  protected readonly back: Signal<() => void> = signal(null);
  protected readonly showBack: Signal<boolean> = computed(
    () => this.back() != null
  );

  protected readonly slicingResult: WritableSignal<SlicingResultDto> =
    signal(null);
  protected readonly sourceStlBlob: WritableSignal<Blob> = signal(null);

  private readonly fromRoute: WritableSignal<string | null> = signal(null);
  private readonly fromRouteId: WritableSignal<string | null> = signal(null);

  constructor(
    private readonly router: Router,
    private readonly actrivatedRoute: ActivatedRoute,
    private readonly slicingService: SlicingService,
    private readonly fileService: FileService
  ) {
    this.back = computed(() =>
      this.fromRoute() == null
        ? null
        : () =>
            this.router.navigate([this.fromRoute()], {
              queryParams: { id: this.fromRouteId() },
            })
    );

    const state = this.router.getCurrentNavigation()?.extras
      ?.state as unknown as any;

    this.fromRoute.set(state?.from as string | null);
    this.fromRouteId.set(state?.id as string | null);

    this.actrivatedRoute.queryParams
      .pipe(
        take(1),
        map((p) => p['id']),
        switchMap((id) => this.slicingService.getSlicingResultById(id)),
        tap((res) => this.slicingResult.set(res))
      )
      .subscribe();

    effect(() => {
      const res = this.slicingResult();

      if (res != null) {
        this.fileService
          .downloadGlb(res.sourceId)
          .pipe(tap((res) => this.sourceStlBlob.set(res)))
          .subscribe();
      }
    });
  }
}
