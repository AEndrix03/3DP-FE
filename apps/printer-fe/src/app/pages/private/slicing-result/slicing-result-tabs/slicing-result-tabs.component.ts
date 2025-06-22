import { Component, input, InputSignal } from '@angular/core';
import { TabsModule } from 'primeng/tabs';
import { SlicingResultTabSimulatorComponent } from './slicing-result-tab-simulator/slicing-result-tab-simulator.component';
import { SlicingPropertyDto } from 'apps/printer-fe/src/app/core/models/slicing.models';
import { SlicingResultTabInfoComponent } from './slicing-result-tab-info/slicing-result-tab-info.component';
import { MaterialDto } from 'apps/printer-fe/src/app/core/models/material.models';
import { SlicingResultTabMaterialsComponent } from "./slicing-result-tab-materials/slicing-result-tab-materials.component";

@Component({
  selector: 'printer-slicing-result-tabs',
  imports: [
    TabsModule,
    SlicingResultTabSimulatorComponent,
    SlicingResultTabInfoComponent,
    SlicingResultTabMaterialsComponent
],
  templateUrl: './slicing-result-tabs.component.html',
})
export class SlicingResultTabsComponent {
  public readonly gcodeCommands: InputSignal<string[]> = input.required();
  public readonly info: InputSignal<SlicingPropertyDto> = input.required();
  public readonly materials: InputSignal<MaterialDto[]> = input.required();
}
