import { CommonModule } from '@angular/common';
import { Component, input, InputSignal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SlicingPropertyDto } from 'apps/printer-fe/src/app/core/models/slicing.models';
import { CardModule } from 'primeng/card';
import { DatePickerModule } from 'primeng/datepicker';
import { IftaLabelModule } from 'primeng/iftalabel';
import { InputTextModule } from 'primeng/inputtext';

@Component({
  selector: 'printer-slicing-result-tab-info',
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    InputTextModule,
    IftaLabelModule,
    DatePickerModule,
  ],
  templateUrl: './slicing-result-tab-info.component.html',
})
export class SlicingResultTabInfoComponent {
  public readonly slicingProperty: InputSignal<SlicingPropertyDto> =
    input.required();
}
