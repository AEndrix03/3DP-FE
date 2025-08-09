import {
  Component,
  computed,
  effect,
  inject,
  OnDestroy,
  OnInit,
  Signal,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { CommonModule } from '@angular/common';

// PrimeNG Imports
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { DropdownModule } from 'primeng/dropdown';
import { ToggleButtonModule } from 'primeng/togglebutton';
import { TextareaModule } from 'primeng/textarea';
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';
import { ButtonModule } from 'primeng/button';

import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { MaterialDto } from '../../../../core/models/material.models';
import { MaterialService } from '../../../../services/material.service';
import { Observable, shareReplay, Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'printer-material-detail',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    InputTextModule,
    InputNumberModule,
    DropdownModule,
    ToggleButtonModule,
    TextareaModule,
    CardModule,
    DividerModule,
    ButtonModule,
  ],
  templateUrl: './material-detail.component.html',
})
export class MaterialDetailComponent implements OnInit, OnDestroy {
  private readonly config = inject(DynamicDialogConfig);
  private readonly destroy$ = new Subject<void>();

  protected readonly material: MaterialDto | null =
    this.config.data?.material || null;
  protected readonly isNew: Signal<boolean> = computed(
    () => this.material == null
  );

  protected materialForm!: FormGroup;

  // Async dropdown options using existing MaterialService
  protected readonly materialTypeOptions$: Observable<string[]>;
  protected readonly materialBrandOptions$: Observable<string[]>;

  // Form options (keeping diameter as static since it's standardized)
  protected readonly diameterOptions = [
    { label: '1.75mm', value: '1.75' },
    { label: '2.85mm', value: '2.85' },
    { label: '3.00mm', value: '3.00' },
  ];

  constructor(
    private ref: DynamicDialogRef,
    private readonly fb: FormBuilder,
    private readonly materialService: MaterialService
  ) {
    // Initialize async streams using existing service
    this.materialTypeOptions$ = this.materialService
      .getMaterialTypes()
      .pipe(shareReplay(1), takeUntil(this.destroy$));
    this.materialBrandOptions$ = this.materialService
      .getMaterialBrands()
      .pipe(shareReplay(1), takeUntil(this.destroy$));

    // Form state management effects
    effect(() => {
      if (this.materialForm && this.material) {
        this.loadMaterialData();
      }
    });
  }

  ngOnInit(): void {
    this.initializeForm();
    this.loadMaterialData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeForm(): void {
    this.materialForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(128)]],

      // Changed from hardcoded to dropdown values
      type: [null, Validators.required],
      brand: [null, Validators.required],

      densityGCm3: [
        1.24,
        [Validators.required, Validators.min(0.1), Validators.max(20)],
      ],
      diameterMm: ['1.75', Validators.required],
      costPerKg: [25.0, [Validators.required, Validators.min(0)]],
      recommendedExtruderTempMinC: [
        190,
        [Validators.required, Validators.min(150), Validators.max(350)],
      ],
      recommendedExtruderTempMaxC: [
        220,
        [Validators.required, Validators.min(150), Validators.max(350)],
      ],
      recommendedBedTempC: [
        60,
        [Validators.required, Validators.min(0), Validators.max(150)],
      ],
      requiresHeatedBed: [false, Validators.required],
      requiresChamberHeating: [false, Validators.required],
      supportsSoluble: [false, Validators.required],
      shrinkageFactor: [
        0.002,
        [Validators.required, Validators.min(0), Validators.max(1)],
      ],
      image: [''],
    });

    // Add cross-validation for temperature range
    this.materialForm.addValidators(this.temperatureRangeValidator());
  }

  private loadMaterialData(): void {
    if (this.material) {
      this.materialForm.patchValue({
        name: this.material.name,
        type: this.material.typeName || this.material.type?.name,
        brand: this.material.brandName || this.material.brand?.name,
        densityGCm3: parseFloat(this.material.densityGCm3 || '1.24'),
        diameterMm: this.material.diameterMm,
        costPerKg: parseFloat(this.material.costPerKg || '25'),
        recommendedExtruderTempMinC: this.material.recommendedExtruderTempMinC,
        recommendedExtruderTempMaxC: this.material.recommendedExtruderTempMaxC,
        recommendedBedTempC: this.material.recommendedBedTempC,
        requiresHeatedBed: this.material.requiresHeatedBed === 'true',
        requiresChamberHeating: this.material.requiresChamberHeating === 'true',
        supportsSoluble: this.material.supportsSoluble === 'true',
        shrinkageFactor: parseFloat(this.material.shrinkageFactor || '0.002'),
        image: this.material.image,
      });
    }
  }

  private temperatureRangeValidator(): ValidatorFn {
    return (formGroup) => {
      const minTemp = formGroup.get('recommendedExtruderTempMinC')?.value;
      const maxTemp = formGroup.get('recommendedExtruderTempMaxC')?.value;

      if (minTemp && maxTemp && minTemp >= maxTemp) {
        return { temperatureRange: true };
      }

      return null;
    };
  }

  protected get formValue(): MaterialDto {
    const value = this.materialForm.value;
    return {
      ...value,
      id: this.material?.id,
      densityGCm3: value.densityGCm3?.toString(),
      costPerKg: value.costPerKg?.toString(),
      shrinkageFactor: value.shrinkageFactor?.toString(),
      requiresHeatedBed: value.requiresHeatedBed?.toString(),
      requiresChamberHeating: value.requiresChamberHeating?.toString(),
      supportsSoluble: value.supportsSoluble?.toString(),
      // Keep legacy fields for backward compatibility
      typeName: value.type,
      brandName: value.brand,
    };
  }

  protected get isFormValid(): boolean {
    return this.materialForm.valid;
  }

  protected getFieldError(fieldName: string): string | null {
    const field = this.materialForm.get(fieldName);
    if (field && field.invalid && (field.dirty || field.touched)) {
      const errors = field.errors;
      if (errors?.['required']) return 'This field is required';
      if (errors?.['min']) return `Minimum value is ${errors['min'].min}`;
      if (errors?.['max']) return `Maximum value is ${errors['max'].max}`;
      if (errors?.['maxlength'])
        return `Maximum length is ${errors['maxlength'].requiredLength}`;
    }

    if (
      fieldName === 'recommendedExtruderTempMaxC' &&
      this.materialForm.hasError('temperatureRange')
    ) {
      return 'Maximum temperature must be higher than minimum temperature';
    }

    return null;
  }

  protected hasFormError(errorType: string): boolean {
    return this.materialForm.hasError(errorType) && this.materialForm.touched;
  }

  protected onSaveClick(): void {
    if (this.materialForm.valid) {
      this.ref.close(this.formValue);
    } else {
      this.materialForm.markAllAsTouched();
    }
  }

  protected onCancelClick(): void {
    this.ref.close(null);
  }

  protected onImageError(event: any): void {
    event.target.style.display = 'none';
  }

  // Helper method to get material type icon (remains the same)
  protected getMaterialTypeIcon(type: string): string {
    const iconMap: { [key: string]: string } = {
      PLA: 'pi-leaf',
      ABS: 'pi-cog',
      PETG: 'pi-shield',
      TPU: 'pi-heart',
      ASA: 'pi-sun',
      PC: 'pi-desktop',
      NYLON: 'pi-wrench',
      PVA: 'pi-droplet',
      HIPS: 'pi-box',
      WOOD: 'pi-tree',
      METAL: 'pi-bolt',
      CARBON_FIBER: 'pi-diamond',
    };

    return iconMap[type] || 'pi-circle';
  }
}
