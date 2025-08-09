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

import { MaterialFilterDto } from '../../../../core/models/material.models';
import { MaterialService } from '../../../../services/material.service';
import {
  debounceTime,
  distinctUntilChanged,
  Observable,
  shareReplay,
  Subject,
  takeUntil,
} from 'rxjs';

@Component({
  selector: 'printer-materials-filter',
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
  templateUrl: './materials-filter.component.html',
})
export class MaterialsFilterComponent implements OnInit, OnDestroy {
  @Output() filtersChanged = new EventEmitter<MaterialFilterDto>();

  protected readonly form = new FormGroup<MaterialFilterForm>({
    name: new FormControl<string>(''),
    type: new FormControl<string | null>(null),
    brand: new FormControl<string | null>(null),
  });

  // Async data streams using existing MaterialService
  protected materialTypeOptions$: Observable<string[]>;
  protected materialBrandOptions$: Observable<string[]>;

  private readonly destroy$ = new Subject<void>();

  constructor(private readonly materialService: MaterialService) {
    // Initialize async streams using existing service methods
    this.materialTypeOptions$ = this.materialService
      .getMaterialTypes()
      .pipe(shareReplay(1));
    this.materialBrandOptions$ = this.materialService
      .getMaterialBrands()
      .pipe(shareReplay(1));

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
    const filters: MaterialFilterDto = {
      name: this.nameFc().value || undefined,
      type: this.typeFc().value || undefined,
      brand: this.brandFc().value || undefined,
    };

    // Emit filters (even if empty, to trigger initial load)
    this.filtersChanged.emit(filters);
  }

  protected nameFc(): FormControl<string> {
    return this.form.get('name') as FormControl<string>;
  }

  protected typeFc(): FormControl<string | null> {
    return this.form.get('type') as FormControl<string | null>;
  }

  protected brandFc(): FormControl<string | null> {
    return this.form.get('brand') as FormControl<string | null>;
  }

  protected hasActiveFilters(): boolean {
    const values = this.form.value;
    return !!(values.name || values.type || values.brand);
  }

  protected clearFilters(): void {
    this.form.reset({
      name: '',
      type: null,
      brand: null,
    });
  }

  protected refreshData(): void {
    // Force refresh the dropdowns data
    this.materialTypeOptions$ = this.materialService
      .getMaterialTypes()
      .pipe(shareReplay(1));
    this.materialBrandOptions$ = this.materialService
      .getMaterialBrands()
      .pipe(shareReplay(1));
  }
}

interface MaterialFilterForm {
  name: FormControl<string>;
  type: FormControl<string | null>;
  brand: FormControl<string | null>;
}
