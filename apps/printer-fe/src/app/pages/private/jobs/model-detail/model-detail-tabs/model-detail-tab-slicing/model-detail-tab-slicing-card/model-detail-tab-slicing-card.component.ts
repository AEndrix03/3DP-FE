import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TooltipModule } from 'primeng/tooltip';

@Component({
  selector: 'printer-model-detail-tab-slicing-card',
  imports: [CommonModule, CardModule, ButtonModule, TooltipModule],
  templateUrl: './model-detail-tab-slicing-card.component.html',
})
export class ModelDetailTabSlicingCardComponent {
  @Output() openDetail = new EventEmitter<string>();
}
