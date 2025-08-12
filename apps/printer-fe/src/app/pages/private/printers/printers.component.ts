import {
  Component,
  inject,
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
import { catchError, finalize, of, take, tap } from 'rxjs';

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
export class PrintersComponent implements OnInit {
  private readonly printerService = inject(PrinterService);
  private readonly dialogService = inject(DialogService);
  private readonly messageService = inject(MessageService);
  private readonly confirmationService = inject(ConfirmationService);

  // Use signals like in materials component
  private readonly allPrinters: WritableSignal<PrinterDto[]> = signal([]);
  private readonly filteredPrinters: WritableSignal<PrinterDto[]> = signal([]);
  private readonly loading: WritableSignal<boolean> = signal(false);
  private readonly activeFilters: WritableSignal<PrinterFilterDto> = signal({});

  protected dialogRef: DynamicDialogRef | undefined;

  ngOnInit(): void {
    this.loadPrinters();
  }

  // Getters for template
  get items(): PrinterDto[] {
    return this.filteredPrinters();
  }

  get isLoading(): boolean {
    return this.loading();
  }

  protected onFiltersChanged(filters: PrinterFilterDto): void {
    this.activeFilters.set(filters);
    this.applyFilters(filters);
  }

  private loadPrinters(): void {
    this.loading.set(true);

    this.printerService
      .getAllPrinters()
      .pipe(
        take(1),
        tap((printers: PrinterDto[]) => {
          this.allPrinters.set(printers);
          // Apply current filters to new data
          this.applyFilters(this.activeFilters());
        }),
        catchError((error) => {
          console.error('Error loading printers:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to load printers. Please try again.',
          });
          return of([]);
        }),
        finalize(() => this.loading.set(false))
      )
      .subscribe();
  }

  private applyFilters(filters: PrinterFilterDto): void {
    let filtered = [...this.allPrinters()];

    // Filter by name
    if (filters.name && filters.name.trim()) {
      const nameFilter = filters.name.toLowerCase().trim();
      filtered = filtered.filter((printer) =>
        printer.name.toLowerCase().includes(nameFilter)
      );
    }

    // Filter by driver ID
    if (filters.driverId && filters.driverId.trim()) {
      const driverFilter = filters.driverId.toLowerCase().trim();
      filtered = filtered.filter((printer) =>
        printer.driverId?.toLowerCase().includes(driverFilter)
      );
    }

    // Filter by status
    if (filters.status) {
      filtered = filtered.filter(
        (printer) =>
          printer.status?.code?.toUpperCase() === filters.status?.toUpperCase()
      );
    }

    this.filteredPrinters.set(filtered);
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

    this.dialogRef.onClose.subscribe((result) => {
      if (result?.saved) {
        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: 'Printer created successfully.',
        });
        this.loadPrinters();
      }
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

    this.dialogRef.onClose.subscribe((result) => {
      if (result?.saved) {
        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: 'Printer updated successfully.',
        });
        this.loadPrinters();
      }
    });
  }

  protected onDeletePrinter(printerId: string): void {
    console.log('onDeletePrinter called with ID:', printerId);

    const printer = this.allPrinters().find((p) => p.id === printerId);
    const printerName = printer?.name || 'this printer';

    console.log('Found printer:', printer);

    this.confirmationService.confirm({
      message: `Are you sure you want to delete "${printerName}"? This action cannot be undone and will remove all associated data.`,
      header: 'Delete Printer Confirmation',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      accept: () => {
        console.log('Delete confirmed, calling deletePrinter');
        this.deletePrinter(printerId, printerName);
      },
      reject: () => {
        console.log('Delete cancelled by user');
      },
    });
  }

  private deletePrinter(printerId: string, printerName: string): void {
    console.log('deletePrinter called for:', printerId, printerName);

    this.printerService
      .deletePrinter(printerId)
      .pipe(take(1))
      .subscribe({
        next: () => {
          console.log('Delete successful');

          this.messageService.add({
            severity: 'success',
            summary: 'Printer Deleted',
            detail: `"${printerName}" has been successfully deleted.`,
            life: 5000,
          });

          // Remove from both arrays and re-apply filters
          const updatedPrinters = this.allPrinters().filter(
            (p) => p.id !== printerId
          );
          this.allPrinters.set(updatedPrinters);
          this.applyFilters(this.activeFilters());
        },
        error: (error) => {
          console.error('Delete error:', error);

          let errorMessage = 'Failed to delete the printer. Please try again.';

          if (error?.status === 409) {
            errorMessage =
              'Cannot delete printer because it has active jobs or is currently in use.';
          } else if (error?.status === 404) {
            errorMessage =
              'Printer not found. It may have already been deleted.';
            // Remove from local arrays since it doesn't exist on server
            const updatedPrinters = this.allPrinters().filter(
              (p) => p.id !== printerId
            );
            this.allPrinters.set(updatedPrinters);
            this.applyFilters(this.activeFilters());
          } else if (error?.status === 403) {
            errorMessage = 'You do not have permission to delete this printer.';
          }

          this.messageService.add({
            severity: 'error',
            summary: 'Delete Failed',
            detail: errorMessage,
            life: 7000,
          });
        },
      });
  }

  /**
   * Refresh the printers list - can be called from template if needed
   */
  protected refreshPrinters(): void {
    this.loadPrinters();
  }

  /**
   * Get count of online printers for display purposes
   */
  protected get onlinePrintersCount(): number {
    return this.allPrinters().filter((p) => {
      const status = p.status?.code?.toUpperCase();
      return ['ONLINE', 'CONNECTED', 'PRINTING', 'PAUSED', 'IDLE'].includes(
        status || ''
      );
    }).length;
  }

  /**
   * Get count of filtered results
   */
  protected get filteredCount(): number {
    return this.filteredPrinters().length;
  }

  /**
   * Get total count
   */
  protected get totalCount(): number {
    return this.allPrinters().length;
  }
}
