import { Component, EventEmitter, Input, Output } from '@angular/core';
import { PrinterDto } from '../../../../core/models/printer.models';
import { Button } from 'primeng/button';
import { NgForOf } from '@angular/common';
import { Tooltip } from 'primeng/tooltip';

@Component({
  selector: 'printer-printers-list',
  imports: [Button, NgForOf, Tooltip],
  templateUrl: './printers-list.component.html',
})
export class PrintersListComponent {
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
