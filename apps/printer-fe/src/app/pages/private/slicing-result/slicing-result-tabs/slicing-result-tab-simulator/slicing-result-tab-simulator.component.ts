// slicing-result-tab-simulator.component.ts

import { Component, computed, input, InputSignal, Signal } from '@angular/core';
import { SlicingSimulatorComponent } from '../../../../../core/components/shared/slicing-simulator/slicing-simulator.component';

@Component({
  selector: 'printer-slicing-result-tab-simulator',
  imports: [SlicingSimulatorComponent],
  template: `
    <article class="p-2">
      <printer-gcode-simulator
        [gCodeFile]="gcode()"
        [autoStart]="autoStart()"
        [initialSettings]="initialSettings()"
        (stateChange)="handleStateChange($event)"
        (simulationComplete)="handleSimulationComplete()"
        (simulationError)="handleSimulationError($event)"
      />
    </article>
  `,
})
export class SlicingResultTabSimulatorComponent {
  // Input: Blob contenente i comandi G-code
  public readonly commands: InputSignal<Blob> = input.required();

  // Input opzionali per configurazione
  public readonly fileName: InputSignal<string> = input<string>(
    'slicing-result.gcode'
  );
  public readonly autoStart: InputSignal<boolean> = input<boolean>(true);

  // Conversione diretta Blob → File
  protected readonly gcode: Signal<File> = computed(() => {
    const blob = this.commands();
    const name = this.fileName();

    return new File([blob], name, {
      type: 'text/plain',
      lastModified: Date.now(),
    });
  });

  // Configurazioni iniziali ottimizzate per file di slicing
  readonly initialSettings = computed(() => ({
    animationSpeed: 1.0,
    filamentColor: '#FF4444',
    showTravelMoves: false,
    showBuildPlate: true,
    showBezierControls: false,
    maxPathPoints: 100000, // Ottimizzato per file di slicing grandi
    curveResolution: 15, // Ridotto per performance migliori
  }));

  // Event handlers
  handleStateChange(event: any): void {
    console.log('Simulator state change:', event);
  }

  handleSimulationComplete(): void {
    console.log('Slicing simulation completed');
  }

  handleSimulationError(error: string): void {
    console.error('Slicing simulation error:', error);
  }

  // Metodi di utilità per debug/info
  getBlobInfo() {
    const blob = this.commands();
    return {
      size: blob.size,
      sizeMB: (blob.size / 1024 / 1024).toFixed(2),
      type: blob.type,
      fileName: this.fileName(),
    };
  }
}
