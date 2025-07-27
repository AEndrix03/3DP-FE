import {
  Component,
  EventEmitter,
  input,
  InputSignal,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { SlicingPropertyDto } from '../../../../../../../core/models/slicing/slicing-property.models';

@Component({
  selector: 'printer-slicing-profile',
  imports: [CommonModule, CardModule, ButtonModule, TooltipModule],
  templateUrl: './slicing-profile.component.html',
})
export class SlicingProfileComponent {
  public readonly profile: InputSignal<SlicingPropertyDto> = input.required();

  @Output() show = new EventEmitter();
}
