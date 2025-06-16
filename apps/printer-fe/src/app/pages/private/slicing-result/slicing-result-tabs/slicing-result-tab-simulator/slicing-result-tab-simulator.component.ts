import { Component, input, InputSignal } from '@angular/core';
import { SlicingSimulatorComponent } from '../../../../../core/components/shared/slicing-simulator/slicing-simulator.component';

@Component({
  selector: 'printer-slicing-result-tab-simulator',
  imports: [SlicingSimulatorComponent],
  templateUrl: './slicing-result-tab-simulator.component.html',
})
export class SlicingResultTabSimulatorComponent {
  public readonly commands: InputSignal<string[]> = input.required();
}
