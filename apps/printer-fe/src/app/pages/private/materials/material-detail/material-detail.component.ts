import {
  Component,
  computed,
  effect,
  input,
  InputSignal,
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

import { DynamicDialogRef } from 'primeng/dynamicdialog';
import { MaterialDto } from '../../../../core/models/material.models';

@Component({
  selector: 'printer-material-detail',
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
export class MaterialDetailComponent implements OnInit {
  public readonly material: InputSignal<MaterialDto | null> = input.required();

  protected readonly isNew: Signal<boolean> = computed(
    () => this.material() == null
  );

  protected materialForm!: FormGroup;

  // Form options
  protected readonly materialTypes = [
    { label: 'PLA', value: 'PLA' },
    { label: 'ABS', value: 'ABS' },
    { label: 'PETG', value: 'PETG' },
    { label: 'TPU', value: 'TPU' },
    { label: 'ASA', value: 'ASA' },
    { label: 'PC', value: 'PC' },
    { label: 'NYLON', value: 'NYLON' },
    { label: 'PVA', value: 'PVA' },
    { label: 'HIPS', value: 'HIPS' },
    { label: 'WOOD', value: 'WOOD' },
    { label: 'METAL', value: 'METAL' },
    { label: 'CARBON_FIBER', value: 'CARBON_FIBER' },
    { label: 'OTHER', value: 'OTHER' },
  ];

  protected readonly diameterOptions = [
    { label: '1.75mm', value: '1.75' },
    { label: '2.85mm', value: '2.85' },
    { label: '3.00mm', value: '3.00' },
  ];

  protected readonly booleanOptions = [
    { label: 'Yes', value: 'true' },
    { label: 'No', value: 'false' },
  ];

  constructor(private ref: DynamicDialogRef, private readonly fb: FormBuilder) {
    // Form state management effects
    effect(() => {
      if (this.materialForm && this.material()) {
        this.loadMaterialData();
      }
    });
  }

  ngOnInit(): void {
    this.initializeForm();
    this.loadMaterialData();
  }

  private initializeForm(): void {
    this.materialForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(128)]],
      type: ['PLA', Validators.required],
      brand: ['', [Validators.required, Validators.maxLength(64)]],
      densityGCm3: [
        '1.24',
        [Validators.required, Validators.min(0.1), Validators.max(20)],
      ],
      diameterMm: ['1.75', Validators.required],
      costPerKg: ['25.00', [Validators.required, Validators.min(0)]],
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
      requiresHeatedBed: ['false', Validators.required],
      requiresChamberHeating: ['false', Validators.required],
      supportsSoluble: ['false', Validators.required],
      shrinkageFactor: [
        '0.02',
        [Validators.required, Validators.min(0), Validators.max(1)],
      ],
      image: [''],
    });

    // Add cross-validation for temperature range
    this.materialForm.addValidators(this.temperatureRangeValidator());
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

  private loadMaterialData(): void {
    const currentMaterial = this.material();
    if (currentMaterial) {
      this.materialForm.patchValue({
        name: currentMaterial.name,
        type: currentMaterial.type,
        brand: currentMaterial.brand,
        densityGCm3: currentMaterial.densityGCm3,
        diameterMm: currentMaterial.diameterMm,
        costPerKg: currentMaterial.costPerKg,
        recommendedExtruderTempMinC:
          currentMaterial.recommendedExtruderTempMinC,
        recommendedExtruderTempMaxC:
          currentMaterial.recommendedExtruderTempMaxC,
        recommendedBedTempC: currentMaterial.recommendedBedTempC,
        requiresHeatedBed: currentMaterial.requiresHeatedBed,
        requiresChamberHeating: currentMaterial.requiresChamberHeating,
        supportsSoluble: currentMaterial.supportsSoluble,
        shrinkageFactor: currentMaterial.shrinkageFactor,
        image: currentMaterial.image,
      });
    }
  }

  // Form getters and methods
  protected get formValue(): any {
    return {
      ...this.materialForm.value,
      id: this.material()?.id,
    };
  }

  protected get isFormValid(): boolean {
    return this.materialForm.valid;
  }

  protected get isDirty(): boolean {
    return this.materialForm.dirty;
  }

  protected resetForm(): void {
    this.materialForm.reset();
    this.loadMaterialData();
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

    // Check form-level validation errors
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
      console.log('Form is invalid. Errors:', this.getFormValidationErrors());
    }
  }

  protected onCancelClick(): void {
    this.ref.close(null);
  }

  // Helper methods
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

  protected onImageError(event: any): void {
    event.target.style.display = 'none';
  }

  // Debug method to help identify validation issues
  private getFormValidationErrors(): any {
    const formErrors: any = {};

    Object.keys(this.materialForm.controls).forEach((key) => {
      const controlErrors = this.materialForm.get(key)?.errors;
      if (controlErrors) {
        formErrors[key] = controlErrors;
      }
    });

    // Add form-level errors
    if (this.materialForm.errors) {
      formErrors['form'] = this.materialForm.errors;
    }

    return formErrors;
  }
}
