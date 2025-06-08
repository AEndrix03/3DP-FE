import {
  Component,
  EventEmitter,
  input,
  Input,
  InputSignal,
  Output,
} from '@angular/core';
import { NgForOf } from '@angular/common';
import { ModelSimpleDto } from '../../../../core/models/model.models';
import { ModelViewerComponent } from '../../../../core/components/shared/three/model-viewer/model-viewer.component';

@Component({
  selector: 'printer-jobs-models-grid',
  imports: [NgForOf, ModelViewerComponent],
  templateUrl: './jobs-models-grid.component.html',
})
export class JobsModelsGridComponent {
  @Input() models: ModelSimpleDto[] = [];
  public readonly modelsGlb: InputSignal<Record<string, Blob>> = input({});

  @Output()  selectedModel = new EventEmitter<string>();
}
