import { Component, OnInit, signal, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { Button } from 'primeng/button';
import { PageTitleComponent } from '../../../core/components/shared/page-title/page-title.component';
import { MaterialsFilterComponent } from './materials-filter/materials-filter.component';
import { MaterialsGridComponent } from './materials-grid/materials-grid.component';
import { MaterialDetailComponent } from './material-detail/material-detail.component';
import { MaterialDto } from '../../../core/models/material.models';
import { MaterialService } from '../../../services/material.service';
import { catchError, filter, of, switchMap, tap } from 'rxjs';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'printer-materials',
  standalone: true,
  imports: [
    CommonModule,
    Button,
    PageTitleComponent,
    MaterialsFilterComponent,
    MaterialsGridComponent,
  ],
  templateUrl: './materials.component.html',
  providers: [DialogService, MessageService],
})
export class MaterialsComponent implements OnInit {
  private readonly materials: WritableSignal<MaterialDto[]> = signal([]);
  private readonly loading: WritableSignal<boolean> = signal(false);

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

  get items(): MaterialDto[] {
    return this.materials();
  }

  get isLoading(): boolean {
    return this.loading();
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
        })
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
      inputValues: {
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
              this.loadMaterials(); // Reload the list
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
        )
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
      inputValues: {
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
              this.loadMaterials(); // Reload the list
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
        )
      )
      .subscribe();
  }

  protected deleteMaterial(materialId: string): void {
    // Optional: implement delete functionality
    this.materialService
      .deleteMaterial(materialId)
      .pipe(
        tap(() => {
          this.messageService.add({
            severity: 'success',
            summary: 'Success',
            detail: 'Material deleted successfully',
          });
          this.loadMaterials();
        }),
        catchError((error) => {
          console.error('Error deleting material:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to delete material',
          });
          return of(null);
        })
      )
      .subscribe();
  }

  protected refreshMaterials(): void {
    this.loadMaterials();
  }
}
