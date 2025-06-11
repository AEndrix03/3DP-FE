import { Component, input, InputSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TabsModule } from 'primeng/tabs';
import { ModelDetailTabSlicingComponent } from './model-detail-tab-slicing/model-detail-tab-slicing.component';
import { Router } from '@angular/router';
import { ModelDto } from 'apps/printer-fe/src/app/core/models/model.models';

@Component({
  selector: 'printer-model-detail-tabs',
  imports: [CommonModule, TabsModule, ModelDetailTabSlicingComponent],
  templateUrl: './model-detail-tabs.component.html',
})
export class ModelDetailTabsComponent {
  public readonly model: InputSignal<ModelDto> = input.required();

  constructor(private readonly router: Router) {}

  protected openSlicingResultDetail(id: string) {
    this.router.navigate(['slicing-result'], {
      queryParams: { id },
      state: { from: `jobs/model-detail`, id: this.model().id },
    });
  }
}
