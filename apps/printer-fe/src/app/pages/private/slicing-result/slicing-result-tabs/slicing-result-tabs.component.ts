import { Component, input, InputSignal } from '@angular/core';
import { TabsModule } from 'primeng/tabs';
import { SlicingResultTabSimulatorComponent } from "./slicing-result-tab-simulator/slicing-result-tab-simulator.component";

@Component({
  selector: 'printer-slicing-result-tabs',
  imports: [TabsModule, SlicingResultTabSimulatorComponent],
  templateUrl: './slicing-result-tabs.component.html',
})
export class SlicingResultTabsComponent {
  public readonly gcodeCommands: InputSignal<string[]> = input.required();
}
