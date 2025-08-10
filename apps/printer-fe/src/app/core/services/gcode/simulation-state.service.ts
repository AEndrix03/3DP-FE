import { computed, Injectable, signal } from '@angular/core';
import {
  PrinterPosition,
  PrinterState,
  SimulationState,
} from '../../types/gcode/gcode.types';

@Injectable({
  providedIn: 'root',
})
export class SimulationStateService {
  // Core Signals
  private readonly _currentCommandIndex = signal<number>(0);
  private readonly _simulationState = signal<SimulationState>(
    SimulationState.IDLE
  );
  private readonly _printerPosition = signal<PrinterPosition>({
    x: 0,
    y: 0,
    z: 0,
  });
  private readonly _extruderPosition = signal<number>(0);
  private readonly _feedRate = signal<number>(1500);
  private readonly _temperature = signal<number>(0);
  private readonly _bedTemperature = signal<number>(0);
  private readonly _fanSpeed = signal<number>(0);
  private readonly _absolutePositioning = signal<boolean>(true);
  private readonly _absoluteExtrusion = signal<boolean>(true);
  private readonly _isExtruding = signal<boolean>(false);
  private readonly _executionTime = signal<number>(0);
  private readonly _errorMessage = signal<string>('');
  private readonly _animationSpeed = signal<number>(1.0);
  private readonly _filamentColor = signal<string>('#FF4444');
  private readonly _isJumping = signal<boolean>(false);
  private readonly _jumpTarget = signal<number>(-1);
  private readonly _jumpProgress = signal<number>(0);
  private readonly _totalCommands = signal<number>(0);

  // Read-only accessors
  readonly currentCommandIndex = this._currentCommandIndex.asReadonly();
  readonly simulationState = this._simulationState.asReadonly();
  readonly printerPosition = this._printerPosition.asReadonly();
  readonly extruderPosition = this._extruderPosition.asReadonly();
  readonly feedRate = this._feedRate.asReadonly();
  readonly temperature = this._temperature.asReadonly();
  readonly bedTemperature = this._bedTemperature.asReadonly();
  readonly fanSpeed = this._fanSpeed.asReadonly();
  readonly absolutePositioning = this._absolutePositioning.asReadonly();
  readonly absoluteExtrusion = this._absoluteExtrusion.asReadonly();
  readonly isExtruding = this._isExtruding.asReadonly();
  readonly executionTime = this._executionTime.asReadonly();
  readonly errorMessage = this._errorMessage.asReadonly();
  readonly animationSpeed = this._animationSpeed.asReadonly();
  readonly filamentColor = this._filamentColor.asReadonly();
  readonly isJumping = this._isJumping.asReadonly();
  readonly jumpTarget = this._jumpTarget.asReadonly();
  readonly jumpProgress = this._jumpProgress.asReadonly();
  readonly totalCommands = this._totalCommands.asReadonly();

  // Computed signals - Removed totalLayers as it's handled by GCodeSimulatorService
  readonly currentLayer = computed(() => {
    const pos = this._printerPosition();
    return Math.max(1, Math.floor(pos.z / 0.2) + 1);
  });

  readonly estimatedTimeRemaining = computed(() => {
    // This will be calculated by the main service with proper layer information
    return 0;
  });

  readonly fullState = computed<PrinterState>(() => ({
    position: this._printerPosition(),
    extruderPosition: this._extruderPosition(),
    feedRate: this._feedRate(),
    temperature: this._temperature(),
    bedTemperature: this._bedTemperature(),
    fanSpeed: this._fanSpeed(),
    absolutePositioning: this._absolutePositioning(),
    absoluteExtrusion: this._absoluteExtrusion(),
    currentLayer: this.currentLayer(), // This will be overridden by simulator service
    totalLayers: 1, // This will be overridden by simulator service
    printProgress: 0, // This will be overridden by simulator service
    isExtruding: this._isExtruding(),
    currentCommandIndex: this._currentCommandIndex(),
    totalCommands: this._totalCommands(),
    executionTime: this._executionTime(),
    estimatedTimeRemaining: this.estimatedTimeRemaining(),
  }));

  // State setters
  setCurrentCommandIndex(index: number): void {
    this._currentCommandIndex.set(index);
  }

  setSimulationState(state: SimulationState): void {
    this._simulationState.set(state);
  }

  setPrinterPosition(position: PrinterPosition): void {
    this._printerPosition.set(position);
  }

  setExtruderPosition(position: number): void {
    this._extruderPosition.set(position);
  }

  setFeedRate(rate: number): void {
    this._feedRate.set(rate);
  }

  setTemperature(temp: number): void {
    this._temperature.set(temp);
  }

  setBedTemperature(temp: number): void {
    this._bedTemperature.set(temp);
  }

  setFanSpeed(speed: number): void {
    this._fanSpeed.set(speed);
  }

  setAbsolutePositioning(absolute: boolean): void {
    this._absolutePositioning.set(absolute);
  }

  setAbsoluteExtrusion(absolute: boolean): void {
    this._absoluteExtrusion.set(absolute);
  }

  setIsExtruding(extruding: boolean): void {
    this._isExtruding.set(extruding);
  }

  setExecutionTime(time: number): void {
    this._executionTime.set(time);
  }

  setErrorMessage(message: string): void {
    this._errorMessage.set(message);
  }

  setAnimationSpeed(speed: number): void {
    const newSpeed = Math.max(0.1, Math.min(10000, speed));
    this._animationSpeed.set(newSpeed);
  }

  setFilamentColor(color: string): void {
    this._filamentColor.set(color);
  }

  setIsJumping(jumping: boolean): void {
    this._isJumping.set(jumping);
  }

  setJumpTarget(target: number): void {
    this._jumpTarget.set(target);
  }

  setJumpProgress(progress: number): void {
    this._jumpProgress.set(progress);
  }

  setTotalCommands(total: number): void {
    this._totalCommands.set(total);
  }

  /**
   * Hard reset all state
   */
  hardReset(): void {
    this._currentCommandIndex.set(0);
    this._simulationState.set(SimulationState.IDLE);
    this._printerPosition.set({ x: 0, y: 0, z: 0 });
    this._extruderPosition.set(0);
    this._feedRate.set(1500);
    this._temperature.set(0);
    this._bedTemperature.set(0);
    this._fanSpeed.set(0);
    this._absolutePositioning.set(true);
    this._absoluteExtrusion.set(true);
    this._isExtruding.set(false);
    this._executionTime.set(0);
    this._errorMessage.set('');
    this._isJumping.set(false);
    this._jumpTarget.set(-1);
    this._jumpProgress.set(0);
  }

  /**
   * Method to get command progress
   */
  getCommandProgress(): number {
    const total = this._totalCommands();
    const current = this._currentCommandIndex();
    if (total === 0) return 0;

    const progress = Math.min((current / total) * 100, 100);
    return Math.max(0, progress);
  }
}
