// src/app/printer-simulator/services/slicing-simulator.service.ts

import {
  computed,
  DestroyRef,
  inject,
  Injectable,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  BehaviorSubject,
  catchError,
  combineLatest,
  distinctUntilChanged,
  EMPTY,
  filter,
  fromEvent,
  map,
  Observable,
  shareReplay,
  Subject,
  switchMap,
  tap,
  throwError,
  timer,
} from 'rxjs';
import * as THREE from 'three';
import {
  CommandExecutionInfo,
  createSimulatorError,
  createVector3D,
  DEFAULT_VIEWPORT_SETTINGS,
  GCodeCommand,
  getCommandType,
  isExtrusionCommand,
  isMovementCommand,
  PathSegment,
  PERFORMANCE_THRESHOLDS,
  PerformanceMetrics,
  PrinterState,
  SimulationState,
  SimulatorError,
  Vector3D,
  ViewportSettings,
} from '../../../models/simulator/simulator.models';

import { StreamingCommandService } from '../../../services/streaming-service';

interface SimulatorConfig {
  readonly enablePerformanceMonitoring: boolean;
  readonly enableAutomaticQualityAdjustment: boolean;
  readonly maxMemoryUsage: number; // MB
  readonly targetFPS: number;
  readonly pathOptimization: boolean;
  readonly realTimeUpdates: boolean;
}

interface PathRenderingContext {
  readonly geometry: THREE.BufferGeometry;
  readonly material: THREE.Material;
  readonly mesh: THREE.Mesh;
  readonly vertexCount: number;
  readonly lastUpdate: number;
}

interface QualitySettings {
  readonly maxPathPoints: number;
  readonly enableShadows: boolean;
  readonly antialiasing: boolean;
  readonly pathResolution: number;
  readonly updateFrequency: number;
}

@Injectable({
  providedIn: 'root',
})
export class GCodeSimulatorService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly streamingService = inject(StreamingCommandService);

  // Configuration
  private readonly config = signal<SimulatorConfig>({
    enablePerformanceMonitoring: true,
    enableAutomaticQualityAdjustment: true,
    maxMemoryUsage: 512, // MB
    targetFPS: 30,
    pathOptimization: true,
    realTimeUpdates: true,
  });

  // Core state management
  private readonly _simulationState = signal<SimulationState>(
    SimulationState.IDLE
  );
  private readonly _printerState = signal<PrinterState>({
    position: createVector3D(0, 0, 0),
    extruderPosition: 0,
    feedRate: 1500,
    temperature: 0,
    bedTemperature: 0,
    fanSpeed: 0,
    absolutePositioning: true,
    absoluteExtrusion: true,
    currentLayer: 0,
    totalLayers: 0,
    printProgress: 0,
    isExtruding: false,
    currentCommandIndex: 0,
    totalCommands: 0,
    executionTime: 0,
    estimatedTimeRemaining: 0,
  });

  private readonly _viewportSettings = signal<ViewportSettings>(
    DEFAULT_VIEWPORT_SETTINGS
  );
  private readonly _performanceMetrics = signal<PerformanceMetrics>({
    fps: 60,
    pathObjects: 0,
    memoryUsage: 0,
    renderTime: 0,
    commandProcessingRate: 0,
    bufferUtilization: 0,
  });

  // Three.js scene management
  private scene: THREE.Scene = new THREE.Scene();
  private pathRenderingContexts: Map<string, PathRenderingContext> = new Map();
  private buildPlate: THREE.Mesh | null = null;
  private nozzleIndicator: THREE.Mesh | null = null;

  // Command execution
  private commandHistory: CommandExecutionInfo[] = [];
  private pathSegments: PathSegment[] = [];
  private executionTimer: number | null = null;
  private isExecuting = false;

  // Error handling
  private readonly errorSubject = new Subject<SimulatorError>();
  private readonly warningSubject = new Subject<string>();

  // Performance tracking
  private performanceHistory: number[] = [];
  private lastPerformanceCheck = Date.now();
  private frameCounter = 0;
  private renderTimeHistory: number[] = [];

  // Event streams
  private readonly stateChangeSubject = new BehaviorSubject<SimulationState>(
    SimulationState.IDLE
  );
  private readonly commandExecutedSubject = new Subject<CommandExecutionInfo>();
  private readonly layerChangeSubject = new Subject<{
    from: number;
    to: number;
  }>();
  private readonly progressUpdateSubject = new Subject<number>();

  // Public readonly state
  readonly simulationState = this._simulationState.asReadonly();
  readonly printerState = this._printerState.asReadonly();
  readonly viewportSettings = this._viewportSettings.asReadonly();
  readonly performanceMetrics = this._performanceMetrics.asReadonly();

  // Computed properties
  readonly isSimulationActive = computed(
    () => this.simulationState() === SimulationState.RUNNING
  );

  readonly canExecute = computed(() => {
    const state = this.simulationState();
    return (
      state === SimulationState.IDLE ||
      state === SimulationState.PAUSED ||
      state === SimulationState.COMPLETED
    );
  });

  readonly executionProgress = computed(() => {
    const current = this.printerState().currentCommandIndex;
    const total = this.printerState().totalCommands;
    return total > 0 ? (current / total) * 100 : 0;
  });

  readonly memoryPressure = computed(() => {
    const usage = this.performanceMetrics().memoryUsage;
    const maxUsage = this.config().maxMemoryUsage * 1024 * 1024; // Convert MB to bytes
    return usage / maxUsage;
  });

  readonly isPerformanceHealthy = computed(() => {
    const metrics = this.performanceMetrics();
    return (
      metrics.fps >= this.config().targetFPS &&
      metrics.renderTime < PERFORMANCE_THRESHOLDS.RENDER_TIME.ACCEPTABLE &&
      this.memoryPressure() < 0.8
    );
  });

  // Public observables
  readonly stateChanges$ = this.stateChangeSubject
    .asObservable()
    .pipe(distinctUntilChanged(), shareReplay(1));

  readonly commandExecuted$ = this.commandExecutedSubject.asObservable();
  readonly layerChanges$ = this.layerChangeSubject.asObservable();
  readonly progressUpdates$ = this.progressUpdateSubject.asObservable();
  readonly errors$ = this.errorSubject.asObservable();
  readonly warnings$ = this.warningSubject.asObservable();

  // Combined state stream
  readonly simulatorState$ = combineLatest([
    this.stateChanges$,
    this.progressUpdates$.pipe(startWith(0)),
    timer(0, 1000).pipe(map(() => this.performanceMetrics())),
  ]).pipe(
    map(([state, progress, metrics]) => ({
      simulationState: state,
      progress,
      performanceMetrics: metrics,
      printerState: this.printerState(),
    })),
    shareReplay(1)
  );

  constructor() {
    this.initializeScene();
    this.setupPerformanceMonitoring();
    this.setupStreamingIntegration();
    this.setupErrorHandling();
    this.setupMemoryManagement();
  }

  // Public API Methods

  /**
   * Load G-code from text with comprehensive validation and preprocessing
   */
  async loadGCodeFromText(gCodeText: string): Promise<void> {
    try {
      this.updateSimulationState(SimulationState.LOADING);

      // Validate input
      if (!gCodeText?.trim()) {
        throw new Error('Empty G-code provided');
      }

      // Clear previous state
      this.resetSimulation();

      // Use streaming service for efficient loading
      await this.streamingService.streamCommands(gCodeText);

      // Process loaded commands
      await this.processLoadedCommands();

      this.updateSimulationState(SimulationState.IDLE);
    } catch (error) {
      this.handleError('parsing', `Failed to load G-code: ${error}`, error);
      this.updateSimulationState(SimulationState.ERROR);
    }
  }

  /**
   * Load G-code from file with progress tracking
   */
  async loadGCodeFromFile(file: File): Promise<void> {
    try {
      this.updateSimulationState(SimulationState.LOADING);

      // Validate file
      if (!file || file.size === 0) {
        throw new Error('Invalid file provided');
      }

      if (file.size > 100 * 1024 * 1024) {
        // 100MB limit
        throw new Error('File too large. Maximum size is 100MB');
      }

      this.resetSimulation();

      // Use streaming service for file processing
      await this.streamingService.streamFromFile(file);

      await this.processLoadedCommands();

      this.updateSimulationState(SimulationState.IDLE);
    } catch (error) {
      this.handleError('parsing', `Failed to load file: ${error}`, error);
      this.updateSimulationState(SimulationState.ERROR);
    }
  }

  /**
   * Start simulation execution with advanced control
   */
  startSimulation(): Observable<CommandExecutionInfo> {
    if (!this.canExecute()) {
      return throwError(
        () => new Error('Cannot start simulation in current state')
      );
    }

    this.updateSimulationState(SimulationState.RUNNING);
    this.isExecuting = true;

    return this.streamingService.startProcessing().pipe(
      switchMap((command) => this.executeCommand(command)),
      tap((executionInfo) => {
        this.commandExecutedSubject.next(executionInfo);
        this.updateProgress(executionInfo);
      }),
      catchError((error) => {
        this.handleExecutionError(error);
        return EMPTY;
      }),
      takeUntilDestroyed(this.destroyRef)
    );
  }

  /**
   * Pause simulation with state preservation
   */
  pauseSimulation(): void {
    if (this.simulationState() !== SimulationState.RUNNING) return;

    this.streamingService.pauseProcessing();
    this.updateSimulationState(SimulationState.PAUSED);
    this.isExecuting = false;

    if (this.executionTimer) {
      clearTimeout(this.executionTimer);
      this.executionTimer = null;
    }
  }

  /**
   * Resume simulation from current position
   */
  resumeSimulation(): Observable<CommandExecutionInfo> {
    if (this.simulationState() !== SimulationState.PAUSED) {
      return throwError(() => new Error('Simulation is not paused'));
    }

    const currentIndex = this.printerState().currentCommandIndex;
    return this.streamingService.resumeProcessing(currentIndex).pipe(
      switchMap((command) => this.executeCommand(command)),
      tap((executionInfo) => {
        this.commandExecutedSubject.next(executionInfo);
        this.updateProgress(executionInfo);
      }),
      catchError((error) => {
        this.handleExecutionError(error);
        return EMPTY;
      })
    );
  }

  /**
   * Stop simulation with cleanup
   */
  stopSimulation(): void {
    this.streamingService.pauseProcessing();
    this.updateSimulationState(SimulationState.IDLE);
    this.isExecuting = false;

    if (this.executionTimer) {
      clearTimeout(this.executionTimer);
      this.executionTimer = null;
    }

    this.clearVisualization();
  }

  /**
   * Reset simulation to beginning
   */
  resetSimulation(): void {
    this.stopSimulation();

    // Reset printer state
    this._printerState.set({
      position: createVector3D(0, 0, 0),
      extruderPosition: 0,
      feedRate: 1500,
      temperature: 0,
      bedTemperature: 0,
      fanSpeed: 0,
      absolutePositioning: true,
      absoluteExtrusion: true,
      currentLayer: 0,
      totalLayers: 0,
      printProgress: 0,
      isExtruding: false,
      currentCommandIndex: 0,
      totalCommands: 0,
      executionTime: 0,
      estimatedTimeRemaining: 0,
    });

    // Clear history and visualization
    this.commandHistory = [];
    this.pathSegments = [];
    this.clearVisualization();

    // Reset streaming service
    this.streamingService.reset();
  }

  /**
   * Jump to specific command index
   */
  jumpToCommand(index: number): void {
    const totalCommands = this.printerState().totalCommands;

    if (index < 0 || index >= totalCommands) {
      throw new Error(`Invalid command index: ${index}`);
    }

    if (this.isSimulationActive()) {
      throw new Error('Cannot jump while simulation is running');
    }

    // Fast-forward to the target command
    this.fastForwardToCommand(index);
  }

  /**
   * Step forward by specified number of commands
   */
  stepForward(steps: number = 1): void {
    const currentIndex = this.printerState().currentCommandIndex;
    const targetIndex = Math.min(
      currentIndex + steps,
      this.printerState().totalCommands - 1
    );

    if (targetIndex > currentIndex) {
      this.jumpToCommand(targetIndex);
    }
  }

  /**
   * Step backward by specified number of commands
   */
  stepBack(steps: number = 1): void {
    const currentIndex = this.printerState().currentCommandIndex;
    const targetIndex = Math.max(currentIndex - steps, 0);

    if (targetIndex < currentIndex) {
      this.jumpToCommand(targetIndex);
    }
  }

  /**
   * Update viewport settings with validation
   */
  updateViewportSettings(settings: Partial<ViewportSettings>): void {
    try {
      const newSettings = { ...this.viewportSettings(), ...settings };

      // Validate settings
      this.validateViewportSettings(newSettings);

      this._viewportSettings.set(newSettings);

      // Apply settings to visualization
      this.applyViewportSettings(newSettings);
    } catch (error) {
      this.handleError('system', `Failed to update settings: ${error}`, error);
    }
  }

  /**
   * Update quality settings for performance optimization
   */
  updateQualitySettings(settings: Partial<QualitySettings>): void {
    const currentSettings = this.viewportSettings();

    const updatedSettings: Partial<ViewportSettings> = {};

    if (settings.maxPathPoints !== undefined) {
      updatedSettings.maxPathPoints = settings.maxPathPoints;
    }

    if (settings.enableShadows !== undefined) {
      updatedSettings.enableShadows = settings.enableShadows;
    }

    if (settings.antialiasing !== undefined) {
      updatedSettings.antialiasing = settings.antialiasing;
    }

    this.updateViewportSettings(updatedSettings);
  }

  /**
   * Get command execution history
   */
  getCommandHistory(): ReadonlyArray<CommandExecutionInfo> {
    return [...this.commandHistory];
  }

  /**
   * Get current path segments
   */
  getPathSegments(): ReadonlyArray<PathSegment> {
    return [...this.pathSegments];
  }

  /**
   * Get Three.js scene for rendering
   */
  getScene(): THREE.Scene {
    return this.scene;
  }

  /**
   * Get current path object count for performance metrics
   */
  getPathObjectCount(): number {
    return this.pathRenderingContexts.size;
  }

  /**
   * Export current simulation state
   */
  exportSimulationState(): {
    printerState: PrinterState;
    commandHistory: CommandExecutionInfo[];
    pathSegments: PathSegment[];
    settings: ViewportSettings;
  } {
    return {
      printerState: this.printerState(),
      commandHistory: [...this.commandHistory],
      pathSegments: [...this.pathSegments],
      settings: this.viewportSettings(),
    };
  }

  /**
   * Import simulation state (for testing/debugging)
   */
  importSimulationState(state: {
    printerState: PrinterState;
    commandHistory: CommandExecutionInfo[];
    pathSegments: PathSegment[];
    settings: ViewportSettings;
  }): void {
    this._printerState.set(state.printerState);
    this.commandHistory = [...state.commandHistory];
    this.pathSegments = [...state.pathSegments];
    this._viewportSettings.set(state.settings);

    this.rebuildVisualization();
  }

  // Private Methods

  private async processLoadedCommands(): Promise<void> {
    const commands = this.streamingService.commandBuffer();
    const totalCommands = commands.length;

    if (totalCommands === 0) {
      throw new Error('No valid commands found in G-code');
    }

    // Update printer state with command info
    this._printerState.update((state) => ({
      ...state,
      totalCommands,
      totalLayers: this.estimateTotalLayers(commands),
      estimatedTimeRemaining: this.estimateExecutionTime(commands),
    }));

    // Pre-process commands for optimization
    await this.preprocessCommands(commands);
  }

  private estimateTotalLayers(commands: ReadonlyArray<GCodeCommand>): number {
    const layerHeights = new Set<number>();

    for (const command of commands) {
      if (command.command === 'G1' && command.parameters.has('Z')) {
        const z = command.parameters.get('Z')!;
        if (z > 0) {
          layerHeights.add(Math.floor(z / this.viewportSettings().layerHeight));
        }
      }
    }

    return Math.max(1, layerHeights.size);
  }

  private estimateExecutionTime(commands: ReadonlyArray<GCodeCommand>): number {
    // Simplified estimation: 0.1 seconds per command
    // In reality, this would consider feed rates, distances, etc.
    return commands.length * 0.1;
  }

  private async preprocessCommands(
    commands: ReadonlyArray<GCodeCommand>
  ): Promise<void> {
    // Pre-calculate path segments for visualization
    if (this.config().pathOptimization) {
      await this.precalculatePathSegments(commands);
    }
  }

  private async precalculatePathSegments(
    commands: ReadonlyArray<GCodeCommand>
  ): Promise<void> {
    const segments: PathSegment[] = [];
    let currentPosition = createVector3D(0, 0, 0);
    let extruderPosition = 0;

    for (
      let i = 0;
      i < commands.length &&
      segments.length < this.viewportSettings().maxPathPoints;
      i++
    ) {
      const command = commands[i];

      if (isMovementCommand(command)) {
        const newPosition = this.calculateNewPosition(currentPosition, command);
        const newExtruderPos = command.parameters.has('E')
          ? command.parameters.get('E')!
          : extruderPosition;

        const segment = this.createPathSegment(
          currentPosition,
          newPosition,
          extruderPosition,
          newExtruderPos,
          command
        );

        segments.push(segment);

        currentPosition = newPosition;
        extruderPosition = newExtruderPos;
      }
    }

    this.pathSegments = segments;
  }

  private calculateNewPosition(
    currentPos: Vector3D,
    command: GCodeCommand
  ): Vector3D {
    const absoluteMode = this.printerState().absolutePositioning;

    const x = command.parameters.has('X')
      ? command.parameters.get('X')!
      : currentPos.x;
    const y = command.parameters.has('Y')
      ? command.parameters.get('Y')!
      : currentPos.y;
    const z = command.parameters.has('Z')
      ? command.parameters.get('Z')!
      : currentPos.z;

    if (absoluteMode) {
      return createVector3D(x, y, z);
    } else {
      return createVector3D(
        currentPos.x + (command.parameters.has('X') ? x : 0),
        currentPos.y + (command.parameters.has('Y') ? y : 0),
        currentPos.z + (command.parameters.has('Z') ? z : 0)
      );
    }
  }

  private createPathSegment(
    startPos: Vector3D,
    endPos: Vector3D,
    startE: number,
    endE: number,
    command: GCodeCommand
  ): PathSegment {
    const isExtrusion = isExtrusionCommand(command) && endE > startE;
    const isTravel = !isExtrusion;
    const extrusionAmount = endE - startE;

    return {
      startPoint: new THREE.Vector3(startPos.x, startPos.z, startPos.y),
      endPoint: new THREE.Vector3(endPos.x, endPos.z, endPos.y),
      extrusionAmount,
      isExtrusion,
      isTravel,
      isArc: command.command === 'G2' || command.command === 'G3',
      isBezier: command.command === 'G5',
      isNurbs: command.command === 'G6',
    };
  }

  private async executeCommand(
    command: GCodeCommand
  ): Promise<CommandExecutionInfo> {
    const startTime = performance.now();
    const startTimestamp = new Date();

    try {
      // Update printer state based on command
      this.updatePrinterStateFromCommand(command);

      // Create visualization for movement commands
      if (isMovementCommand(command)) {
        await this.visualizeCommand(command);
      }

      const executionTime = performance.now() - startTime;
      const commandInfo: CommandExecutionInfo = {
        index: this.commandHistory.length,
        command,
        executionTime,
        cumulativeTime: this.printerState().executionTime + executionTime,
        timestamp: startTimestamp,
        success: true,
      };

      this.commandHistory.push(commandInfo);

      // Update execution time
      this._printerState.update((state) => ({
        ...state,
        executionTime: state.executionTime + executionTime,
        currentCommandIndex: state.currentCommandIndex + 1,
      }));

      return commandInfo;
    } catch (error) {
      const executionTime = performance.now() - startTime;
      const commandInfo: CommandExecutionInfo = {
        index: this.commandHistory.length,
        command,
        executionTime,
        cumulativeTime: this.printerState().executionTime + executionTime,
        timestamp: startTimestamp,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };

      this.commandHistory.push(commandInfo);
      throw error;
    }
  }

  private updatePrinterStateFromCommand(command: GCodeCommand): void {
    const commandType = getCommandType(command);

    switch (commandType) {
      case 'movement':
        this.updatePositionFromMovementCommand(command);
        break;
      case 'temperature':
        this.updateTemperatureFromCommand(command);
        break;
      case 'fan':
        this.updateFanFromCommand(command);
        break;
      case 'positioning':
        this.updatePositioningModeFromCommand(command);
        break;
    }
  }

  private updatePositionFromMovementCommand(command: GCodeCommand): void {
    this._printerState.update((state) => {
      const newPosition = this.calculateNewPosition(state.position, command);

      const updates: Partial<PrinterState> = {
        position: newPosition,
      };

      // Update extruder position
      if (command.parameters.has('E')) {
        const newE = command.parameters.get('E')!;
        updates.extruderPosition = state.absoluteExtrusion
          ? newE
          : state.extruderPosition + newE;
        updates.isExtruding =
          newE > (state.absoluteExtrusion ? state.extruderPosition : 0);
      }

      // Update feed rate
      if (command.parameters.has('F')) {
        updates.feedRate = command.parameters.get('F')!;
      }

      // Update layer based on Z position
      if (newPosition.z !== state.position.z) {
        const layerHeight = this.viewportSettings().layerHeight;
        updates.currentLayer = Math.floor(newPosition.z / layerHeight);

        // Emit layer change event
        if (updates.currentLayer !== state.currentLayer) {
          this.layerChangeSubject.next({
            from: state.currentLayer,
            to: updates.currentLayer,
          });
        }
      }

      return { ...state, ...updates };
    });
  }

  private updateTemperatureFromCommand(command: GCodeCommand): void {
    this._printerState.update((state) => {
      const updates: Partial<PrinterState> = {};

      switch (command.command) {
        case 'M104': // Set hotend temperature
        case 'M109': // Set hotend temperature and wait
          if (command.parameters.has('S')) {
            updates.temperature = command.parameters.get('S')!;
          }
          break;
        case 'M140': // Set bed temperature
        case 'M190': // Set bed temperature and wait
          if (command.parameters.has('S')) {
            updates.bedTemperature = command.parameters.get('S')!;
          }
          break;
      }

      return { ...state, ...updates };
    });
  }

  private updateFanFromCommand(command: GCodeCommand): void {
    this._printerState.update((state) => {
      let fanSpeed = state.fanSpeed;

      switch (command.command) {
        case 'M106': // Turn fan on
          fanSpeed = command.parameters.has('S')
            ? (command.parameters.get('S')! / 255) * 100
            : 100;
          break;
        case 'M107': // Turn fan off
          fanSpeed = 0;
          break;
      }

      return { ...state, fanSpeed };
    });
  }

  private updatePositioningModeFromCommand(command: GCodeCommand): void {
    this._printerState.update((state) => {
      const updates: Partial<PrinterState> = {};

      switch (command.command) {
        case 'G90': // Absolute positioning
          updates.absolutePositioning = true;
          break;
        case 'G91': // Relative positioning
          updates.absolutePositioning = false;
          break;
        case 'M82': // Absolute extrusion
          updates.absoluteExtrusion = true;
          break;
        case 'M83': // Relative extrusion
          updates.absoluteExtrusion = false;
          break;
        case 'G92': // Set position
          if (command.parameters.has('E')) {
            updates.extruderPosition = command.parameters.get('E')!;
          }
          break;
      }

      return { ...state, ...updates };
    });
  }

  private async visualizeCommand(command: GCodeCommand): Promise<void> {
    if (!isMovementCommand(command)) return;

    // Create or update path visualization
    const segment = this.createPathSegmentFromCurrentState(command);
    this.addPathSegmentToVisualization(segment);

    // Update nozzle position indicator
    this.updateNozzleIndicator();
  }

  private createPathSegmentFromCurrentState(
    command: GCodeCommand
  ): PathSegment {
    const state = this.printerState();
    const newPosition = this.calculateNewPosition(state.position, command);
    const newExtruderPos = command.parameters.has('E')
      ? command.parameters.get('E')!
      : state.extruderPosition;

    return this.createPathSegment(
      state.position,
      newPosition,
      state.extruderPosition,
      newExtruderPos,
      command
    );
  }

  private addPathSegmentToVisualization(segment: PathSegment): void {
    const contextId = segment.isExtrusion ? 'extrusion' : 'travel';
    let context = this.pathRenderingContexts.get(contextId);

    if (!context) {
      context = this.createPathRenderingContext(contextId, segment.isExtrusion);
      this.pathRenderingContexts.set(contextId, context);
    }

    this.addSegmentToContext(context, segment);
  }

  private createPathRenderingContext(
    id: string,
    isExtrusion: boolean
  ): PathRenderingContext {
    const geometry = new THREE.BufferGeometry();

    const material = new THREE.LineBasicMaterial({
      color: isExtrusion ? this.viewportSettings().filamentColor : '#888888',
      linewidth: isExtrusion ? 2 : 1,
      transparent: !isExtrusion,
      opacity: isExtrusion ? 1.0 : 0.5,
    });

    const mesh = new THREE.Line(geometry, material);
    this.scene.add(mesh);

    return {
      geometry,
      material,
      mesh,
      vertexCount: 0,
      lastUpdate: Date.now(),
    };
  }

  private addSegmentToContext(
    context: PathRenderingContext,
    segment: PathSegment
  ): void {
    const vertices =
      (context.geometry.getAttribute('position')?.array as Float32Array) ||
      new Float32Array();
    const newVertices = new Float32Array(vertices.length + 6); // 2 vertices * 3 components

    // Copy existing vertices
    newVertices.set(vertices);

    // Add new segment vertices
    const offset = vertices.length;
    newVertices[offset] = segment.startPoint.x;
    newVertices[offset + 1] = segment.startPoint.y;
    newVertices[offset + 2] = segment.startPoint.z;
    newVertices[offset + 3] = segment.endPoint.x;
    newVertices[offset + 4] = segment.endPoint.y;
    newVertices[offset + 5] = segment.endPoint.z;

    context.geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(newVertices, 3)
    );
    context.geometry.attributes.position.needsUpdate = true;
    context.vertexCount += 2;
    context.lastUpdate = Date.now();
  }

  private updateNozzleIndicator(): void {
    if (!this.nozzleIndicator) {
      this.createNozzleIndicator();
    }

    if (this.nozzleIndicator) {
      const position = this.printerState().position;
      this.nozzleIndicator.position.set(position.x, position.z, position.y);
    }
  }

  private createNozzleIndicator(): void {
    const geometry = new THREE.SphereGeometry(1, 8, 8);
    const material = new THREE.MeshBasicMaterial({
      color: 0xff4444,
      transparent: true,
      opacity: 0.8,
    });

    this.nozzleIndicator = new THREE.Mesh(geometry, material);
    this.scene.add(this.nozzleIndicator);
  }

  private updateProgress(commandInfo: CommandExecutionInfo): void {
    const state = this.printerState();
    const progress = (state.currentCommandIndex / state.totalCommands) * 100;

    this._printerState.update((current) => ({
      ...current,
      printProgress: progress,
      estimatedTimeRemaining: Math.max(
        0,
        current.estimatedTimeRemaining - commandInfo.executionTime
      ),
    }));

    this.progressUpdateSubject.next(progress);
  }

  private fastForwardToCommand(targetIndex: number): void {
    // Fast-forward by simulating commands without full visualization
    const commands = this.streamingService.commandBuffer();
    const currentIndex = this.printerState().currentCommandIndex;

    if (targetIndex <= currentIndex) {
      // Going backward - need to rebuild state from beginning
      this.rebuildStateToIndex(targetIndex);
    } else {
      // Going forward - simulate commands
      for (let i = currentIndex; i < targetIndex && i < commands.length; i++) {
        this.simulateCommand(commands[i]);
      }
    }

    this._printerState.update((state) => ({
      ...state,
      currentCommandIndex: targetIndex,
      printProgress: (targetIndex / state.totalCommands) * 100,
    }));
  }

  private simulateCommand(command: GCodeCommand): void {
    // Simplified command execution for fast-forward
    this.updatePrinterStateFromCommand(command);

    // Add to history
    const executionInfo: CommandExecutionInfo = {
      index: this.commandHistory.length,
      command,
      executionTime: 0.01, // Fast execution time
      cumulativeTime: this.printerState().executionTime + 0.01,
      timestamp: new Date(),
      success: true,
    };

    this.commandHistory.push(executionInfo);
  }

  private rebuildStateToIndex(targetIndex: number): void {
    // Reset to beginning and simulate up to target
    this.resetSimulation();
    const commands = this.streamingService.commandBuffer();

    for (let i = 0; i < targetIndex && i < commands.length; i++) {
      this.simulateCommand(commands[i]);
    }
  }

  private rebuildVisualization(): void {
    this.clearVisualization();

    // Rebuild visualization from path segments
    for (const segment of this.pathSegments) {
      this.addPathSegmentToVisualization(segment);
    }

    this.updateNozzleIndicator();
  }

  private clearVisualization(): void {
    // Remove all path rendering contexts
    for (const context of this.pathRenderingContexts.values()) {
      this.scene.remove(context.mesh);
      context.geometry.dispose();
      context.material.dispose();
    }
    this.pathRenderingContexts.clear();

    // Remove nozzle indicator
    if (this.nozzleIndicator) {
      this.scene.remove(this.nozzleIndicator);
      this.nozzleIndicator = null;
    }
  }

  private initializeScene(): void {
    // Setup basic scene
    this.scene.background = new THREE.Color(0x1a1a1a);

    // Create build plate
    this.createBuildPlate();

    // Add coordinate system helper (optional)
    if (this.viewportSettings().showBuildPlate) {
      const axesHelper = new THREE.AxesHelper(50);
      this.scene.add(axesHelper);
    }
  }

  private createBuildPlate(): void {
    const buildVolume = this.viewportSettings().buildVolume;
    const geometry = new THREE.PlaneGeometry(buildVolume.x, buildVolume.y);
    const material = new THREE.MeshBasicMaterial({
      color: 0x333333,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.3,
    });

    this.buildPlate = new THREE.Mesh(geometry, material);
    this.buildPlate.rotation.x = -Math.PI / 2;
    this.buildPlate.position.set(buildVolume.x / 2, 0, buildVolume.y / 2);

    if (this.viewportSettings().showBuildPlate) {
      this.scene.add(this.buildPlate);
    }
  }

  private validateViewportSettings(settings: ViewportSettings): void {
    if (settings.animationSpeed < 0.1 || settings.animationSpeed > 100) {
      throw new Error('Animation speed must be between 0.1 and 100');
    }

    if (settings.layerHeight < 0.01 || settings.layerHeight > 2) {
      throw new Error('Layer height must be between 0.01 and 2mm');
    }

    if (settings.maxPathPoints < 1000 || settings.maxPathPoints > 1000000) {
      throw new Error('Max path points must be between 1,000 and 1,000,000');
    }
  }

  private applyViewportSettings(settings: ViewportSettings): void {
    // Update build plate visibility
    if (this.buildPlate) {
      this.buildPlate.visible = settings.showBuildPlate;
    }

    // Update path colors
    for (const context of this.pathRenderingContexts.values()) {
      if (context.material instanceof THREE.LineBasicMaterial) {
        context.material.color.setStyle(settings.filamentColor);
      }
    }

    // Update build plate size if changed
    if (this.buildPlate) {
      this.updateBuildPlateGeometry(settings.buildVolume);
    }
  }

  private updateBuildPlateGeometry(buildVolume: Vector3D): void {
    if (!this.buildPlate) return;

    // Dispose old geometry
    this.buildPlate.geometry.dispose();

    // Create new geometry
    const geometry = new THREE.PlaneGeometry(buildVolume.x, buildVolume.y);
    this.buildPlate.geometry = geometry;
    this.buildPlate.position.set(buildVolume.x / 2, 0, buildVolume.y / 2);
  }

  private updateSimulationState(state: SimulationState): void {
    this._simulationState.set(state);
    this.stateChangeSubject.next(state);
  }

  private handleError(
    type: SimulatorError['type'],
    message: string,
    details?: unknown
  ): void {
    const error = createSimulatorError(
      type,
      message,
      details ? { originalError: details } : undefined
    );
    this.errorSubject.next(error);
  }

  private handleExecutionError(error: unknown): void {
    this.updateSimulationState(SimulationState.ERROR);
    this.isExecuting = false;

    this.handleError(
      'execution',
      error instanceof Error ? error.message : 'Unknown execution error',
      error
    );
  }

  private setupPerformanceMonitoring(): void {
    if (!this.config().enablePerformanceMonitoring) return;

    // Monitor FPS and performance
    timer(0, 1000)
      .pipe(
        map(() => this.calculatePerformanceMetrics()),
        distinctUntilChanged(
          (prev, curr) =>
            prev.fps === curr.fps && prev.renderTime === curr.renderTime
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((metrics) => {
        this._performanceMetrics.set(metrics);

        // Trigger automatic quality adjustment if enabled
        if (this.config().enableAutomaticQualityAdjustment) {
          this.adjustQualityBasedOnPerformance(metrics);
        }
      });
  }

  private calculatePerformanceMetrics(): PerformanceMetrics {
    const currentTime = Date.now();
    const deltaTime = currentTime - this.lastPerformanceCheck;

    // Calculate FPS from frame counter (this would need to be updated by render loop)
    const fps =
      deltaTime > 0 ? Math.round((this.frameCounter * 1000) / deltaTime) : 60;
    this.frameCounter = 0;
    this.lastPerformanceCheck = currentTime;

    // Calculate average render time
    const avgRenderTime =
      this.renderTimeHistory.length > 0
        ? this.renderTimeHistory.reduce((a, b) => a + b, 0) /
          this.renderTimeHistory.length
        : 16.67;

    // Get memory usage
    const memoryUsage = this.getMemoryUsage();

    return {
      fps,
      pathObjects: this.pathRenderingContexts.size,
      memoryUsage,
      renderTime: avgRenderTime,
      commandProcessingRate: this.streamingService.processingSpeed(),
      bufferUtilization: this.streamingService.bufferUtilization(),
    };
  }

  private getMemoryUsage(): number {
    try {
      const memory = (performance as any).memory;
      return memory ? memory.usedJSHeapSize : 0;
    } catch {
      return 0;
    }
  }

  private adjustQualityBasedOnPerformance(metrics: PerformanceMetrics): void {
    const targetFPS = this.config().targetFPS;

    if (metrics.fps < targetFPS - 5) {
      // Performance is poor, reduce quality
      this.warningSubject.next(
        'Performance degraded, reducing quality settings'
      );

      const currentSettings = this.viewportSettings();
      this.updateViewportSettings({
        maxPathPoints: Math.max(
          1000,
          Math.floor(currentSettings.maxPathPoints * 0.8)
        ),
        enableShadows: false,
        antialiasing: false,
      });
    } else if (metrics.fps > targetFPS + 10) {
      // Performance is good, can increase quality
      const currentSettings = this.viewportSettings();
      if (currentSettings.maxPathPoints < 50000) {
        this.updateViewportSettings({
          maxPathPoints: Math.min(
            50000,
            Math.floor(currentSettings.maxPathPoints * 1.2)
          ),
        });
      }
    }
  }

  private setupStreamingIntegration(): void {
    // Subscribe to streaming service events
    this.streamingService.commandChunks$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((chunk) => {
        // Handle chunk processing if needed
        console.log(
          `Processing chunk ${chunk.chunkIndex + 1}/${chunk.totalChunks}`
        );
      });

    // Subscribe to streaming errors
    this.streamingService.errors$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((error) => {
        this.handleError(error.type, error.message, error.details);
      });
  }

  private setupErrorHandling(): void {
    // Global error handling for uncaught errors
    fromEvent(window, 'error')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event: ErrorEvent) => {
        this.handleError('system', `Global error: ${event.message}`, {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        });
      });
  }

  private setupMemoryManagement(): void {
    // Monitor memory usage and clean up if needed
    timer(0, 5000)
      .pipe(
        // Check every 5 seconds
        filter(() => this.memoryPressure() > 0.8),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.performMemoryCleanup();
      });
  }

  private performMemoryCleanup(): void {
    this.warningSubject.next('High memory usage detected, performing cleanup');

    // Remove old command history entries if too many
    if (this.commandHistory.length > 10000) {
      this.commandHistory = this.commandHistory.slice(-5000);
    }

    // Optimize path rendering contexts
    this.optimizePathRenderingContexts();

    // Force garbage collection if available
    if ('gc' in window && typeof (window as any).gc === 'function') {
      (window as any).gc();
    }
  }

  private optimizePathRenderingContexts(): void {
    for (const [id, context] of this.pathRenderingContexts.entries()) {
      if (context.vertexCount > this.viewportSettings().maxPathPoints) {
        // Reduce vertex count by removing every other vertex
        this.decimatePathContext(context);
      }
    }
  }

  private decimatePathContext(context: PathRenderingContext): void {
    const vertices = context.geometry.getAttribute('position')
      .array as Float32Array;
    const decimatedVertices = new Float32Array(Math.floor(vertices.length / 2));

    // Keep every other vertex
    for (let i = 0, j = 0; i < vertices.length; i += 6, j += 3) {
      if (j < decimatedVertices.length) {
        decimatedVertices[j] = vertices[i];
        decimatedVertices[j + 1] = vertices[i + 1];
        decimatedVertices[j + 2] = vertices[i + 2];
      }
    }

    context.geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(decimatedVertices, 3)
    );
    context.vertexCount = Math.floor(context.vertexCount / 2);
  }
}
