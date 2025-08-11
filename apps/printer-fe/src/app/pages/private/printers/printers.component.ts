import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PageTitleComponent } from '../../../core/components/shared/page-title/page-title.component';
import { PrinterDto } from '../../../core/models/printer.models';
import { Button } from 'primeng/button';
import { PrintersFilterComponent } from './printers-filter/printers-filter.component';
import { PrintersGridComponent } from './printers-grid/printers-grid.component';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { PrinterService } from '../../../services/printer.service';
import { PrinterDetailComponent } from './printer-detail/printer-detail.component';
import { finalize, take } from 'rxjs';

@Component({
  selector: 'printer-printers',
  imports: [
    CommonModule,
    PageTitleComponent,
    Button,
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

  protected items: PrinterDto[] = [];
  protected loading = false;
  protected dialogRef: DynamicDialogRef | undefined;

  ngOnInit(): void {
    this.loadPrinters();
  }

  private loadPrinters(): void {
    this.loading = true;

    this.printerService
      .getAllPrinters()
      .pipe(
        take(1),
        finalize(() => (this.loading = false))
      )
      .subscribe({
        next: (printers: PrinterDto[]) => {
          this.items = printers;
        },
        error: (error) => {
          console.error('Error loading printers:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to load printers. Please try again.',
          });
        },
      });
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
    const printer = this.items.find((p) => p.id === printerId);
    const printerName = printer?.name || 'this printer';

    this.confirmationService.confirm({
      message: `Are you sure you want to delete ${printerName}? This action cannot be undone.`,
      header: 'Delete Confirmation',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.deletePrinter(printerId, printerName);
      },
    });
  }

  private deletePrinter(printerId: string, printerName: string): void {
    this.printerService
      .deletePrinter(printerId)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Success',
            detail: `${printerName} deleted successfully.`,
          });
          this.loadPrinters();
        },
        error: (error) => {
          console.error('Error deleting printer:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: `Failed to delete ${printerName}. Please try again.`,
          });
        },
      });
  }
}
