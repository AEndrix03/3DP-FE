import {
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  Signal,
  ViewChild,
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
import { MessageService } from 'primeng/api';

import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { MaterialDto } from '../../../../core/models/material.models';
import { MaterialService } from '../../../../services/material.service';
import { FileService } from '../../../../services/file.service';
import { UriCostants } from '../../../../core/costants/uri-costants';
import { finalize, Observable, shareReplay, Subject, takeUntil } from 'rxjs';

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
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  private readonly config = inject(DynamicDialogConfig);
  private readonly destroy$ = new Subject<void>();
  private readonly messageService = inject(MessageService);

  protected readonly material: MaterialDto | null =
    this.config.data?.material || null;
  protected readonly isNew: Signal<boolean> = computed(
    () => this.material == null
  );

  protected materialForm!: FormGroup;
  protected isUploadingImage = false;

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
    private readonly materialService: MaterialService,
    private readonly fileService: FileService
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
      // Store image ID
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
        // Image field contains only the ID
        image: this.material.image || '',
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

  /**
   * Get image URL from ID
   */
  protected getImageUrl(imageId: string | null): string | null {
    if (!imageId) return null;
    return `${UriCostants.filesUrl}/download?id=${imageId}`;
  }

  /**
   * Get current image URL from form
   */
  protected getCurrentImageUrl(): string | null {
    const imageId = this.materialForm.get('image')?.value;
    return this.getImageUrl(imageId);
  }

  /**
   * Check if material has an image
   */
  protected get hasImage(): boolean {
    return !!this.materialForm.get('image')?.value;
  }

  /**
   * Opens file input dialog for image selection
   */
  protected onImportImageClick(): void {
    this.fileInput.nativeElement.click();
  }

  /**
   * Remove the current image
   */
  protected onRemoveImageClick(): void {
    this.materialForm.patchValue({ image: '' });
    this.messageService.add({
      severity: 'info',
      summary: 'Image Removed',
      detail: 'Material image has been removed',
    });
  }

  /**
   * Handles file selection and upload
   */
  protected onFileSelected(event: Event): void {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];

    if (!file) {
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      this.messageService.add({
        severity: 'error',
        summary: 'Invalid File',
        detail: 'Please select a valid image file',
      });
      return;
    }

    // Validate file size (max 5MB)
    const maxSizeInMB = 5;
    if (file.size > maxSizeInMB * 1024 * 1024) {
      this.messageService.add({
        severity: 'error',
        summary: 'File Too Large',
        detail: `File size must be less than ${maxSizeInMB}MB`,
      });
      return;
    }

    this.uploadImage(file);

    // Clear the input so the same file can be selected again
    target.value = '';
  }

  /**
   * Uploads the selected image and updates the form
   */
  private uploadImage(file: File): void {
    this.isUploadingImage = true;

    this.fileService
      .uploadImage(file)
      .pipe(
        finalize(() => {
          this.isUploadingImage = false;
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (imageId: string) => {
          // Update the form with the new image ID
          this.materialForm.patchValue({
            image: imageId,
          });

          this.messageService.add({
            severity: 'success',
            summary: 'Upload Successful',
            detail: 'Image uploaded successfully',
          });
        },
        error: (error) => {
          console.error('Image upload failed:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Upload Failed',
            detail: 'Failed to upload image. Please try again.',
          });
        },
      });
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
