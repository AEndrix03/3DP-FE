import {
  Component,
  computed,
  OnInit,
  signal,
  WritableSignal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DynamicDialogRef } from 'primeng/dynamicdialog';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { PrinterDto } from '../../../../../../core/models/printer.models';
import { PrinterService } from '../../../../../../services/printer.service';
import { tap } from 'rxjs';

@Component({
  selector: 'printer-printer-start',
  standalone: true,
  imports: [CommonModule, CardModule, ButtonModule],
  templateUrl: './printer-start.component.html',
})
export class PrinterStartComponent implements OnInit {
  protected readonly printers: WritableSignal<PrinterDto[]> = signal([]);
  protected readonly selectedPrinterId: WritableSignal<string | null> =
    signal(null);
  protected readonly isLoading: WritableSignal<boolean> = signal(true);

  protected readonly selectedPrinter = computed(() => {
    const id = this.selectedPrinterId();
    return id ? this.printers().find((p) => p.id === id) : null;
  });

  protected readonly hasSelection = computed(
    () => this.selectedPrinterId() !== null
  );

  constructor(
    private readonly ref: DynamicDialogRef,
    private readonly printerService: PrinterService
  ) {}

  ngOnInit(): void {
    this.loadPrinters();
  }

  private loadPrinters(): void {
    this.isLoading.set(true);
    this.printerService
      .getIdlePrinters()
      .pipe(
        tap((printers) => {
          this.printers.set(printers);
          this.isLoading.set(false);
        })
      )
      .subscribe({
        error: () => {
          this.isLoading.set(false);
        },
      });
  }

  protected selectPrinter(printerId: string): void {
    this.selectedPrinterId.set(printerId);
  }

  protected isPrinterSelected(printerId: string): boolean {
    return this.selectedPrinterId() === printerId;
  }

  protected onConfirm(): void {
    if (this.selectedPrinterId()) {
      this.ref.close(this.selectedPrinterId());
    }
  }

  protected onCancel(): void {
    this.ref.close(null);
  }

  protected onImageError(event: any): void {
    event.target.style.display = 'none';
  }

  protected trackByPrinterId(index: number, printer: PrinterDto): string {
    return printer.id;
  }

  protected formatDate(date: Date | string | number): string {
    if (!date) return '';

    let dateObj: Date | null = null;

    if (typeof date === 'number') {
      dateObj = new Date(date * 1000);
    } else if (typeof date === 'string') {
      const numericDate = parseFloat(date);
      if (!isNaN(numericDate)) {
        dateObj = new Date(numericDate * 1000);
      } else {
        dateObj = new Date(date);
      }
    } else if (date instanceof Date) {
      dateObj = date;
    }

    if (!dateObj || isNaN(dateObj.getTime())) {
      return 'Invalid date';
    }

    const now = new Date();
    const diffMs = now.getTime() - dateObj.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) {
      return 'Just now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `${weeks}w ago`;
    } else {
      return dateObj.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year:
          dateObj.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      });
    }
  }
}
