import { Injectable } from '@angular/core';
import * as THREE from 'three';
import {
  GCodeCommand,
  PathSegment,
  PrinterPosition,
} from '../../types/gcode/gcode.types';
import { SimulationStateService } from './simulation-state.service';

@Injectable({
  providedIn: 'root',
})
export class GCodeExecutorService {
  // Offset e centraggio automatico
  private modelBounds = {
    min: { x: Infinity, y: Infinity, z: Infinity },
    max: { x: -Infinity, y: -Infinity, z: -Infinity },
  };
  private modelOffset = { x: 0, y: 0, z: 0 };
  private autoCenterModel = true;
  private buildVolumeCenter = { x: 100, y: 100, z: 0 }; // Centro del volume di build

  constructor(private stateService: SimulationStateService) {}

  /**
   * Execute command and return path segment if movement occurred
   */
  executeCommand(command: GCodeCommand): PathSegment | null {
    const startPos = { ...this.stateService.printerPosition() };
    const startE = this.stateService.extruderPosition();

    switch (command.command) {
      case 'G0':
      case 'G1':
        return this.executeLinearMove(command, startPos, startE);
      case 'G2':
        return this.executeArcMove(command, startPos, startE, true);
      case 'G3':
        return this.executeArcMove(command, startPos, startE, false);
      case 'G90':
        this.stateService.setAbsolutePositioning(true);
        break;
      case 'G91':
        this.stateService.setAbsolutePositioning(false);
        break;
      case 'M82':
        this.stateService.setAbsoluteExtrusion(true);
        break;
      case 'M83':
        this.stateService.setAbsoluteExtrusion(false);
        break;
      // Temperature commands
      case 'M104': // Set extruder temperature
        if (command.s !== undefined) {
          this.stateService.setTemperature(command.s);
        }
        break;
      case 'M109': // Set extruder temperature and wait
        if (command.s !== undefined) {
          this.stateService.setTemperature(command.s);
        }
        break;
      case 'M140': // Set bed temperature
        if (command.s !== undefined) {
          this.stateService.setBedTemperature(command.s);
        }
        break;
      case 'M190': // Set bed temperature and wait
        if (command.s !== undefined) {
          this.stateService.setBedTemperature(command.s);
        }
        break;
      // Fan commands
      case 'M106': // Fan on
        if (command.s !== undefined) {
          // S parameter: 0-255, convert to percentage
          this.stateService.setFanSpeed(Math.round((command.s / 255) * 100));
        } else {
          this.stateService.setFanSpeed(100); // Full speed if no S parameter
        }
        break;
      case 'M107': // Fan off
        this.stateService.setFanSpeed(0);
        break;
    }
    return null;
  }

  /**
   * Execute linear move command
   */
  private executeLinearMove(
    command: GCodeCommand,
    startPos: PrinterPosition,
    startE: number
  ): PathSegment | null {
    const newPos = this.calculateNewPosition(command, startPos);
    const extrusionDiff = this.calculateExtrusionDiff(command, startE);

    this.stateService.setPrinterPosition(newPos);
    if (command.f !== undefined) {
      this.stateService.setFeedRate(command.f);
    }

    const isExtrusion = extrusionDiff > 0.001;
    this.stateService.setIsExtruding(isExtrusion);

    if (this.hasMovement(startPos, newPos)) {
      // Applica offset di centraggio alle coordinate
      const centeredStartPos = this.applyCenteringOffset(startPos);
      const centeredEndPos = this.applyCenteringOffset(newPos);

      return {
        startPoint: new THREE.Vector3(
          centeredStartPos.x,
          centeredStartPos.z,
          centeredStartPos.y
        ),
        endPoint: new THREE.Vector3(
          centeredEndPos.x,
          centeredEndPos.z,
          centeredEndPos.y
        ),
        extrusionAmount: Math.abs(extrusionDiff),
        isExtrusion,
        isTravel: !isExtrusion,
        isArc: false,
      };
    }
    return null;
  }

  /**
   * Execute arc move command (simplified for performance)
   */
  private executeArcMove(
    command: GCodeCommand,
    startPos: PrinterPosition,
    startE: number,
    clockwise: boolean
  ): PathSegment | null {
    // Simplified arc implementation for performance
    return this.executeLinearMove(command, startPos, startE);
  }

  /**
   * Calculate new position based on command and current positioning mode
   */
  private calculateNewPosition(
    command: GCodeCommand,
    startPos: PrinterPosition
  ): PrinterPosition {
    const absolute = this.stateService.absolutePositioning();
    return {
      x:
        command.x !== undefined
          ? absolute
            ? command.x
            : startPos.x + command.x
          : startPos.x,
      y:
        command.y !== undefined
          ? absolute
            ? command.y
            : startPos.y + command.y
          : startPos.y,
      z:
        command.z !== undefined
          ? absolute
            ? command.z
            : startPos.z + command.z
          : startPos.z,
    };
  }

  /**
   * Calculate extrusion difference
   */
  private calculateExtrusionDiff(
    command: GCodeCommand,
    startE: number
  ): number {
    if (command.e === undefined) return 0;
    const absolute = this.stateService.absoluteExtrusion();
    const newE = absolute ? command.e : startE + command.e;
    this.stateService.setExtruderPosition(newE);
    return newE - startE;
  }

  /**
   * Check if there's actual movement
   */
  private hasMovement(start: PrinterPosition, end: PrinterPosition): boolean {
    const threshold = 0.001;
    return (
      Math.abs(end.x - start.x) > threshold ||
      Math.abs(end.y - start.y) > threshold ||
      Math.abs(end.z - start.z) > threshold
    );
  }

  /**
   * Calcola i bounds del modello dalle coordinate G-code
   */
  calculateModelBounds(commands: GCodeCommand[]): void {
    this.modelBounds = {
      min: { x: Infinity, y: Infinity, z: Infinity },
      max: { x: -Infinity, y: -Infinity, z: -Infinity },
    };

    let currentPos = { x: 0, y: 0, z: 0 };

    commands.forEach((command) => {
      // Aggiorna posizione corrente basata su comandi di movimento
      if (
        command.command === 'G0' ||
        command.command === 'G1' ||
        command.command === 'G2' ||
        command.command === 'G3'
      ) {
        if (command.x !== undefined) currentPos.x = command.x;
        if (command.y !== undefined) currentPos.y = command.y;
        if (command.z !== undefined) currentPos.z = command.z;

        // Aggiorna bounds
        this.modelBounds.min.x = Math.min(this.modelBounds.min.x, currentPos.x);
        this.modelBounds.min.y = Math.min(this.modelBounds.min.y, currentPos.y);
        this.modelBounds.min.z = Math.min(this.modelBounds.min.z, currentPos.z);

        this.modelBounds.max.x = Math.max(this.modelBounds.max.x, currentPos.x);
        this.modelBounds.max.y = Math.max(this.modelBounds.max.y, currentPos.y);
        this.modelBounds.max.z = Math.max(this.modelBounds.max.z, currentPos.z);
      }
    });

    console.log('📐 Model bounds calculated:', {
      min: this.modelBounds.min,
      max: this.modelBounds.max,
      size: {
        x: this.modelBounds.max.x - this.modelBounds.min.x,
        y: this.modelBounds.max.y - this.modelBounds.min.y,
        z: this.modelBounds.max.z - this.modelBounds.min.z,
      },
    });
  }

  /**
   * Calcola l'offset per centrare il modello
   */
  calculateCenteringOffset(): void {
    if (!this.autoCenterModel) {
      this.modelOffset = { x: 0, y: 0, z: 0 };
      return;
    }

    // Calcola centro del modello
    const modelCenter = {
      x: (this.modelBounds.min.x + this.modelBounds.max.x) / 2,
      y: (this.modelBounds.min.y + this.modelBounds.max.y) / 2,
      z: (this.modelBounds.min.z + this.modelBounds.max.z) / 2,
    };

    // Calcola offset per centrare rispetto al volume di build
    this.modelOffset = {
      x: this.buildVolumeCenter.x - modelCenter.x,
      y: this.buildVolumeCenter.y - modelCenter.y,
      z: -this.modelBounds.min.z, // Porta il bottom del modello a Z=0
    };

    console.log('🎯 Centering offset calculated:', {
      modelCenter,
      buildCenter: this.buildVolumeCenter,
      offset: this.modelOffset,
    });
  }

  /**
   * Applica l'offset di centraggio alle coordinate
   */
  private applyCenteringOffset(pos: PrinterPosition): PrinterPosition {
    return {
      x: pos.x + this.modelOffset.x,
      y: pos.y + this.modelOffset.y,
      z: pos.z + this.modelOffset.z,
    };
  }

  /**
   * Imposta il volume di build e ricalcola il centraggio
   */
  setBuildVolume(x: number, y: number, z: number): void {
    this.buildVolumeCenter = { x: x / 2, y: y / 2, z: 0 };
  }

  /**
   * Abilita/disabilita centraggio automatico
   */
  setAutoCenterModel(enabled: boolean): void {
    this.autoCenterModel = enabled;
    console.log(`🎯 Auto-centering ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Ottiene informazioni sui bounds del modello
   */
  getModelBounds() {
    return {
      bounds: this.modelBounds,
      offset: this.modelOffset,
      autoCentering: this.autoCenterModel,
      buildCenter: this.buildVolumeCenter,
    };
  }
}
