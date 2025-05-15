import { Component, EventEmitter, Input, Output } from '@angular/core';
import {
  PrinterDto,
  PrinterStatusDto,
} from '../../../../core/models/printer.models';
import { Tag } from 'primeng/tag';
import { Button } from 'primeng/button';
import { NgForOf, NgIf } from '@angular/common';
import { Tooltip } from 'primeng/tooltip';

@Component({
  selector: 'printer-printers-list',
  imports: [Tag, NgIf, Button, NgForOf, Tooltip],
  templateUrl: './printers-list.component.html',
})
export class PrintersListComponent {
  @Input() items: PrinterDto[] = [];
  @Input() statusList: PrinterStatusDto[] = [];

  @Output() viewDetail = new EventEmitter<string>();
  @Output() delete = new EventEmitter<string>();

  public responsiveOptions = [
    {
      breakpoint: '1400px',
      numVisible: 2,
      numScroll: 1,
    },
    {
      breakpoint: '1199px',
      numVisible: 3,
      numScroll: 1,
    },
    {
      breakpoint: '767px',
      numVisible: 2,
      numScroll: 1,
    },
    {
      breakpoint: '575px',
      numVisible: 1,
      numScroll: 1,
    },
  ];

  public getDetailedStatus(statusCode: string): {
    status: PrinterStatusDto;
    severity: string;
  } {
    const status =
      this.statusList.filter((status) => status.code === statusCode)[0] ?? null;
    let severity = null;

    if (status.code === 'RUN') {
      severity = 'success';
    } else if (status.code === 'STP') {
      severity = 'warning';
    } else if (status.code === 'ERR') {
      severity = 'danger';
    } else {
      severity = 'info';
    }

    return {
      status,
      severity,
    };
  }
}
