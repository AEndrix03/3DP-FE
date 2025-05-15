import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PageTitleComponent } from '../../../core/components/shared/page-title/page-title.component';
import { PrinterDto } from '../../../core/models/printer.models';
import { PrintersListComponent } from './printers-list/printers-list.component';
import { Button } from 'primeng/button';
import { createPrinter } from '@schematics/angular/third_party/github.com/Microsoft/TypeScript/lib/typescript';
import { PrintersFilterComponent } from './printers-filter/printers-filter.component';

@Component({
  selector: 'printer-printers',
  imports: [
    CommonModule,
    PageTitleComponent,
    PrintersListComponent,
    Button,
    PrintersFilterComponent,
  ],
  templateUrl: './printers.component.html',
})
export class PrintersComponent {
  items: PrinterDto[] = [
    {
      id: '1',
      name: 'Printer 1',
      driverId: '3283290011',
      lastSeen: new Date(),
      statusCode: 'ERR',
    },
    {
      id: '2',
      name: 'Printer 2',
      driverId: '3283290012',
      lastSeen: new Date(),
      statusCode: 'STP',
    },
    {
      id: '3',
      name: 'Printer 3',
      driverId: '3283290013',
      lastSeen: new Date(),
      statusCode: 'RUN',
    },
    {
      id: '4',
      name: 'Printer 4',
      driverId: '3283290014',
      lastSeen: new Date(),
      statusCode: 'IDL',
    },
    {
      id: '1',
      name: 'Printer 1',
      driverId: '3283290011',
      lastSeen: new Date(),
      statusCode: 'ERR',
    },
    {
      id: '2',
      name: 'Printer 2',
      driverId: '3283290012',
      lastSeen: new Date(),
      statusCode: 'STP',
    },
    {
      id: '3',
      name: 'Printer 3',
      driverId: '3283290013',
      lastSeen: new Date(),
      statusCode: 'RUN',
    },
    {
      id: '4',
      name: 'Printer 4',
      driverId: '3283290014',
      lastSeen: new Date(),
      statusCode: 'IDL',
    },
  ];
  protected readonly createPrinter = createPrinter;

  protected readonly statusList = [
    {
      code: 'RUN',
      description: 'RUNNING',
    },
    {
      code: 'IDL',
      description: 'IDLE',
    },
    {
      code: 'STP',
      description: 'STOPPED',
    },
    {
      code: 'ERR',
      description: 'ERROR',
    },
  ];
}
