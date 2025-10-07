import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  input,
  InputSignal,
  Output,
} from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TooltipModule } from 'primeng/tooltip';
import { SlicingResultDto } from '../../../../../../../core/models/slicing/slicing.models';

@Component({
  selector: 'printer-model-detail-tab-slicing-card',
  imports: [CommonModule, CardModule, ButtonModule, TooltipModule],
  templateUrl: './model-detail-tab-slicing-card.component.html',
})
export class ModelDetailTabSlicingCardComponent {
  public readonly result: InputSignal<SlicingResultDto> = input.required();

  @Output() openDetail = new EventEmitter<string>();
  @Output() startPrint = new EventEmitter<string>();
}
