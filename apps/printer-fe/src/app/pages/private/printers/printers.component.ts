import {
  Component,
  inject,
  OnDestroy,
  OnInit,
  signal,
  WritableSignal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { PageTitleComponent } from '../../../core/components/shared/page-title/page-title.component';
import {
  PrinterDto,
  PrinterFilterDto,
} from '../../../core/models/printer.models';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { PrintersFilterComponent } from './printers-filter/printers-filter.component';
import { PrintersGridComponent } from './printers-grid/printers-grid.component';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { PrinterService } from '../../../services/printer.service';
import { PrinterDetailComponent } from './printer-detail/printer-detail.component';
import {
  catchError,
  filter,
  of,
  Subject,
  switchMap,
  takeUntil,
  tap,
} from 'rxjs';

@Component({
  selector: 'printer-printers',
  standalone: true,
  imports: [
    CommonModule,
    PageTitleComponent,
    ButtonModule,
    ConfirmDialogModule,
    ToastModule,
    PrintersFilterComponent,
    PrintersGridComponent,
  ],
  providers: [DialogService, MessageService, ConfirmationService],
  templateUrl: './printers.component.html',
})
export class PrintersComponent implements OnInit, OnDestroy {
  private readonly printerService = inject(PrinterService);
  private readonly dialogService = inject(DialogService);
  private readonly messageService = inject(MessageService);
  private readonly confirmationService = inject(ConfirmationService);

  // Following materials component pattern - single signal for printers
  private readonly printers: WritableSignal<PrinterDto[]> = signal([]);
  private readonly loading: WritableSignal<boolean> = signal(false);
  private readonly activeFilters: WritableSignal<PrinterFilterDto> = signal({});

  private readonly destroy$ = new Subject<void>();
  protected dialogRef: DynamicDialogRef | undefined;

  ngOnInit(): void {
    this.loadPrinters();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Getters for template - following materials pattern
  get items(): PrinterDto[] {
    return this.printers();
  }

  get isLoading(): boolean {
    return this.loading();
  }

  protected onFiltersChanged(filters: PrinterFilterDto): void {
    this.activeFilters.set(filters);
    this.searchPrinters(filters);
  }

  private loadPrinters(): void {
    this.loading.set(true);
    this.printerService
      .getAllPrinters()
      .pipe(
        tap((printers) => {
          this.printers.set(printers);
          this.loading.set(false);
        }),
        catchError((error) => {
          console.error('Error loading printers:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to load printers',
          });
          this.loading.set(false);
          return of([]);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe();
  }

  private searchPrinters(filters: PrinterFilterDto): void {
    // If no filters are active, load all printers - following materials pattern
    if (!filters.name && !filters.driverId && !filters.status) {
      this.loadPrinters();
      return;
    }

    this.loading.set(true);
    this.printerService
      .searchPrinters(filters)
      .pipe(
        tap((printers) => {
          this.printers.set(printers);
          this.loading.set(false);
        }),
        catchError((error) => {
          console.error('Error searching printers:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Search Error',
            detail: 'Failed to search printers',
          });
          this.loading.set(false);
          return of([]);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe();
  }

  protected createPrinter(): void {
    this.dialogRef = this.dialogService.open(PrinterDetailComponent, {
      header: 'Create New Printer',
      width: '50vw',
      modal: true,
      closable: true,
      data: {
        isCreateMode: true,
      },
    });

    this.dialogRef.onClose
      .pipe(
        filter((result) => result !== null && result !== undefined),
        tap(() => this.loading.set(true)),
        switchMap(() => {
          this.messageService.add({
            severity: 'success',
            summary: 'Success',
            detail: 'Printer created successfully',
          });
          return of(null);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.refreshData();
      });
  }

  protected onViewDetail(printerId: string): void {
    this.dialogRef = this.dialogService.open(PrinterDetailComponent, {
      header: 'Edit Printer Details',
      width: '50vw',
      modal: true,
      closable: true,
      data: {
        printerId: printerId,
        isCreateMode: false,
      },
    });

    this.dialogRef.onClose
      .pipe(
        filter((result) => result !== null && result !== undefined),
        tap(() => this.loading.set(true)),
        switchMap(() => {
          this.messageService.add({
            severity: 'success',
            summary: 'Success',
            detail: 'Printer updated successfully',
          });
          return of(null);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.refreshData();
      });
  }

  protected onDeletePrinter(printerId: string): void {
    const printer = this.printers().find((p) => p.id === printerId);
    const printerName = printer?.name || 'this printer';

    this.confirmationService.confirm({
      message: `Are you sure you want to delete "${printerName}"? This action cannot be undone and will remove all associated data.`,
      header: 'Delete Printer Confirmation',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      accept: () => {
        this.deletePrinter(printerId, printerName);
      },
      reject: () => {
        console.log('Delete cancelled by user');
      },
    });
  }

  private deletePrinter(printerId: string, printerName: string): void {
    this.printerService
      .deletePrinter(printerId)
      .pipe(
        tap(() => {
          this.messageService.add({
            severity: 'success',
            summary: 'Success',
            detail: 'Printer deleted successfully',
          });
          this.refreshData();
        }),
        catchError((error) => {
          console.error('Error deleting printer:', error);

          let errorMessage = 'Failed to delete printer';

          if (error?.status === 409) {
            errorMessage =
              'Cannot delete printer because it has active jobs or is currently in use.';
          } else if (error?.status === 404) {
            errorMessage =
              'Printer not found. It may have already been deleted.';
            // Still refresh to remove from UI
            this.refreshData();
          } else if (error?.status === 403) {
            errorMessage = 'You do not have permission to delete this printer.';
          }

          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: errorMessage,
          });
          return of(null);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe();
  }

  private refreshData(): void {
    // If we have active filters, search with them, otherwise load all
    // Following materials pattern exactly
    const filters = this.activeFilters();
    if (filters.name || filters.driverId || filters.status) {
      this.searchPrinters(filters);
    } else {
      this.loadPrinters();
    }
  }

  /**
   * Get count of online printers for display purposes
   */
  protected get onlinePrintersCount(): number {
    return this.printers().filter((p) => {
      const status = p.status?.code?.toUpperCase();
      return ['ONLINE', 'CONNECTED', 'PRINTING', 'PAUSED', 'IDLE'].includes(
        status || ''
      );
    }).length;
  }

  /**
   * Get total count
   */
  protected get totalCount(): number {
    return this.printers().length;
  }
}
