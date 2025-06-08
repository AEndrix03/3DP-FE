import { Component, input, InputSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModelViewerComponent } from '../../../../../core/components/shared/three/model-viewer/model-viewer.component';

@Component({
  selector: 'printer-model-detail-preview',
  imports: [CommonModule, ModelViewerComponent],
  templateUrl: './model-detail-preview.component.html',
})
export class ModelDetailPreviewComponent {
  public readonly blob: InputSignal<Blob> = input.required();
}
