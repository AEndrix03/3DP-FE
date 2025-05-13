import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PageTitleComponent } from '../../../core/components/shared/page-title/page-title.component';
import {
  PrinterDto,
  PrinterStatusEnum,
} from '../../../core/models/printer.models';
import { PrintersListComponent } from './printers-list/printers-list.component';

@Component({
  selector: 'printer-printers',
  imports: [CommonModule, PageTitleComponent, PrintersListComponent],
  templateUrl: './printers.component.html',
})
export class PrintersComponent {
  items: PrinterDto[] = [
    {
      id: '1',
      name: 'Printer 1',
      driverId: '3283290011',
      lastSeen: new Date(),
      status: PrinterStatusEnum.ERROR,
    },
    {
      id: '2',
      name: 'Printer 2',
      driverId: '3283290012',
      lastSeen: new Date(),
      status: PrinterStatusEnum.STOPPED,
    },
    {
      id: '3',
      name: 'Printer 3',
      driverId: '3283290013',
      lastSeen: new Date(),
      status: PrinterStatusEnum.RUNNING,
    },
    {
      id: '4',
      name: 'Printer 4',
      driverId: '3283290014',
      lastSeen: new Date(),
      status: PrinterStatusEnum.IDLE,
    },
  ];
}
