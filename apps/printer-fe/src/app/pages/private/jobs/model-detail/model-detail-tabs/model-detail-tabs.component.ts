import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TabsModule } from 'primeng/tabs';
import { ModelDetailTabSlicingComponent } from "./model-detail-tab-slicing/model-detail-tab-slicing.component";

@Component({
  selector: 'printer-model-detail-tabs',
  imports: [CommonModule, TabsModule, ModelDetailTabSlicingComponent],
  templateUrl: './model-detail-tabs.component.html',
})
export class ModelDetailTabsComponent {}
