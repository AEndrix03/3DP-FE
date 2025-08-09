import {
  Component,
  OnDestroy,
  OnInit,
  signal,
  WritableSignal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { PageTitleComponent } from '../../../core/components/shared/page-title/page-title.component';
import { MaterialsFilterComponent } from './materials-filter/materials-filter.component';
import { MaterialsGridComponent } from './materials-grid/materials-grid.component';
import { MaterialDetailComponent } from './material-detail/material-detail.component';
import {
  MaterialDto,
  MaterialFilterDto,
} from '../../../core/models/material.models';
import { MaterialService } from '../../../services/material.service';
import {
  catchError,
  filter,
  of,
  Subject,
  switchMap,
  takeUntil,
  tap,
} from 'rxjs';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'printer-materials',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    ProgressSpinnerModule,
    PageTitleComponent,
    MaterialsFilterComponent,
    MaterialsGridComponent,
  ],
  templateUrl: './materials.component.html',
  providers: [DialogService, MessageService],
})
export class MaterialsComponent implements OnInit, OnDestroy {
  private readonly materials: WritableSignal<MaterialDto[]> = signal([]);
  private readonly loading: WritableSignal<boolean> = signal(false);
  private readonly activeFilters: WritableSignal<MaterialFilterDto> = signal(
    {}
  );

  private readonly destroy$ = new Subject<void>();

  createRef: DynamicDialogRef;
  editRef: DynamicDialogRef;

  constructor(
    private readonly dialogService: DialogService,
    private readonly materialService: MaterialService,
    private readonly messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.loadMaterials();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get items(): MaterialDto[] {
    return this.materials();
  }

  get isLoading(): boolean {
    return this.loading();
  }

  protected onFiltersChanged(filters: MaterialFilterDto): void {
    this.activeFilters.set(filters);
    this.searchMaterials(filters);
  }

  private loadMaterials(): void {
    this.loading.set(true);
    this.materialService
      .getAllMaterials()
      .pipe(
        tap((materials) => {
          this.materials.set(materials);
          this.loading.set(false);
        }),
        catchError((error) => {
          console.error('Error loading materials:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to load materials',
          });
          this.loading.set(false);
          return of([]);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe();
  }

  private searchMaterials(filters: MaterialFilterDto): void {
    // If no filters are active, load all materials
    if (!filters.name && !filters.type && !filters.brand) {
      this.loadMaterials();
      return;
    }

    this.loading.set(true);
    this.materialService
      .searchMaterials(filters)
      .pipe(
        tap((materials) => {
          this.materials.set(materials);
          this.loading.set(false);
        }),
        catchError((error) => {
          console.error('Error searching materials:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Search Error',
            detail: 'Failed to search materials',
          });
          this.loading.set(false);
          return of([]);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe();
  }

  protected createMaterial(): void {
    this.createRef = this.dialogService.open(MaterialDetailComponent, {
      header: 'Create New Material',
      modal: true,
      closeOnEscape: true,
      closable: true,
      width: '800px',
      data: {
        material: null,
      },
    });

    this.createRef.onClose
      .pipe(
        filter((result) => result !== null && result !== undefined),
        tap(() => this.loading.set(true)),
        switchMap((material: MaterialDto) =>
          this.materialService.saveMaterial(material).pipe(
            tap(() => {
              this.messageService.add({
                severity: 'success',
                summary: 'Success',
                detail: 'Material created successfully',
              });
              this.refreshData();
            }),
            catchError((error) => {
              console.error('Error creating material:', error);
              this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: 'Failed to create material',
              });
              this.loading.set(false);
              return of(null);
            })
          )
        ),
        takeUntil(this.destroy$)
      )
      .subscribe();
  }

  protected editMaterial(material: MaterialDto): void {
    this.editRef = this.dialogService.open(MaterialDetailComponent, {
      header: `Edit Material - ${material.name}`,
      modal: true,
      closeOnEscape: true,
      closable: true,
      width: '800px',
      data: {
        material: material,
      },
    });

    this.editRef.onClose
      .pipe(
        filter((result) => result !== null && result !== undefined),
        tap(() => this.loading.set(true)),
        switchMap((updatedMaterial: MaterialDto) =>
          this.materialService.saveMaterial(updatedMaterial).pipe(
            tap(() => {
              this.messageService.add({
                severity: 'success',
                summary: 'Success',
                detail: 'Material updated successfully',
              });
              this.refreshData();
            }),
            catchError((error) => {
              console.error('Error updating material:', error);
              this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: 'Failed to update material',
              });
              this.loading.set(false);
              return of(null);
            })
          )
        ),
        takeUntil(this.destroy$)
      )
      .subscribe();
  }

  protected deleteMaterial(materialId: string): void {
    this.materialService
      .deleteMaterial(materialId)
      .pipe(
        tap(() => {
          this.messageService.add({
            severity: 'success',
            summary: 'Success',
            detail: 'Material deleted successfully',
          });
          this.refreshData();
        }),
        catchError((error) => {
          console.error('Error deleting material:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to delete material',
          });
          return of(null);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe();
  }

  private refreshData(): void {
    // If we have active filters, search with them, otherwise load all
    const filters = this.activeFilters();
    if (filters.name || filters.type || filters.brand) {
      this.searchMaterials(filters);
    } else {
      this.loadMaterials();
    }
  }
}
