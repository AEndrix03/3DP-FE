import {
  Component,
  inject,
  input,
  InputSignal,
  signal,
  WritableSignal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { ButtonModule } from 'primeng/button';
import { SlicingProfileComponent } from './slicing-profile/slicing-profile.component';
import { SlicingPropertyDto } from '../../../../../../core/models/slicing/slicing-property.models';
import { SlicingProfileDetailComponent } from './slicing-profile-detail/slicing-profile-detail.component';
import { filter, map, switchMap, tap } from 'rxjs';
import { SlicingPropertyService } from '../../../../../../services/slicing/slicing-property.service';
import { userStore } from '@3-dp-fe/praetor-auth-kit';
import { MaterialService } from '../../../../../../services/material.service';
import { MaterialDto } from '../../../../../../core/models/material.models';

@Component({
  selector: 'printer-slicing-starter',
  standalone: true,
  imports: [CommonModule, ButtonModule, SlicingProfileComponent],
  templateUrl: './slicing-starter.component.html',
  providers: [DialogService],
})
export class SlicingStarterComponent {
  public readonly profiles: InputSignal<SlicingPropertyDto[]> =
    input.required();

  private readonly materials: WritableSignal<MaterialDto[]> = signal([]);
  private readonly userStore = inject(userStore);

  createRef: DynamicDialogRef;
  detailRef: DynamicDialogRef;

  constructor(
    private ref: DynamicDialogRef,
    private readonly dialogService: DialogService,
    private readonly slicingPropertyService: SlicingPropertyService,
    private readonly materialService: MaterialService
  ) {
    this.materialService
      .getAllMaterials()
      .pipe(tap((materials) => this.materials.set(materials)))
      .subscribe();
  }

  protected createProfile() {
    this.createRef = this.dialogService.open(SlicingProfileDetailComponent, {
      header: 'Start Slicing',
      modal: true,
      closeOnEscape: true,
      closable: true,
      width: '1500px',
      inputValues: {
        profile: null,
        avaiableMaterials: this.materials(),
      },
    });

    this.createRef.onClose
      .pipe(
        filter((res) => res !== null),
        map((res: SlicingPropertyDto) => ({
          ...res,
          createdByUserId: this.userStore.user().id,
        })),
        switchMap((res: SlicingPropertyDto) =>
          this.slicingPropertyService.saveSlicingProfile(res)
        )
      )
      .subscribe();
  }

  protected openProfile(profile: SlicingPropertyDto): void {
    this.detailRef = this.dialogService.open(SlicingProfileDetailComponent, {
      header: 'Start Slicing',
      modal: true,
      closeOnEscape: true,
      closable: true,
      width: '1500px',
      inputValues: {
        profile,
        avaiableMaterials: this.materials(),
      },
    });
  }

  protected startSlicing(propertyId: string) {
    this.ref.close(propertyId);
  }
}
