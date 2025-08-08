// slicing-result-tab-simulator.component.ts

import { Component, input, Input, InputSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SlicingSimulatorComponent } from '../../../../../core/components/shared/slicing-simulator/slicing-simulator.component';

@Component({
  selector: 'printer-slicing-result-tab-simulator',
  standalone: true,
  imports: [CommonModule, SlicingSimulatorComponent],
  template: `
    <article class="h-full" *ngIf="commands() !== null">
      <printer-gcode-simulator
        [gcodeBlobInput]="commands()"
        [autoStart]="autoStart"
        (simulationError)="handleSimulationError($event)"
      ></printer-gcode-simulator>
    </article>
  `,
})
export class SlicingResultTabSimulatorComponent {
  public readonly commands: InputSignal<Blob> = input();
  @Input() public autoStart: boolean = true;

  handleSimulationError(error: string): void {
    console.error('Simulation Error:', error);
  }
}
