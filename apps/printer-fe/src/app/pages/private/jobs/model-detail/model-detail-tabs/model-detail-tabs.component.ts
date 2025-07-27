import {
  Component,
  effect,
  inject,
  input,
  InputSignal,
  signal,
  WritableSignal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TabsModule } from 'primeng/tabs';
import { ModelDetailTabSlicingComponent } from './model-detail-tab-slicing/model-detail-tab-slicing.component';
import { Router } from '@angular/router';
import { ModelDto } from '../../../../../core/models/model.models';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { SlicingStarterComponent } from './slicing-starter/slicing-starter.component';
import { SlicingResultDto } from '../../../../../core/models/slicing/slicing.models';
import { SlicingPropertyDto } from '../../../../../core/models/slicing/slicing-property.models';
import { SlicingPropertyService } from '../../../../../services/slicing/slicing-property.service';
import { SlicingService } from '../../../../../services/slicing/slicing.service';
import { filter, map, switchMap, tap } from 'rxjs';
import { userStore } from '@3-dp-fe/praetor-auth-kit';
import { SlicingQueueService } from '../../../../../services/slicing/slicing-queue.service';
import { SlicingQueueCreateDto } from '../../../../../core/models/slicing/slicing-queue.models';

@Component({
  selector: 'printer-model-detail-tabs',
  imports: [CommonModule, TabsModule, ModelDetailTabSlicingComponent],
  templateUrl: './model-detail-tabs.component.html',
  providers: [DialogService],
})
export class ModelDetailTabsComponent {
  public readonly model: InputSignal<ModelDto> = input.required();

  protected readonly slicingResults: WritableSignal<SlicingResultDto[]> =
    signal([]);
  protected readonly slicingProfiles: WritableSignal<SlicingPropertyDto[]> =
    signal([]);

  private readonly userStore = inject(userStore);

  ref: DynamicDialogRef;

  constructor(
    private readonly router: Router,
    private readonly dialogService: DialogService,
    private readonly slicingService: SlicingService,
    private readonly slicingPropertyService: SlicingPropertyService,
    private readonly slicingQueueService: SlicingQueueService
  ) {
    effect(() => this.reloadResults(this.model()?.resourceId));
    effect(() => this.reloadProfiles(this.userStore.user()?.id));
  }

  protected openSlicingResultDetail(id: string) {
    this.router.navigate(['slicing-result'], {
      queryParams: { id },
      state: { from: `jobs/model-detail`, id: this.model().id },
    });
  }

  protected openSlicingStarter() {
    this.ref = this.dialogService.open(SlicingStarterComponent, {
      header: 'Start Slicing',
      modal: true,
      closeOnEscape: true,
      closable: true,
      width: '600px',
      inputValues: {
        profiles: this.slicingProfiles(),
      },
    });

    this.ref.onClose
      .pipe(
        filter((res) => res != null),
        map((slicingPropertyId: string) => ({
          modelId: this.model().id,
          slicingPropertyId,
          userId: this.userStore.user().id,
        })),
        switchMap((request: SlicingQueueCreateDto) =>
          this.slicingQueueService.enqueueSlicing(request)
        )
      )
      .subscribe();
  }

  private reloadResults(modelId: string) {
    if (modelId != null) {
      this.slicingService
        .getSlicingResultBySourceId(modelId)
        .pipe(tap((res) => this.slicingResults.set(res)))
        .subscribe();
    }
  }

  private reloadProfiles(userId: string) {
    if (userId != null) {
      this.slicingPropertyService
        .getUserSlicingProfiles(userId)
        .pipe(tap((res) => this.slicingProfiles.set(res)))
        .subscribe();
    }
  }
}
