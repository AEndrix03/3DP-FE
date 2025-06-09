import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { ModelDetailTabSlicingCardComponent } from "./model-detail-tab-slicing-card/model-detail-tab-slicing-card.component";

@Component({
  selector: 'printer-model-detail-tab-slicing',
  imports: [CommonModule, CardModule, ButtonModule, TooltipModule, ModelDetailTabSlicingCardComponent],
  templateUrl: './model-detail-tab-slicing.component.html',
})
export class ModelDetailTabSlicingComponent {}
