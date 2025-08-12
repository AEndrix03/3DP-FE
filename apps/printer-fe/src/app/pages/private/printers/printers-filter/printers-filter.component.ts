import {
  Component,
  EventEmitter,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { ButtonModule } from 'primeng/button';
import { ChipModule } from 'primeng/chip';
import { TooltipModule } from 'primeng/tooltip';

import { PrinterFilterDto } from '../../../../core/models/printer.models';
import { debounceTime, distinctUntilChanged, Subject, takeUntil } from 'rxjs';

interface StatusOption {
  label: string;
  value: string;
}

@Component({
  selector: 'printer-printers-filter',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DropdownModule,
    InputTextModule,
    IconFieldModule,
    InputIconModule,
    ButtonModule,
    ChipModule,
    TooltipModule,
  ],
  templateUrl: './printers-filter.component.html',
})
export class PrintersFilterComponent implements OnInit, OnDestroy {
  @Output() filtersChanged = new EventEmitter<PrinterFilterDto>();

  protected readonly form = new FormGroup<PrinterFilterForm>({
    name: new FormControl<string>(''),
    driverId: new FormControl<string>(''),
    status: new FormControl<string | null>(null),
  });

  // Status options for dropdown
  protected readonly statusOptions: StatusOption[] = [
    { label: 'Online', value: 'ONLINE' },
    { label: 'Offline', value: 'OFFLINE' },
    { label: 'Printing', value: 'PRINTING' },
    { label: 'Paused', value: 'PAUSED' },
    { label: 'Error', value: 'ERROR' },
    { label: 'Maintenance', value: 'MAINTENANCE' },
    { label: 'Idle', value: 'IDLE' },
    { label: 'Connected', value: 'CONNECTED' },
    { label: 'Disconnected', value: 'DISCONNECTED' },
  ];

  private readonly destroy$ = new Subject<void>();

  constructor() {
    // Setup form change detection with debouncing
    this.form.valueChanges
      .pipe(
        debounceTime(300), // Wait 300ms after user stops typing
        distinctUntilChanged(
          (prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)
        ),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.emitFilters();
      });
  }

  ngOnInit(): void {
    // Emit initial empty filters
    this.emitFilters();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private emitFilters(): void {
    const filters: PrinterFilterDto = {
      name: this.nameFc().value || undefined,
      driverId: this.driverIdFc().value || undefined,
      status: this.statusFc().value || undefined,
    };

    // Emit filters (even if empty, to trigger initial load)
    this.filtersChanged.emit(filters);
  }

  protected nameFc(): FormControl<string> {
    return this.form.get('name') as FormControl<string>;
  }

  protected driverIdFc(): FormControl<string> {
    return this.form.get('driverId') as FormControl<string>;
  }

  protected statusFc(): FormControl<string | null> {
    return this.form.get('status') as FormControl<string | null>;
  }

  protected hasActiveFilters(): boolean {
    const values = this.form.value;
    return !!(values.name || values.driverId || values.status);
  }

  protected clearFilters(): void {
    this.form.reset({
      name: '',
      driverId: '',
      status: null,
    });
  }

  protected refreshData(): void {
    // Force re-emit current filters to refresh data
    this.emitFilters();
  }

  /**
   * Get status label from value for chip display
   */
  protected getStatusLabel(statusValue: string): string {
    const option = this.statusOptions.find((opt) => opt.value === statusValue);
    return option?.label || statusValue;
  }
}

interface PrinterFilterForm {
  name: FormControl<string>;
  driverId: FormControl<string>;
  status: FormControl<string | null>;
}
