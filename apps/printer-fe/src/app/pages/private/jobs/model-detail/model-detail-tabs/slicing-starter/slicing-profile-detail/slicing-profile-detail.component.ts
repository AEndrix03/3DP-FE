import {
  Component,
  computed,
  effect,
  input,
  InputSignal,
  OnInit,
  Signal,
  signal,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { CommonModule } from '@angular/common';

// PrimeNG Imports
import { TabViewModule } from 'primeng/tabview';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { DropdownModule } from 'primeng/dropdown';
import { ToggleButtonModule } from 'primeng/togglebutton';
import { TextareaModule } from 'primeng/textarea';
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ChipModule } from 'primeng/chip';

import { SlicingPropertyDto } from '../../../../../../../core/models/slicing/slicing-property.models';
import {
  AdhesionType,
  InfillPattern,
  QualityProfile,
  SupportPattern,
} from '../../../../../../../core/enums/slicing/slicing-property.enums';
import { DynamicDialogRef } from 'primeng/dynamicdialog';
import { MaterialDto } from '../../../../../../../core/models/material.models';

@Component({
  selector: 'printer-slicing-profile-detail',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    TabViewModule,
    InputTextModule,
    InputNumberModule,
    DropdownModule,
    ToggleButtonModule,
    TextareaModule,
    CardModule,
    DividerModule,
    ButtonModule,
    TagModule,
    ChipModule,
  ],
  templateUrl: './slicing-profile-detail.component.html',
})
export class SlicingProfileDetailComponent implements OnInit {
  public readonly profile: InputSignal<SlicingPropertyDto | null> =
    input.required();
  public readonly avaiableMaterials: InputSignal<MaterialDto[]> =
    input.required();

  protected readonly isNew: Signal<boolean> = computed(
    () => this.profile() == null
  );

  protected readonly isDisabled: Signal<boolean> = computed(
    () => !this.isNew()
  );

  protected profileForm!: FormGroup;

  // Materials management signals
  protected materialSearchTerm = signal('');
  protected selectedMaterialType = signal<string | null>(null);
  protected selectedMaterialIds = signal<string[]>([]);

  protected readonly materialTypeOptions = computed(() => {
    const types = [
      ...new Set(
        this.avaiableMaterials()
          .map((m) => m.typeName || m.type?.name)
          .filter(Boolean)
      ),
    ];
    return [
      { label: 'All Types', value: null },
      ...types.map((type) => ({ label: type, value: type })),
    ];
  });

  protected readonly filteredMaterials = computed(() => {
    const searchTerm = this.materialSearchTerm().toLowerCase();
    const selectedType = this.selectedMaterialType();

    return this.avaiableMaterials().filter((material) => {
      const materialType = material.typeName || material.type?.name || '';
      const materialBrand = material.brandName || material.brand?.name || '';

      const matchesSearch =
        !searchTerm ||
        material.name.toLowerCase().includes(searchTerm) ||
        materialBrand.toLowerCase().includes(searchTerm) ||
        materialType.toLowerCase().includes(searchTerm);

      const matchesType = !selectedType || materialType === selectedType;

      return matchesSearch && matchesType;
    });
  });

  protected readonly selectedMaterialsCount = computed(
    () => this.selectedMaterialIds().length
  );

  // Form options
  protected readonly qualityProfiles = [
    { label: 'Draft', value: QualityProfile.DRAFT },
    { label: 'Standard', value: QualityProfile.STANDARD },
    { label: 'High', value: QualityProfile.HIGH },
    { label: 'Ultra', value: QualityProfile.ULTRA },
  ];

  protected readonly infillPatterns = [
    { label: 'Grid', value: InfillPattern.GRID },
    { label: 'Lines', value: InfillPattern.LINES },
    { label: 'Triangles', value: InfillPattern.TRIANGLES },
    { label: 'Cubic', value: InfillPattern.CUBIC },
    { label: 'Gyroid', value: InfillPattern.GYROID },
    { label: 'Honeycomb', value: InfillPattern.HONEYCOMB },
    { label: 'Concentric', value: InfillPattern.CONCENTRIC },
  ];

  protected readonly supportPatterns = [
    { label: 'Grid', value: SupportPattern.GRID },
    { label: 'Lines', value: SupportPattern.LINES },
    { label: 'Zigzag', value: SupportPattern.ZIGZAG },
    { label: 'Triangles', value: SupportPattern.TRIANGLES },
  ];

  protected readonly adhesionTypes = [
    { label: 'None', value: AdhesionType.NONE },
    { label: 'Brim', value: AdhesionType.BRIM },
    { label: 'Raft', value: AdhesionType.RAFT },
    { label: 'Skirt', value: AdhesionType.SKIRT },
  ];

  constructor(private ref: DynamicDialogRef, private readonly fb: FormBuilder) {
    // Form state management effects
    effect(() => {
      if (this.profileForm) {
        if (this.isDisabled()) {
          this.profileForm.disable();
        } else {
          this.profileForm.enable();
        }
      }
    });

    effect(() => {
      if (this.profileForm && this.profile()) {
        this.loadProfileData();
      }
    });

    // Sync selected materials with form control
    effect(() => {
      if (this.profileForm) {
        this.profileForm
          .get('materialIds')
          ?.setValue(this.selectedMaterialIds());
      }
    });
  }

  ngOnInit(): void {
    this.initializeForm();
    this.loadProfileData();
  }

  private initializeForm(): void {
    this.profileForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(128)]],
      description: ['', Validators.maxLength(512)],
      qualityProfile: [QualityProfile.STANDARD],

      layerHeightMm: [
        0.2,
        [Validators.required, Validators.min(0.001), Validators.max(2.0)],
      ],
      firstLayerHeightMm: [null, [Validators.min(0.001), Validators.max(2.0)]],
      lineWidthMm: [0.4, [Validators.min(0.001), Validators.max(5.0)]],

      printSpeedMmS: [
        50,
        [Validators.required, Validators.min(0.1), Validators.max(1000)],
      ],
      firstLayerSpeedMmS: [20, [Validators.min(0.1), Validators.max(1000)]],
      travelSpeedMmS: [150, [Validators.min(0.1), Validators.max(1000)]],
      infillSpeedMmS: [null, [Validators.min(0.1), Validators.max(1000)]],
      outerWallSpeedMmS: [null, [Validators.min(0.1), Validators.max(1000)]],
      innerWallSpeedMmS: [null, [Validators.min(0.1), Validators.max(1000)]],
      topBottomSpeedMmS: [null, [Validators.min(0.1), Validators.max(1000)]],

      infillPercentage: [
        20,
        [Validators.required, Validators.min(0), Validators.max(100)],
      ],
      infillPattern: [InfillPattern.GRID, Validators.required],
      perimeterCount: [2, [Validators.min(0), Validators.max(10)]],
      topSolidLayers: [3, [Validators.min(0), Validators.max(20)]],
      bottomSolidLayers: [3, [Validators.min(0), Validators.max(20)]],
      topBottomThicknessMm: [null, [Validators.min(0), Validators.max(10)]],

      supportsEnabled: [false, Validators.required],
      supportAngleThreshold: [45, [Validators.min(0), Validators.max(90)]],
      supportDensityPercentage: [20, [Validators.min(0), Validators.max(100)]],
      supportPattern: [SupportPattern.GRID],
      supportZDistanceMm: [0.2, [Validators.min(0), Validators.max(5)]],

      adhesionType: [AdhesionType.NONE],
      brimEnabled: [false, Validators.required],
      brimWidthMm: [5, [Validators.min(0), Validators.max(100)]],

      fanEnabled: [true, Validators.required],
      fanSpeedPercentage: [100, [Validators.min(0), Validators.max(100)]],

      retractionEnabled: [true, Validators.required],
      retractionDistanceMm: [1, [Validators.min(0), Validators.max(10)]],
      zhopEnabled: [false, Validators.required],
      zhopHeightMm: [0.2, [Validators.min(0), Validators.max(5)]],

      extruderTempC: [null, [Validators.min(150), Validators.max(350)]],
      bedTempC: [null, [Validators.min(0), Validators.max(150)]],

      advancedSettings: ['{}'],
      slicerId: [''], // Removed Validators.required - this should be set by backend
      isPublic: [false, Validators.required],
      isActive: [true, Validators.required],
      materialIds: [[]],
    });
  }

  private loadProfileData(): void {
    const currentProfile = this.profile();
    if (currentProfile) {
      this.profileForm.patchValue(currentProfile);
      // Load selected materials
      if (currentProfile.materialIds) {
        this.selectedMaterialIds.set([...currentProfile.materialIds]);
      }
    }
  }

  // Materials management methods
  protected isMaterialSelected(materialId: string): boolean {
    return this.selectedMaterialIds().includes(materialId);
  }

  protected toggleMaterial(materialId: string): void {
    const currentSelected = this.selectedMaterialIds();
    if (currentSelected.includes(materialId)) {
      this.selectedMaterialIds.set(
        currentSelected.filter((id) => id !== materialId)
      );
    } else {
      this.selectedMaterialIds.set([...currentSelected, materialId]);
    }
  }

  protected clearAllMaterials(): void {
    this.selectedMaterialIds.set([]);
  }

  protected clearFilters(): void {
    this.materialSearchTerm.set('');
    this.selectedMaterialType.set(null);
  }

  protected trackByMaterialId(index: number, material: MaterialDto): string {
    return material.id;
  }

  protected getMaterialTypeSeverity(
    type: string
  ): 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast' {
    const typeMap: {
      [key: string]:
        | 'success'
        | 'info'
        | 'warn'
        | 'danger'
        | 'secondary'
        | 'contrast';
    } = {
      PLA: 'success',
      ABS: 'info',
      PETG: 'warn',
      TPU: 'danger',
      ASA: 'secondary',
      PC: 'contrast',
      NYLON: 'info',
      PVA: 'warn',
    };

    return typeMap[type.toUpperCase()] || 'secondary';
  }

  protected getMaterialTypeBadgeClass(typeName: string): string {
    const typeClassMap: { [key: string]: string } = {
      PLA: 'bg-green-100 text-green-800',
      ABS: 'bg-blue-100 text-blue-800',
      PETG: 'bg-purple-100 text-purple-800',
      TPU: 'bg-orange-100 text-orange-800',
      ASA: 'bg-red-100 text-red-800',
      PC: 'bg-gray-100 text-gray-800',
      NYLON: 'bg-indigo-100 text-indigo-800',
      PVA: 'bg-cyan-100 text-cyan-800',
    };

    return typeClassMap[typeName?.toUpperCase()] || 'bg-gray-100 text-gray-800';
  }

  protected getMaterialNameById(materialId: string): string {
    const material = this.avaiableMaterials().find((m) => m.id === materialId);
    return material ? material.name : 'Unknown Material';
  }

  protected onImageError(event: any): void {
    // Hide the broken image - the template will show the default placeholder
    event.target.style.display = 'none';
  }

  // Form getters and methods
  protected get formValue(): SlicingPropertyDto {
    return this.profileForm.value as SlicingPropertyDto;
  }

  protected get isFormValid(): boolean {
    return this.profileForm.valid;
  }

  protected get isDirty(): boolean {
    return this.profileForm.dirty;
  }

  protected resetForm(): void {
    this.profileForm.reset();
    this.selectedMaterialIds.set([]);
    this.materialSearchTerm.set('');
    this.selectedMaterialType.set(null);
    this.loadProfileData();
  }

  protected getFieldError(fieldName: string): string | null {
    const field = this.profileForm.get(fieldName);
    if (field && field.invalid && (field.dirty || field.touched)) {
      const errors = field.errors;
      if (errors?.['required']) return 'This field is required';
      if (errors?.['min']) return `Minimum value is ${errors['min'].min}`;
      if (errors?.['max']) return `Maximum value is ${errors['max'].max}`;
      if (errors?.['maxlength'])
        return `Maximum length is ${errors['maxlength'].requiredLength}`;
    }
    return null;
  }

  protected onSaveClick(): void {
    if (this.profileForm.valid) {
      this.ref.close(this.formValue);
    } else {
      this.profileForm.markAllAsTouched();

      // Debug: log form errors to console
      console.log('Form is invalid. Errors:', this.getFormValidationErrors());
    }
  }

  protected onCancelClick(): void {
    this.ref.close(null);
  }

  // Debug method to help identify validation issues
  private getFormValidationErrors(): any {
    const formErrors: any = {};

    Object.keys(this.profileForm.controls).forEach((key) => {
      const controlErrors = this.profileForm.get(key)?.errors;
      if (controlErrors) {
        formErrors[key] = controlErrors;
      }
    });

    return formErrors;
  }
}
