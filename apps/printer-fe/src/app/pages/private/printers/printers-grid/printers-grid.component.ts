import { Component, EventEmitter, Input, Output } from '@angular/core';
import { PrinterDto } from '../../../../core/models/printer.models';
import { Button } from 'primeng/button';
import { NgForOf } from '@angular/common';

@Component({
  selector: 'printer-printers-grid',
  imports: [Button, NgForOf],
  templateUrl: './printers-grid.component.html',
})
export class PrintersGridComponent {
  @Input() items: PrinterDto[] = [];

  @Output() viewDetail = new EventEmitter<string>();
  @Output() delete = new EventEmitter<string>();

  protected responsiveOptions = [
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
}
