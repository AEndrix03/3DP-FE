import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { TabViewModule } from 'primeng/tabview';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { DropdownModule } from 'primeng/dropdown';
import { CheckboxModule } from 'primeng/checkbox';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';
import { TooltipModule } from 'primeng/tooltip';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { finalize, map, Subject, switchMap, take, takeUntil } from 'rxjs';
import { PrinterService } from '../../../../services/printer.service';
import {
  PrinterDetailDto,
  PrinterDetailSaveDto,
} from '../../../../core/models/printer.models';

interface PrinterDetailDialogData {
  printerId?: string;
  isCreateMode?: boolean;
}

@Component({
  selector: 'printer-printer-detail',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TabViewModule,
    InputTextModule,
    InputNumberModule,
    DropdownModule,
    CheckboxModule,
    ButtonModule,
    CalendarModule,
    MessageModule,
    ProgressSpinnerModule,
    CardModule,
    DividerModule,
    TooltipModule,
  ],
  templateUrl: './printer-detail.component.html',
  styleUrls: ['./printer-detail.component.scss'],
})
export class PrinterDetailComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly printerService = inject(PrinterService);
  private readonly dialogRef = inject(DynamicDialogRef);
  private readonly dialogConfig = inject(
    DynamicDialogConfig<PrinterDetailDialogData>
  );
  private readonly destroy$ = new Subject<void>();

  // Form and state
  printerForm!: FormGroup;
  loading = false;
  saving = false;
  errorMessage = '';
  isCreateMode = false;
  printerId: string | null = null;
  activeTab = 0;

  // Dropdown options - keep only the data, UI will be in template
  readonly dropdownOptions = {
    yesNo: [
      { label: 'Yes', value: 'true' },
      { label: 'No', value: 'false' },
    ],
    kinematics: [
      { label: 'Cartesian', value: 'cartesian' },
      { label: 'CoreXY', value: 'corexy' },
      { label: 'Delta', value: 'delta' },
      { label: 'Polar', value: 'polar' },
    ],
    bedLeveling: [
      { label: 'Manual', value: 'manual' },
      { label: 'BLTouch', value: 'bltouch' },
      { label: 'Inductive Probe', value: 'inductive' },
      { label: 'Capacitive Probe', value: 'capacitive' },
      { label: 'Mesh Leveling', value: 'mesh' },
    ],
    hotend: [
      { label: 'E3D V6', value: 'e3d_v6' },
      { label: 'E3D Volcano', value: 'e3d_volcano' },
      { label: 'All Metal', value: 'all_metal' },
      { label: 'PTFE Lined', value: 'ptfe_lined' },
      { label: 'Direct Drive', value: 'direct_drive' },
      { label: 'Bowden', value: 'bowden' },
    ],
    buildPlateMaterial: [
      { label: 'Glass', value: 'glass' },
      { label: 'PEI Sheet', value: 'pei' },
      { label: 'BuildTak', value: 'buildtak' },
      { label: 'Aluminum', value: 'aluminum' },
      { label: 'Carbon Fiber', value: 'carbon_fiber' },
    ],
  };

  ngOnInit(): void {
    this.initializeComponent();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeComponent(): void {
    const data = this.dialogConfig.data;
    this.printerId = data?.printerId || null;
    this.isCreateMode = data?.isCreateMode || !this.printerId;

    this.initializeForm();
    this.setupFormValidation();

    if (this.printerId && !this.isCreateMode) {
      this.loadPrinterDetail();
    }
  }

  private initializeForm(): void {
    this.printerForm = this.fb.group({
      // General
      id: [''],
      name: ['', [Validators.required, Validators.maxLength(100)]],
      driverId: [''],
      firmwareVersionId: [''],
      firmwareInstalledAt: [null],

      // Dimensions
      buildVolumeXMm: [
        220,
        [
          Validators.required,
          this.positiveNumberValidator,
          Validators.min(1),
          Validators.max(1000),
        ],
      ],
      buildVolumeYMm: [
        220,
        [
          Validators.required,
          this.positiveNumberValidator,
          Validators.min(1),
          Validators.max(1000),
        ],
      ],
      buildVolumeZMm: [
        250,
        [
          Validators.required,
          this.positiveNumberValidator,
          Validators.min(1),
          Validators.max(1000),
        ],
      ],
      buildPlateMaterial: ['glass', [Validators.required]],
      bedSizeXMm: [
        220,
        [
          Validators.required,
          this.positiveNumberValidator,
          Validators.min(1),
          Validators.max(1000),
        ],
      ],
      bedSizeYMm: [
        220,
        [
          Validators.required,
          this.positiveNumberValidator,
          Validators.min(1),
          Validators.max(1000),
        ],
      ],

      // Extruder
      extruderCount: [
        1,
        [Validators.required, Validators.min(1), Validators.max(10)],
      ],
      nozzleDiameterMm: [
        0.4,
        [Validators.required, Validators.min(0.1), Validators.max(2.0)],
      ],
      maxNozzleTempC: [
        250,
        [Validators.required, Validators.min(100), Validators.max(500)],
      ],
      hotendType: ['e3d_v6', [Validators.required]],

      // Motion
      kinematicsType: ['cartesian', [Validators.required]],
      maxPrintSpeedMmS: [
        100,
        [
          Validators.required,
          this.positiveNumberValidator,
          Validators.min(1),
          Validators.max(1000),
        ],
      ],
      maxTravelSpeedMmS: [
        150,
        [
          Validators.required,
          this.positiveNumberValidator,
          Validators.min(1),
          Validators.max(1000),
        ],
      ],
      maxAccelerationMmS2: [
        3000,
        [
          Validators.required,
          this.positiveNumberValidator,
          Validators.min(100),
          Validators.max(10000),
        ],
      ],
      maxJerkMmS: [
        10,
        [
          Validators.required,
          this.positiveNumberValidator,
          Validators.min(1),
          Validators.max(100),
        ],
      ],

      // Heating
      hasHeatedBed: ['true', [Validators.required]],
      maxBedTempC: [
        80,
        [Validators.required, Validators.min(0), Validators.max(200)],
      ],
      hasHeatedChamber: ['false', [Validators.required]],
      maxChamberTempC: [
        0,
        [Validators.required, Validators.min(0), Validators.max(150)],
      ],

      // Features
      hasAutoBedLeveling: ['false', [Validators.required]],
      bedLevelingType: ['manual', [Validators.required]],
      hasFilamentSensor: ['false', [Validators.required]],
      hasPowerRecovery: ['false', [Validators.required]],
      hasResumePrint: ['false', [Validators.required]],
      minLayerHeightMm: [
        0.1,
        [Validators.required, Validators.min(0.01), Validators.max(1.0)],
      ],
      maxLayerHeightMm: [
        0.3,
        [Validators.required, Validators.min(0.1), Validators.max(2.0)],
      ],
    });
  }

  private positiveNumberValidator(
    control: AbstractControl
  ): ValidationErrors | null {
    const value = control.value;
    if (
      value !== null &&
      value !== undefined &&
      value !== '' &&
      (isNaN(value) || value <= 0)
    ) {
      return { positiveNumber: true };
    }
    return null;
  }

  private setupFormValidation(): void {
    // Heated bed conditional validation
    this.printerForm
      .get('hasHeatedBed')
      ?.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe((hasHeatedBed) => {
        const maxBedTempControl = this.printerForm.get('maxBedTempC');
        if (hasHeatedBed === 'true') {
          maxBedTempControl?.enable();
          maxBedTempControl?.setValidators([
            Validators.required,
            Validators.min(20),
            Validators.max(200),
          ]);
        } else {
          maxBedTempControl?.disable();
          maxBedTempControl?.setValue(0);
          maxBedTempControl?.setValidators([Validators.required]);
        }
        maxBedTempControl?.updateValueAndValidity();
      });

    // Heated chamber conditional validation
    this.printerForm
      .get('hasHeatedChamber')
      ?.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe((hasHeatedChamber) => {
        const maxChamberTempControl = this.printerForm.get('maxChamberTempC');
        if (hasHeatedChamber === 'true') {
          maxChamberTempControl?.enable();
          maxChamberTempControl?.setValidators([
            Validators.required,
            Validators.min(30),
            Validators.max(150),
          ]);
        } else {
          maxChamberTempControl?.disable();
          maxChamberTempControl?.setValue(0);
          maxChamberTempControl?.setValidators([Validators.required]);
        }
        maxChamberTempControl?.updateValueAndValidity();
      });

    // Auto bed leveling conditional logic
    this.printerForm
      .get('hasAutoBedLeveling')
      ?.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe((hasAutoBedLeveling) => {
        const bedLevelingTypeControl = this.printerForm.get('bedLevelingType');
        if (hasAutoBedLeveling === 'true') {
          bedLevelingTypeControl?.enable();
        } else {
          bedLevelingTypeControl?.setValue('manual');
          bedLevelingTypeControl?.disable();
        }
      });

    // Initialize conditional validations
    const hasHeatedBed = this.printerForm.get('hasHeatedBed')?.value;
    if (hasHeatedBed === 'true') {
      const maxBedTempControl = this.printerForm.get('maxBedTempC');
      maxBedTempControl?.setValidators([
        Validators.required,
        Validators.min(20),
        Validators.max(200),
      ]);
      maxBedTempControl?.updateValueAndValidity();
    }
  }

  private loadPrinterDetail(): void {
    if (!this.printerId) return;

    this.loading = true;
    this.errorMessage = '';

    this.printerService
      .getPrinterDetail(this.printerId)
      .pipe(
        take(1),
        finalize(() => (this.loading = false))
      )
      .subscribe({
        next: (printer: PrinterDetailDto) => this.populateForm(printer),
        error: (error) => {
          this.errorMessage =
            'Failed to load printer details. Please try again.';
          console.error('Error loading printer detail:', error);
        },
      });
  }

  private populateForm(printer: PrinterDetailDto): void {
    const formValue = {
      ...printer,
      firmwareInstalledAt: printer.firmwareInstalledAt
        ? new Date(printer.firmwareInstalledAt)
        : null,
      hasHeatedBed: printer.hasHeatedBed?.toString() || 'false',
      hasHeatedChamber: printer.hasHeatedChamber?.toString() || 'false',
      hasAutoBedLeveling: printer.hasAutoBedLeveling?.toString() || 'false',
      hasFilamentSensor: printer.hasFilamentSensor?.toString() || 'false',
      hasPowerRecovery: printer.hasPowerRecovery?.toString() || 'false',
      hasResumePrint: printer.hasResumePrint?.toString() || 'false',
    };

    this.printerForm.patchValue(formValue);
  }

  onSaveClick(): void {
    if (this.saving) return;

    if (this.printerForm.invalid) {
      this.markFormGroupTouched();
      this.focusFirstInvalidField();
      return;
    }

    this.saving = true;
    this.errorMessage = '';

    const formValue = this.printerForm.value;

    if (this.isCreateMode) {
      this.createAndUpdatePrinter(formValue);
    } else {
      this.updatePrinter(formValue);
    }
  }

  private createAndUpdatePrinter(formValue: any): void {
    this.printerService
      .createPrinter({
        name: formValue.name,
        driverId: formValue.driverId,
      })
      .pipe(
        take(1),
        switchMap((createdId: string) => {
          this.printerForm.get('id')?.setValue(createdId);
          const saveDto: PrinterDetailSaveDto = { ...formValue, id: createdId };
          return this.printerService.savePrinterDetail(saveDto).pipe(
            take(1),
            map(() => ({ savedId: createdId, data: saveDto }))
          );
        }),
        finalize(() => (this.saving = false))
      )
      .subscribe({
        next: ({ savedId, data }) => {
          this.closeDialog({ saved: true, printerId: savedId, data });
        },
        error: (error) => {
          this.errorMessage = 'Failed to create printer. Please try again.';
          console.error('Error creating printer:', error);
        },
      });
  }

  private updatePrinter(formValue: any): void {
    const saveDto: PrinterDetailSaveDto = {
      ...formValue,
      id: this.printerId || formValue.id,
    };

    this.printerService
      .savePrinterDetail(saveDto)
      .pipe(
        take(1),
        finalize(() => (this.saving = false))
      )
      .subscribe({
        next: (savedId: string) => {
          this.closeDialog({ saved: true, printerId: savedId, data: saveDto });
        },
        error: (error) => {
          this.errorMessage =
            'Failed to update printer details. Please try again.';
          console.error('Error updating printer detail:', error);
        },
      });
  }

  private closeDialog(result: any): void {
    try {
      this.dialogRef.close(result);
    } catch (error) {
      console.warn('Dialog already closed or error closing:', error);
      try {
        this.dialogRef.close();
      } catch (fallbackError) {
        console.error('Failed to close dialog:', fallbackError);
      }
    }
  }

  onCancelClick(): void {
    if (this.saving) return;
    this.dialogRef.close({ saved: false });
  }

  onTabChange(event: any): void {
    this.activeTab = event.index;
  }

  private markFormGroupTouched(): void {
    Object.keys(this.printerForm.controls).forEach((key) => {
      this.printerForm.get(key)?.markAsTouched();
    });
  }

  private focusFirstInvalidField(): void {
    const firstInvalidControl = Object.keys(this.printerForm.controls).find(
      (key) => this.printerForm.get(key)?.invalid
    );

    if (firstInvalidControl) {
      const element = document.getElementById(firstInvalidControl);
      element?.focus();
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  // Utility methods for template
  isFieldInvalid(fieldName: string): boolean {
    const field = this.printerForm.get(fieldName);
    return !!(field?.invalid && field?.touched);
  }

  getFieldErrorMessage(fieldName: string): string {
    const field = this.printerForm.get(fieldName);
    if (!field?.errors) return '';

    const errors = field.errors;

    if (errors['required']) return 'This field is required';
    if (errors['maxlength']) return 'Value is too long';
    if (errors['min']) return `Minimum value is ${errors['min'].min}`;
    if (errors['max']) return `Maximum value is ${errors['max'].max}`;
    if (errors['positiveNumber']) return 'Must be a positive number';

    return 'Invalid value';
  }

  // Getters for template
  get dialogTitle(): string {
    return this.isCreateMode ? 'Create New Printer' : 'Edit Printer Details';
  }

  get canSave(): boolean {
    return !this.loading && !this.saving && this.printerForm.valid;
  }
}
