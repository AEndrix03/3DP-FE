import { Component, EventEmitter, Input, Output } from '@angular/core';
import {
  PrinterDto,
  PrinterStatusEnum,
} from '../../../../core/models/printer.models';
import { Carousel } from 'primeng/carousel';
import { Tag } from 'primeng/tag';
import { Button } from 'primeng/button';
import { NgIf, NgStyle } from '@angular/common';

@Component({
  selector: 'printer-printers-list',
  imports: [Carousel, Tag, Button, NgIf, NgStyle],
  templateUrl: './printers-list.component.html',
})
export class PrintersListComponent {
  @Input() items: PrinterDto[] = [];

  @Output() viewDetail = new EventEmitter<string>();

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

  public getDetailedStatus(status: PrinterStatusEnum) {
    switch (status) {
      case PrinterStatusEnum.RUNNING:
        return {
          name: 'RUNNING',
          tag: 'success',
        };
      case PrinterStatusEnum.STOPPED:
        return {
          name: 'STOPPED',
          tag: 'warn',
        };
      case PrinterStatusEnum.ERROR:
        return {
          name: 'ERROR',
          tag: 'danger',
        };
      case PrinterStatusEnum.IDLE:
        return {
          name: 'IDLE',
          tag: 'info',
        };
    }
  }
}
