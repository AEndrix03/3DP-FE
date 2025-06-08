import { Component, input, InputSignal } from '@angular/core';
import { ModelDetailDto } from 'apps/printer-fe/src/app/core/models/model.models';

@Component({
  selector: 'printer-model-detail-info',
  imports: [],
  templateUrl: './model-detail-info.component.html',
})
export class ModelDetailInfoComponent {
  
  public readonly model: InputSignal<ModelDetailDto> = input.required();


}
