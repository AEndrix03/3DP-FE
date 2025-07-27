import { Component, input, InputSignal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SlicingResultDto } from '../../../../core/models/slicing/slicing.models';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DatePickerModule } from 'primeng/datepicker';
import { IftaLabelModule } from 'primeng/iftalabel';
import { InputTextModule } from 'primeng/inputtext';

@Component({
  selector: 'printer-slicing-result-info',
  imports: [
    CardModule,
    InputTextModule,
    ButtonModule,
    IftaLabelModule,
    DatePickerModule,
    FormsModule,
  ],
  templateUrl: './slicing-result-info.component.html',
})
export class SlicingResultInfoComponent {
  public readonly info: InputSignal<SlicingResultDto> = input.required();
}
