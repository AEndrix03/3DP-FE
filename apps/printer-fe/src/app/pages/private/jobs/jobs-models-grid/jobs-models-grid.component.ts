import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NgForOf } from '@angular/common';
import { ModelSimpleDto } from '../../../../core/models/model.models';

@Component({
  selector: 'printer-jobs-models-grid',
  imports: [NgForOf],
  templateUrl: './jobs-models-grid.component.html',
})
export class JobsModelsGridComponent {
  @Input() models: ModelSimpleDto[] = [];

  @Output() selectedModel = new EventEmitter<string>();
}
