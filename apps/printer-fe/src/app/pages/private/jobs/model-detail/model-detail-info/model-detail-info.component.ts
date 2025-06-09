import { Component, input, InputSignal } from '@angular/core';
import { ModelDto } from 'apps/printer-fe/src/app/core/models/model.models';
import { InputTextModule } from 'primeng/inputtext';
import { IftaLabelModule } from 'primeng/iftalabel';
import { FormsModule } from '@angular/forms';
import { TextareaModule } from 'primeng/textarea';
import { DatePickerModule } from 'primeng/datepicker';
import { NgIf } from '@angular/common';

@Component({
  selector: 'printer-model-detail-info',
  imports: [
    InputTextModule,
    IftaLabelModule,
    FormsModule,
    TextareaModule,
    DatePickerModule,
    NgIf,
  ],
  templateUrl: './model-detail-info.component.html',
})
export class ModelDetailInfoComponent {
  public readonly model: InputSignal<ModelDto> = input.required();
}
