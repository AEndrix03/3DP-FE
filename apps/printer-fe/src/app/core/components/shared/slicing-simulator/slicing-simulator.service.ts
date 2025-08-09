import { computed, effect, Injectable, signal } from '@angular/core';
import * as THREE from 'three';

interface BatchedPath {
  points: THREE.Vector3[];
  colors: THREE.Color[];
  isExtrusion: boolean;
}

interface StreamingBuffer {
  commands: GCodeCommand[];
  maxSize: number;
  currentIndex: number;
  processedLines: number;
}

// Types
export interface GCodeCommand {
  command: string;
  x?: number;
  y?: number;
  z?: number;
  e?: number;
  f?: number;
  i?: number; // Arc center X offset
  j?: number; // Arc center Y offset
  k?: number; // Arc center Z offset
  r?: number; // Arc radius
  p?: number; // Dwell time or parameter
  s?: number; // Spindle speed or parameter
  t?: number; // Tool number

  a?: number; // A axis (rotational)
  b?: number; // B axis (rotational)
  c?: number; // C axis (rotational)
  u?: number; // U axis (additional linear)
  v?: number; // V axis (additional linear)
  w?: number; // W axis (additional linear)

  // Parametri per Bezier e NURBS
  q?: number; // Bezier control point
  controlPoints?: Array<{ x: number; y: number; z?: number }>; // Punti controllo

  lineNumber: number;
  rawLine: string;
}

export interface PrinterPosition {
  x: number;
  y: number;
  z: number;
}

export interface PrinterState {
  position: PrinterPosition;
  extruderPosition: number;
  feedRate: number;
  temperature: number;
  bedTemperature: number;
  fanSpeed: number;
  absolutePositioning: boolean;
  absoluteExtrusion: boolean;
  currentLayer: number;
  totalLayers: number;
  printProgress: number;
  isExtruding: boolean;
  currentCommandIndex: number;
  totalCommands: number;
  executionTime: number;
  estimatedTimeRemaining: number;
}

export interface PathSegment {
  startPoint: THREE.Vector3;
  endPoint: THREE.Vector3;
  extrusionAmount: number;
  isExtrusion: boolean;
  isTravel: boolean;
  isArc: boolean;
  isBezier?: boolean;
  isNurbs?: boolean;
  arcCenter?: THREE.Vector3;
  arcRadius?: number;
  segments?: THREE.Vector3[];
  controlPoints?: THREE.Vector3[];
}

export enum SimulationState {
  IDLE = 'idle',
  LOADING = 'loading',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  ERROR = 'error',
}

@Injectable({
  providedIn: 'root',
})
export class GCodeSimulatorService {
  // Streaming optimizations
  private streamingBuffer: StreamingBuffer = {
    commands: [],
    maxSize: 1000,
    currentIndex: 0,
    processedLines: 0,
  };

  private batchedExtrusionPath: BatchedPath = {
    points: [],
    colors: [],
    isExtrusion: true,
  };
  private batchedTravelPath: BatchedPath = {
    points: [],
    colors: [],
    isExtrusion: false,
  };

  // Optimized mesh handling
  private extrusionMesh: THREE.Line | null = null;
  private travelMesh: THREE.Line | null = null;
  private meshUpdateCounter = 0;
  private maxPathPoints = 100000; // Valore iniziale ragionevole
  private pathBatchSize = 100;

  // Offset e centraggio automatico
  private modelBounds = {
    min: { x: Infinity, y: Infinity, z: Infinity },
    max: { x: -Infinity, y: -Infinity, z: -Infinity },
  };
  private modelOffset = { x: 0, y: 0, z: 0 };
  private autoCenterModel = true;
  private buildVolumeCenter = { x: 100, y: 100, z: 0 }; // Centro del volume di build

  // Performance optimizations
  private baseCommandInterval = 16; // 60fps target
  private lastSpeedUpdate = 0;
  private frameSkipCounter = 0;
  private adaptiveQuality = true;

  // Timing
  private animationId: number | null = null;
  private startTime = 0;
  private lastUpdateTime = 0;
  private commandStartTime = 0;

  // Advanced curve settings
  private showBezierControlPoints = false;
  private bezierControlPointsMeshes: THREE.Mesh[] = [];
  private curveResolution = 20;

  // File streaming
  private fileReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private textDecoder = new TextDecoder();
  private lineBuffer = '';
  private totalFileSize = 0;
  private loadedBytes = 0;

  // Core Signals
  private readonly _commands = signal<GCodeCommand[]>([]);
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
  private readonly _loadingProgress = signal<number>(0);
  private readonly _filamentColor = signal<string>('#FF4444');
  private readonly _isJumping = signal<boolean>(false);
  private readonly _jumpTarget = signal<number>(-1);
  private readonly _jumpProgress = signal<number>(0);

  // Path tracking (optimized)
  private readonly _pathSegments = signal<PathSegment[]>([]);
  private readonly _currentPath = signal<PathSegment | null>(null);

  // Three.js objects
  private scene: THREE.Scene;
  private extrudedPaths: THREE.Group;
  private travelPaths: THREE.Group;
  private nozzlePosition: THREE.Group;
  private buildPlate: THREE.Mesh;

  // Computed signals
  readonly commands = this._commands.asReadonly();
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
  readonly pathSegments = this._pathSegments.asReadonly();
  readonly currentPath = this._currentPath.asReadonly();
  readonly animationSpeed = this._animationSpeed.asReadonly();
  readonly loadingProgress = this._loadingProgress.asReadonly();
  readonly filamentColor = this._filamentColor.asReadonly();
  readonly isJumping = this._isJumping.asReadonly();
  readonly jumpTarget = this._jumpTarget.asReadonly();
  readonly jumpProgress = this._jumpProgress.asReadonly();

  // Method to get command progress
  getCommandProgress(): number {
    const total = this.totalCommands();
    const current = this._currentCommandIndex();
    if (total === 0) return 0;

    const progress = Math.min((current / total) * 100, 100);
    return Math.max(0, progress);
  }

  // Optimized computed signals with proper bounds checking
  readonly totalCommands = computed(
    () => this.streamingBuffer.processedLines || this._commands().length
  );
  readonly printProgress = computed(() => {
    const currentLayer = this.currentLayer();
    const totalLayers = this.totalLayers();

    if (totalLayers === 0) return 0;

    // Fix: Progress based on layers, not commands - more meaningful for 3D printing
    const layerProgress = Math.min((currentLayer / totalLayers) * 100, 100);
    const result = Math.max(0, layerProgress);

    return result;
  });

  readonly currentLayer = computed(() => {
    const pos = this._printerPosition();
    return Math.max(1, Math.floor(pos.z / 0.2) + 1);
  });

  readonly totalLayers = computed(() => {
    // Fix: Calculate based on all commands, not just loaded buffer
    const commands = this._commands();
    const processedLines = this.streamingBuffer.processedLines;

    // For streaming files, we need to estimate total layers
    if (processedLines > commands.length) {
      // File is still loading - estimate from current commands
      const uniqueZ = new Set<number>();
      commands.forEach((cmd) => {
        if (cmd.z !== undefined) {
          uniqueZ.add(Math.round(cmd.z * 100) / 100);
        }
      });

      // Estimate total layers based on progress
      const loadedLayers = uniqueZ.size;
      const loadingProgress = commands.length / processedLines;
      const estimatedTotal = Math.ceil(
        loadedLayers / Math.max(loadingProgress, 0.01)
      );

      return Math.max(loadedLayers, estimatedTotal);
    } else {
      // File fully loaded - calculate exact layers
      const uniqueZ = new Set<number>();
      commands.forEach((cmd) => {
        if (cmd.z !== undefined) {
          uniqueZ.add(Math.round(cmd.z * 100) / 100);
        }
      });
      return Math.max(1, uniqueZ.size);
    }
  });

  readonly estimatedTimeRemaining = computed(() => {
    const currentLayer = this.currentLayer();
    const totalLayers = this.totalLayers();
    const elapsed = this._executionTime();

    if (currentLayer === 0 || elapsed === 0 || totalLayers === 0) return 0;

    // Layer-based time estimation (more accurate for 3D printing)
    const avgTimePerLayer = elapsed / Math.max(currentLayer, 1);
    const remainingLayers = totalLayers - currentLayer;
    const estimate = remainingLayers * avgTimePerLayer;

    // Ensure reasonable estimates
    return Math.max(0, estimate);
  });

  readonly fullState = computed<PrinterState>(() => {
    const state = {
      position: this._printerPosition(),
      extruderPosition: this._extruderPosition(),
      feedRate: this._feedRate(),
      temperature: this._temperature(),
      bedTemperature: this._bedTemperature(),
      fanSpeed: this._fanSpeed(),
      absolutePositioning: this._absolutePositioning(),
      absoluteExtrusion: this._absoluteExtrusion(),
      currentLayer: this.currentLayer(),
      totalLayers: this.totalLayers(),
      printProgress: this.printProgress(), // Now layer-based
      isExtruding: this._isExtruding(),
      currentCommandIndex: this._currentCommandIndex(),
      totalCommands: this.totalCommands(),
      executionTime: this._executionTime(),
      estimatedTimeRemaining: this.estimatedTimeRemaining(),
    };

    return state;
  });

  // Optimized G-code patterns
  private readonly GCODE_PATTERNS = new Map([
    ['command', /^([GM]\d+)/],
    ['x', /X([-+]?\d*\.?\d+)/],
    ['y', /Y([-+]?\d*\.?\d+)/],
    ['z', /Z([-+]?\d*\.?\d+)/],
    ['e', /E([-+]?\d*\.?\d+)/],
    ['f', /F(\d*\.?\d+)/],
    ['i', /I([-+]?\d*\.?\d+)/],
    ['j', /J([-+]?\d*\.?\d+)/],
    ['k', /K([-+]?\d*\.?\d+)/],
    ['r', /R([-+]?\d*\.?\d+)/],
    ['p', /P(\d*\.?\d+)/],
    ['s', /S(\d*\.?\d+)/],
    ['t', /T(\d+)/],
  ]);

  constructor() {
    console.log('🚀 Initializing GCodeSimulatorService...');

    this.initializeScene();
    this.setupEffects();

    // Configurazione iniziale ottimizzata
    this.maxPathPoints = 100000; // Valore iniziale ragionevole
    this.pathBatchSize = 100;

    console.log('✅ GCodeSimulatorService initialized');
  }

  /**
   * Calcola i bounds del modello dalle coordinate G-code
   */
  private calculateModelBounds(commands: GCodeCommand[]): void {
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
  private calculateCenteringOffset(): void {
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

    // Ricalcola offset se abbiamo già dei comandi caricati
    if (this._commands().length > 0) {
      this.calculateCenteringOffset();
    }
  }

  /**
   * Abilita/disabilita centraggio automatico
   */
  setAutoCenterModel(enabled: boolean): void {
    this.autoCenterModel = enabled;
    console.log(`🎯 Auto-centering ${enabled ? 'enabled' : 'disabled'}`);

    if (this._commands().length > 0) {
      this.calculateCenteringOffset();
    }
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

  /**
   * Hard reset completo - da chiamare all'init del componente
   */
  hardReset(): void {
    console.log('🔄 Performing hard reset of simulator service...');

    // Ferma tutto
    this.forceStopPrivate();

    // Reset completo di tutti i segnali
    this._commands.set([]);
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
    this._pathSegments.set([]);
    this._currentPath.set(null);
    this._errorMessage.set('');
    this._loadingProgress.set(0);
    this._isJumping.set(false);
    this._jumpTarget.set(-1);
    this._jumpProgress.set(0);

    // Reset streaming buffer
    this.streamingBuffer = {
      commands: [],
      maxSize: 1000,
      currentIndex: 0,
      processedLines: 0,
    };

    // Reset batch paths
    this.batchedExtrusionPath = {
      points: [],
      colors: [],
      isExtrusion: true,
    };
    this.batchedTravelPath = {
      points: [],
      colors: [],
      isExtrusion: false,
    };

    // Reset timing
    this.startTime = 0;
    this.lastUpdateTime = 0;
    this.commandStartTime = 0;
    this.meshUpdateCounter = 0;

    // Pulisci la scena
    this.clearAllPaths();

    // Reset file reader
    if (this.fileReader) {
      this.fileReader.cancel().catch(() => {}); // Ignora errori di cancellazione
      this.fileReader = null;
    }
    this.lineBuffer = '';
    this.totalFileSize = 0;
    this.loadedBytes = 0;

    console.log('✅ Hard reset completed');
  }

  /**
   * Stop forzato - garantisce la pulizia completa
   */
  forceStop(): void {
    this.forceStopPrivate();
  }

  /**
   * Implementazione privata di forceStop
   */
  private forceStopPrivate(): void {
    // Cancella animazione se presente
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    // Ferma il file reader se attivo
    if (this.fileReader) {
      try {
        this.fileReader.cancel();
      } catch (e) {
        console.warn('Error cancelling file reader:', e);
      }
      this.fileReader = null;
    }

    // Assicurati che lo stato sia corretto
    this._simulationState.set(SimulationState.IDLE);
    this._isJumping.set(false);
  }

  /**
   * Enhanced streaming G-code blob loader with better completion detection
   */
  async loadGCodeBlob(blob: Blob): Promise<void> {
    this._simulationState.set(SimulationState.LOADING);
    this._loadingProgress.set(0);
    this.totalFileSize = blob.size;
    this.loadedBytes = 0;
    this.streamingBuffer.processedLines = 0;

    // Reset any existing state
    this._commands.set([]);
    this._currentCommandIndex.set(0);

    try {
      const stream = blob.stream();
      this.fileReader = stream.getReader();

      await this.processStreamingBlob();

      // NUOVO: Calcola bounds e centraggio dopo aver caricato tutti i comandi
      const commands = this._commands();
      if (commands.length > 0) {
        this.calculateModelBounds(commands);
        this.calculateCenteringOffset();
      }

      this._simulationState.set(SimulationState.IDLE);
      this._loadingProgress.set(100);

      const totalCommands = commands.length;
      const processedLines = this.streamingBuffer.processedLines;

      console.log(`🎉 Streaming completed successfully:`);
      console.log(`- Total lines processed: ${processedLines}`);
      console.log(`- Commands in buffer: ${totalCommands}`);
      console.log(`- File size: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);

      // Configura i limiti dinamici in base al file caricato
      this.configureDynamicLimits();
    } catch (error) {
      this._errorMessage.set(`Error loading G-code: ${error}`);
      this._simulationState.set(SimulationState.ERROR);
      console.error('G-code loading failed:', error);
    }
  }

  /**
   * Process streaming blob in optimized chunks
   */
  private async processStreamingBlob(): Promise<void> {
    const CHUNK_SIZE = 64 * 1024; // 64KB chunks for optimal performance
    let buffer = '';

    while (true) {
      const { done, value } = await this.fileReader!.read();

      if (done) break;

      this.loadedBytes += value.length;
      const chunk = this.textDecoder.decode(value, { stream: true });
      buffer += chunk;

      // Process complete lines
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      // Batch process lines for better performance
      const batchedCommands = this.processBatchedLines(lines);

      if (batchedCommands.length > 0) {
        this.addCommandsToBuffer(batchedCommands);
      }

      // Update progress
      const progress = (this.loadedBytes / this.totalFileSize) * 100;
      this._loadingProgress.set(Math.min(progress, 100));

      // Allow UI updates
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    // Process remaining buffer
    if (buffer.trim()) {
      const finalCommands = this.processBatchedLines([buffer]);
      if (finalCommands.length > 0) {
        this.addCommandsToBuffer(finalCommands);
      }
    }
  }

  /**
   * Process multiple lines in batch for better performance
   */
  private processBatchedLines(lines: string[]): GCodeCommand[] {
    const commands: GCodeCommand[] = [];

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith(';') && !trimmed.startsWith('%')) {
        const command = this.parseLineOptimized(
          trimmed,
          this.streamingBuffer.processedLines++
        );
        if (command) {
          commands.push(command);
        }
      }
    });

    return commands;
  }

  /**
   * Optimized line parsing with caching
   */
  private parseLineOptimized(
    line: string,
    lineNumber: number
  ): GCodeCommand | null {
    const commandMatch = this.GCODE_PATTERNS.get('command')?.exec(line);
    if (!commandMatch) return null;

    const command: GCodeCommand = {
      command: commandMatch[1],
      lineNumber,
      rawLine: line,
    };

    // Optimized parameter extraction
    for (const [param, pattern] of this.GCODE_PATTERNS.entries()) {
      if (param === 'command') continue;

      const match = pattern.exec(line);
      if (match) {
        (command as any)[param] =
          param === 't' ? parseInt(match[1], 10) : parseFloat(match[1]);
      }
    }

    return command;
  }

  /**
   * Add commands to buffer and continue simulation if needed
   */
  private addCommandsToBuffer(commands: GCodeCommand[]): void {
    const currentCommands = this._commands();
    this._commands.set([...currentCommands, ...commands]);

    // Maintain buffer size for memory efficiency
    if (this.streamingBuffer.commands.length > this.streamingBuffer.maxSize) {
      this.streamingBuffer.commands = this.streamingBuffer.commands.slice(
        -this.streamingBuffer.maxSize
      );
    }

    // If simulation is waiting for more commands, resume it
    if (this._simulationState() === SimulationState.RUNNING) {
      const currentIndex = this._currentCommandIndex();
      const totalCommands = this.totalCommands();

      // Check if we can continue (we were waiting for buffer)
      if (
        currentIndex < totalCommands &&
        currentIndex < this._commands().length
      ) {
        console.log(
          `📥 Buffer loaded more commands. Resuming simulation at ${currentIndex}/${totalCommands}`
        );
        // The animation loop will automatically continue processing
      }
    }
  }

  /**
   * Load G-code file with streaming (fallback method)
   */
  async loadGCodeFile(file: File): Promise<void> {
    return this.loadGCodeBlob(file);
  }

  /**
   * Set buffer size for streaming
   */
  setBufferSize(size: number): void {
    this.streamingBuffer.maxSize = Math.max(100, Math.min(10000, size));
  }

  /**
   * Configurazione dinamica dei limiti di memoria basata sulla dimensione del file
   */
  configureDynamicLimits(): void {
    const totalCommands = this.totalCommands();

    // Configurazione più aggressiva per file grandi
    if (totalCommands > 1000000) {
      // File giganti (>1M comandi)
      this.maxPathPoints = 500000; // 500k punti = ~60MB
      this.pathBatchSize = 1000;
      console.log(
        `🔥 Huge file detected (${totalCommands} commands), using maximum capacity settings`
      );
    } else if (totalCommands > 500000) {
      // File molto grandi (>500k comandi)
      this.maxPathPoints = 300000; // 300k punti = ~36MB
      this.pathBatchSize = 500;
      console.log(
        `📈 Very large file detected (${totalCommands} commands), using high-capacity settings`
      );
    } else if (totalCommands > 100000) {
      // File grandi (>100k comandi)
      this.maxPathPoints = 200000; // 200k punti = ~24MB
      this.pathBatchSize = 200;
      console.log(
        `📊 Large file detected (${totalCommands} commands), using expanded settings`
      );
    } else if (totalCommands > 20000) {
      // File medi (>20k comandi)
      this.maxPathPoints = 100000; // 100k punti = ~12MB
      this.pathBatchSize = 100;
      console.log(
        `📋 Medium file detected (${totalCommands} commands), using standard settings`
      );
    } else {
      // File piccoli
      this.maxPathPoints = 50000; // 50k punti = ~6MB
      this.pathBatchSize = 50;
      console.log(
        `📄 Small file detected (${totalCommands} commands), using optimized settings`
      );
    }

    console.log(
      `🎛️  Memory configuration: ${this.maxPathPoints} max points, ${this.pathBatchSize} batch size`
    );
  }

  private initializeScene(): void {
    this.scene = new THREE.Scene();
    this.extrudedPaths = new THREE.Group();
    this.travelPaths = new THREE.Group();

    this.scene.add(this.extrudedPaths);
    this.scene.add(this.travelPaths);

    this.initializeOptimizedBatchedMeshes();
    this.createNozzle();
    this.createBuildPlate();

    // NUOVO: Assi centrati
    const axesHelper = new THREE.AxesHelper(30);
    axesHelper.position.set(
      this.buildVolumeCenter.x,
      0.1,
      this.buildVolumeCenter.y
    );
    this.scene.add(axesHelper);

    // NUOVO: Griglia centrata
    const gridHelper = new THREE.GridHelper(300, 30, 0x444444, 0x222222);
    gridHelper.position.set(
      this.buildVolumeCenter.x,
      0,
      this.buildVolumeCenter.y
    );
    this.scene.add(gridHelper);
  }

  /**
   * Optimized batched mesh initialization with better memory management and rendering fixes
   */
  private initializeOptimizedBatchedMeshes(): void {
    // Pre-allocate buffers for better performance
    const maxVertices = this.maxPathPoints * 2; // Line segments need 2 vertices each

    const extrusionGeometry = new THREE.BufferGeometry();
    const travelGeometry = new THREE.BufferGeometry();

    // Pre-allocate typed arrays with proper size
    const extrusionPositions = new Float32Array(maxVertices * 3);
    const extrusionColors = new Float32Array(maxVertices * 3);
    const travelPositions = new Float32Array(maxVertices * 3);

    extrusionGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(extrusionPositions, 3)
    );
    extrusionGeometry.setAttribute(
      'color',
      new THREE.BufferAttribute(extrusionColors, 3)
    );
    travelGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(travelPositions, 3)
    );

    // Fix: Optimized materials with proper rendering settings
    const extrusionMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      depthTest: true,
      depthWrite: true,
      side: THREE.DoubleSide, // Fix disappearing issue
    });

    const travelMaterial = new THREE.LineBasicMaterial({
      color: 0x888888,
      transparent: true,
      opacity: 0.3,
      depthTest: true,
      depthWrite: false, // Travel moves don't need depth write
      side: THREE.DoubleSide, // Fix disappearing issue
    });

    this.extrusionMesh = new THREE.Line(extrusionGeometry, extrusionMaterial);
    this.travelMesh = new THREE.Line(travelGeometry, travelMaterial);

    // Fix: Prevent frustum culling issues
    this.extrusionMesh.frustumCulled = false;
    this.travelMesh.frustumCulled = false;

    // Set render order to ensure proper display
    this.extrusionMesh.renderOrder = 1;
    this.travelMesh.renderOrder = 0;

    this.extrudedPaths.add(this.extrusionMesh);
    this.travelPaths.add(this.travelMesh);
  }

  private createNozzle(): void {
    const nozzleGroup = new THREE.Group();

    // Fix: Improved nozzle with better materials and culling settings
    const nozzleTipGeometry = new THREE.ConeGeometry(0.8, 3, 8);
    const nozzleTipMaterial = new THREE.MeshLambertMaterial({
      color: 0x666666,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide, // Prevent disappearing
    });
    const nozzleTip = new THREE.Mesh(nozzleTipGeometry, nozzleTipMaterial);
    nozzleTip.position.y = 1.5;
    nozzleTip.frustumCulled = false; // Prevent culling issues
    nozzleGroup.add(nozzleTip);

    const heaterGeometry = new THREE.CylinderGeometry(2, 2, 4, 8);
    const heaterMaterial = new THREE.MeshLambertMaterial({
      color: 0x444444,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });
    const heater = new THREE.Mesh(heaterGeometry, heaterMaterial);
    heater.position.y = 5;
    heater.frustumCulled = false;
    nozzleGroup.add(heater);

    // Fix: Improved glow effect with proper settings
    const glowGeometry = new THREE.SphereGeometry(1.2, 12, 12);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xff4444,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthTest: false, // Always visible
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.position.y = 0.5;
    glow.frustumCulled = false;
    glow.renderOrder = 999; // Always render last
    nozzleGroup.add(glow);

    // Prevent the entire nozzle group from being culled
    nozzleGroup.frustumCulled = false;

    this.nozzlePosition = nozzleGroup;
    this.scene.add(this.nozzlePosition);
  }

  private createBuildPlate(): void {
    const plateGeometry = new THREE.PlaneGeometry(200, 200);
    const plateMaterial = new THREE.MeshLambertMaterial({
      color: 0x888888,
      transparent: true,
      opacity: 0.8,
    });

    this.buildPlate = new THREE.Mesh(plateGeometry, plateMaterial);
    this.buildPlate.rotation.x = -Math.PI / 2;

    // NUOVO: Centra la build plate rispetto al volume di build
    this.buildPlate.position.set(
      this.buildVolumeCenter.x,
      -0.1,
      this.buildVolumeCenter.y
    );

    this.buildPlate.receiveShadow = true;

    this.scene.add(this.buildPlate);
  }

  private setupEffects(): void {
    // Fix: Remove throttling for nozzle movement to prevent blocking
    effect(() => {
      const pos = this._printerPosition();
      const isExtruding = this._isExtruding();

      // NUOVO: Applica offset di centraggio alla posizione del nozzle
      const centeredPos = this.applyCenteringOffset(pos);

      // Always update nozzle position immediately
      if (this.nozzlePosition) {
        this.nozzlePosition.position.set(
          centeredPos.x,
          centeredPos.z + 8,
          centeredPos.y
        );

        // Update glow effect
        const glowMesh = this.nozzlePosition.children.find(
          (child) =>
            child instanceof THREE.Mesh &&
            (child.material as THREE.MeshBasicMaterial).color?.getHex() ===
              0xff4444
        ) as THREE.Mesh;

        if (glowMesh?.material instanceof THREE.MeshBasicMaterial) {
          glowMesh.material.opacity = isExtruding ? 0.6 : 0;
          if (isExtruding) {
            glowMesh.scale.setScalar(1 + Math.sin(Date.now() * 0.01) * 0.2);
          } else {
            glowMesh.scale.setScalar(1);
          }
        }
      }
    });

    // Effect for filament color changes
    effect(() => {
      const color = this._filamentColor();
      if (color) {
        this.updateFilamentColor(color);
      }
    });
  }

  // Optimized control methods
  start(): void {
    console.log('🚀 Starting simulation...');

    if (this._commands().length === 0) {
      const error = 'No commands loaded.';
      this._errorMessage.set(error);
      console.error(error);
      return;
    }

    // Se è completed, reset automatico
    if (this._simulationState() === SimulationState.COMPLETED) {
      console.log('Simulation was completed, resetting...');
      this.reset();
    }

    // Se è già in running, non fare nulla
    if (this._simulationState() === SimulationState.RUNNING) {
      console.log('Simulation already running');
      return;
    }

    // Pulisci errori precedenti
    this._errorMessage.set('');

    // Avvia
    this._simulationState.set(SimulationState.RUNNING);
    const now = performance.now();
    this.startTime = now;
    this.lastUpdateTime = now;
    this.commandStartTime = now;

    console.log('Starting animation loop...');
    this.animate();
  }

  pause(): void {
    const currentState = this._simulationState();
    console.log(`⏸️ Pause called, current state: ${currentState}`);

    if (currentState === SimulationState.RUNNING) {
      // Pausa
      this._simulationState.set(SimulationState.PAUSED);
      if (this.animationId !== null) {
        cancelAnimationFrame(this.animationId);
        this.animationId = null;
      }
      console.log('🔸 Simulation paused');
    } else if (currentState === SimulationState.PAUSED) {
      // Riprendi
      console.log('▶️ Resuming simulation...');
      this._simulationState.set(SimulationState.RUNNING);
      this.lastUpdateTime = performance.now(); // Reset timing per evitare jump temporali
      this.animate();
      console.log('✅ Simulation resumed');
    }
  }

  stop(): void {
    console.log('⏹️ Stopping simulation...');

    this.forceStopPrivate();

    // Reset timing ma mantieni posizione corrente
    this.lastUpdateTime = 0;
    this.commandStartTime = 0;

    console.log('✅ Simulation stopped');
  }

  reset(): void {
    console.log('🔄 Resetting simulation...');

    this.forceStopPrivate();

    // Reset posizioni e stato
    this._currentCommandIndex.set(0);
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
    this._pathSegments.set([]);
    this._currentPath.set(null);
    this._errorMessage.set('');

    // Reset timing
    this.startTime = 0;
    this.lastUpdateTime = 0;
    this.commandStartTime = 0;
    this.meshUpdateCounter = 0;

    // Reset streaming buffer position ma mantieni comandi
    this.streamingBuffer.currentIndex = 0;

    // Pulisci i path ma mantieni i comandi caricati
    this.clearAllPaths();

    this._simulationState.set(SimulationState.IDLE);

    console.log('✅ Simulation reset completed');
  }

  /**
   * Pulizia completa di tutti i path con dispose delle risorse
   */
  private clearAllPaths(): void {
    // Pulisci batch paths
    this.batchedExtrusionPath.points = [];
    this.batchedExtrusionPath.colors = [];
    this.batchedTravelPath.points = [];
    this.batchedTravelPath.colors = [];

    // Dispose delle geometrie esistenti
    if (this.extrusionMesh?.geometry) {
      this.extrusionMesh.geometry.dispose();
    }
    if (this.travelMesh?.geometry) {
      this.travelMesh.geometry.dispose();
    }

    // Ricrea le mesh con geometrie vuote
    this.initializeOptimizedBatchedMeshes();

    // Forza aggiornamento
    this.updateBatchedMeshes();
  }

  /**
   * Optimized animation loop with streaming buffer support
   */
  private animate(): void {
    if (this._simulationState() !== SimulationState.RUNNING) {
      console.log(`⏹️ Animation stopped, state: ${this._simulationState()}`);
      return;
    }

    this.animationId = requestAnimationFrame(() => this.animate());

    const now = performance.now();
    const deltaTime = now - this.lastUpdateTime;
    const speed = this._animationSpeed();
    const totalCommands = this.totalCommands();

    // Configurazione dinamica al primo frame
    if (this.meshUpdateCounter === 0 && totalCommands > 0) {
      this.configureDynamicLimits();
    }

    // Performance scaling for large files
    const baseInterval = this.getOptimalInterval(totalCommands, speed);
    const interval = Math.max(1, baseInterval / speed);

    if (deltaTime >= interval) {
      const batchSize = this.getOptimalBatchSize(totalCommands, speed);
      let processed = 0;

      // Batch processing con limite tempo per prevenire blocchi UI
      const startTime = performance.now();
      const maxProcessingTime = 16; // Max 16ms per batch (60fps)

      for (
        let i = 0;
        i < batchSize && this._simulationState() === SimulationState.RUNNING;
        i++
      ) {
        const beforeIndex = this._currentCommandIndex();
        this.processNextCommand();
        const afterIndex = this._currentCommandIndex();

        if (afterIndex > beforeIndex) {
          processed++;
        } else {
          break; // Nessun comando processato, esci
        }

        // Controlla tempo trascorso
        if (performance.now() - startTime > maxProcessingTime) {
          console.log(
            `⏱️  Batch time limit reached, processed ${processed} commands`
          );
          break;
        }
      }

      this.lastUpdateTime = now;

      // Throttle execution time updates for performance
      if (now - this.commandStartTime > 100) {
        // Update every 100ms max
        this._executionTime.set((now - this.startTime) / 1000);
        this.commandStartTime = now;
      }
    }
  }

  /**
   * Get optimal interval based on file size
   */
  private getOptimalInterval(totalCommands: number, speed: number): number {
    let baseInterval = 50; // Default 50ms

    // Faster intervals for large files to prevent UI lag
    if (totalCommands > 100000) baseInterval = 16; // ~60fps
    else if (totalCommands > 50000) baseInterval = 25; // ~40fps
    else if (totalCommands > 10000) baseInterval = 33; // ~30fps

    return baseInterval;
  }

  /**
   * Get optimal batch size based on file size and speed
   */
  private getOptimalBatchSize(totalCommands: number, speed: number): number {
    let batchSize = 1;

    // Larger batches for bigger files and higher speeds
    if (totalCommands > 100000) {
      batchSize = Math.min(50, Math.floor(speed / 5));
    } else if (totalCommands > 50000) {
      batchSize = Math.min(20, Math.floor(speed / 10));
    } else if (totalCommands > 10000) {
      batchSize = Math.min(10, Math.floor(speed / 20));
    } else {
      batchSize = Math.min(5, Math.floor(speed / 10));
    }

    return Math.max(1, batchSize);
  }

  /**
   * Optimized command processing with layer-aware completion
   */
  private processNextCommand(): void {
    const commands = this._commands();
    const currentIndex = this._currentCommandIndex();
    const processedLines = this.streamingBuffer.processedLines;

    // Calcola il vero totale - questo è importante!
    const actualTotal = Math.max(processedLines, commands.length);

    // Log periodico per debug (ogni 1000 comandi)
    if (currentIndex % 1000 === 0 && currentIndex > 0) {
      console.log(
        `🔄 Processing command ${currentIndex}/${actualTotal} (buffer: ${commands.length})`
      );
    }

    // IMPORTANTE: Non completare finché non abbiamo processato tutti i comandi
    if (currentIndex >= actualTotal) {
      this._simulationState.set(SimulationState.COMPLETED);
      console.log(`✅ Simulation completed successfully!`);
      console.log(
        `📊 Final stats: ${currentIndex}/${actualTotal} commands, ${this.currentLayer()}/${this.totalLayers()} layers`
      );
      return;
    }

    // Se abbiamo raggiunto la fine del buffer ma ci sono altri comandi in arrivo
    if (currentIndex >= commands.length) {
      if (processedLines > commands.length) {
        // File ancora in caricamento - aspetta
        console.log(
          `⏳ Waiting for buffer: ${currentIndex}/${commands.length} (total: ${processedLines})`
        );
        return;
      } else {
        // Fine reale del file
        this._simulationState.set(SimulationState.COMPLETED);
        return;
      }
    }

    const command = commands[currentIndex];
    if (command) {
      const segment = this.executeCommand(command);
      if (segment) {
        this.addPathSegment(segment);
      }
    } else {
      console.warn(`❌ Command at index ${currentIndex} is undefined!`);
    }

    this._currentCommandIndex.set(currentIndex + 1);
  }

  /**
   * Optimized path visualization with adaptive batching for large files
   */
  private addPathSegment(segment: PathSegment): void {
    const targetBatch = segment.isExtrusion
      ? this.batchedExtrusionPath
      : this.batchedTravelPath;

    // Configura limiti dinamici se non fatto
    if (this.meshUpdateCounter === 0) {
      this.configureDynamicLimits();
    }

    const speed = this._animationSpeed();
    const totalCommands = this.totalCommands();

    if (segment.segments && segment.segments.length > 1) {
      // Add curve segments with adaptive LOD
      const segmentStep = speed > 50 ? Math.max(2, Math.floor(speed / 25)) : 1;

      for (
        let i = 0;
        i < segment.segments.length - segmentStep;
        i += segmentStep
      ) {
        const next = Math.min(i + segmentStep, segment.segments.length - 1);
        targetBatch.points.push(segment.segments[i], segment.segments[next]);

        if (segment.isExtrusion) {
          const color = this.getExtrusionColor(segment.extrusionAmount);
          targetBatch.colors.push(color, color);
        }
      }
    } else {
      // Add simple line segment
      targetBatch.points.push(segment.startPoint, segment.endPoint);

      if (segment.isExtrusion) {
        const color = this.getExtrusionColor(segment.extrusionAmount);
        targetBatch.colors.push(color, color);
      }
    }

    // Controllo memoria solo se necessario - soglia più alta
    if (targetBatch.points.length > this.maxPathPoints * 1.2) {
      this.trimPathBatch(targetBatch);
    }

    // Aggiornamento mesh adattivo
    this.meshUpdateCounter++;
    const updateFrequency = this.getAdaptiveBatchSize(totalCommands, speed);

    if (this.meshUpdateCounter >= updateFrequency) {
      this.updateBatchedMeshes();
      this.meshUpdateCounter = 0;
    }
  }

  /**
   * Get adaptive batch size based on file size and speed
   */
  private getAdaptiveBatchSize(totalCommands: number, speed: number): number {
    let batchSize = this.pathBatchSize;

    // Larger batches for bigger files
    if (totalCommands > 50000) batchSize *= 4;
    else if (totalCommands > 10000) batchSize *= 2;

    // Larger batches for higher speeds
    if (speed > 500) batchSize *= 8;
    else if (speed > 100) batchSize *= 4;
    else if (speed > 10) batchSize *= 2;

    return Math.min(batchSize, 1000); // Cap at 1000
  }

  /**
   * Sistema di trimming intelligente migliorato
   */
  private trimPathBatch(batch: BatchedPath): void {
    const currentPoints = batch.points.length;
    const totalCommands = this.totalCommands();

    // Non tagliare mai per file piccoli
    if (totalCommands < 100000) {
      return;
    }

    // Calcola uso memoria
    const pointsMemoryMB = (currentPoints * 12) / (1024 * 1024); // 12 bytes per punto (x,y,z)
    const colorsMemoryMB = (batch.colors.length * 12) / (1024 * 1024); // 12 bytes per colore (r,g,b)
    const totalMemoryMB = pointsMemoryMB + colorsMemoryMB;

    // Soglie basate sulla dimensione del file
    let memoryLimitMB = 50; // Default 50MB
    if (totalCommands > 1000000) memoryLimitMB = 200; // 200MB per file giganti
    else if (totalCommands > 500000)
      memoryLimitMB = 150; // 150MB per file molto grandi
    else if (totalCommands > 100000) memoryLimitMB = 100; // 100MB per file grandi

    if (totalMemoryMB > memoryLimitMB) {
      const keepRatio = 0.75; // Mantieni 75% dei punti
      const keepCount = Math.floor(this.maxPathPoints * keepRatio);
      const removeCount = currentPoints - keepCount;

      console.warn(
        `🗑️  Memory limit exceeded (${totalMemoryMB.toFixed(
          1
        )}MB > ${memoryLimitMB}MB)`
      );
      console.warn(`🔄 Trimming ${removeCount} points (keeping ${keepCount})`);

      // Rimuovi dall'inizio (punti più vecchi)
      batch.points.splice(0, removeCount);
      if (batch.colors.length > 0) {
        batch.colors.splice(0, removeCount);
      }

      console.log(
        `✅ Trimming completed, new memory usage: ${(
          (batch.points.length * 12 + batch.colors.length * 12) /
          (1024 * 1024)
        ).toFixed(1)}MB`
      );
    }
  }

  /**
   * Efficient mesh updates with proper buffer management
   */
  private updateBatchedMeshes(): void {
    this.updateMeshFromBatch(this.extrusionMesh!, this.batchedExtrusionPath);
    this.updateMeshFromBatch(this.travelMesh!, this.batchedTravelPath);
  }

  private updateMeshFromBatch(mesh: THREE.Line, batch: BatchedPath): void {
    if (batch.points.length === 0) return;

    const geometry = mesh.geometry;
    const positionAttribute = geometry.getAttribute(
      'position'
    ) as THREE.BufferAttribute;
    const colorAttribute = geometry.getAttribute(
      'color'
    ) as THREE.BufferAttribute;

    const requiredPositions = batch.points.length * 3;
    const currentPositions = positionAttribute
      ? positionAttribute.array.length
      : 0;

    // Se serve più spazio di quello allocato, ricreiamo la geometria
    if (requiredPositions > currentPositions) {
      this.recreateGeometry(mesh, batch);
      return;
    }

    // Aggiorna le posizioni esistenti
    batch.points.forEach((point, i) => {
      const index = i * 3;
      (positionAttribute.array as Float32Array)[index] = point.x;
      (positionAttribute.array as Float32Array)[index + 1] = point.y;
      (positionAttribute.array as Float32Array)[index + 2] = point.z;
    });

    positionAttribute.needsUpdate = true;

    // Aggiorna i colori se necessario
    if (batch.isExtrusion && colorAttribute && batch.colors.length > 0) {
      batch.colors.forEach((color, i) => {
        const index = i * 3;
        (colorAttribute.array as Float32Array)[index] = color.r;
        (colorAttribute.array as Float32Array)[index + 1] = color.g;
        (colorAttribute.array as Float32Array)[index + 2] = color.b;
      });
      colorAttribute.needsUpdate = true;
    }

    // Imposta il range di disegno per evitare di disegnare vertici vuoti
    geometry.setDrawRange(0, batch.points.length);
  }

  private recreateGeometry(mesh: THREE.Line, batch: BatchedPath): void {
    // Disponi della vecchia geometria
    mesh.geometry.dispose();

    // Crea una nuova geometria con la dimensione corretta
    const newGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(batch.points.length * 3);

    batch.points.forEach((point, i) => {
      positions[i * 3] = point.x;
      positions[i * 3 + 1] = point.y;
      positions[i * 3 + 2] = point.z;
    });

    newGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(positions, 3)
    );

    // Aggiungi attributi colore se necessario
    if (batch.isExtrusion && batch.colors.length > 0) {
      const colors = new Float32Array(batch.colors.length * 3);
      batch.colors.forEach((color, i) => {
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
      });
      newGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }

    mesh.geometry = newGeometry;
  }

  private getExtrusionColor(extrusionAmount: number): THREE.Color {
    // Use selected filament color with intensity variation
    const baseColor = new THREE.Color(this._filamentColor());
    const intensity = Math.min(extrusionAmount * 10, 1.0);

    // Vary brightness based on extrusion amount
    const factor = 0.7 + intensity * 0.3;
    return baseColor.multiplyScalar(factor);
  }

  /**
   * Update filament color
   */
  setFilamentColor(color: string): void {
    this._filamentColor.set(color);
  }

  private updateFilamentColor(color: string): void {
    // Update existing extrusion materials with new color
    if (
      this.extrusionMesh &&
      this.extrusionMesh.material instanceof THREE.LineBasicMaterial
    ) {
      // If not using vertex colors, update material color
      if (!this.extrusionMesh.material.vertexColors) {
        this.extrusionMesh.material.color.setStyle(color);
        this.extrusionMesh.material.needsUpdate = true;
      }
    }

    // Update batched colors
    this.batchedExtrusionPath.colors.forEach((existingColor, index) => {
      const newColor = new THREE.Color(color);
      const intensity = 0.7 + (index % 10) * 0.03; // Some variation
      existingColor.copy(newColor.multiplyScalar(intensity));
    });

    // Mark for update
    this.meshUpdateCounter = this.pathBatchSize; // Force immediate update
  }

  // Utility methods
  getScene(): THREE.Scene {
    return this.scene;
  }

  getCurrentCommand(): GCodeCommand | null {
    const commands = this._commands();
    const index = this._currentCommandIndex();
    return commands[index] || null;
  }

  setAnimationSpeed(speed: number): void {
    const newSpeed = Math.max(0.1, Math.min(10000, speed)); // Increased limit to 10000
    this._animationSpeed.set(newSpeed);
  }

  // Simplified command execution methods
  private executeCommand(command: GCodeCommand): PathSegment | null {
    const startPos = { ...this._printerPosition() };
    const startE = this._extruderPosition();

    switch (command.command) {
      case 'G0':
      case 'G1':
        return this.executeLinearMove(command, startPos, startE);
      case 'G2':
        return this.executeArcMove(command, startPos, startE, true);
      case 'G3':
        return this.executeArcMove(command, startPos, startE, false);
      case 'G90':
        this._absolutePositioning.set(true);
        break;
      case 'G91':
        this._absolutePositioning.set(false);
        break;
      case 'M82':
        this._absoluteExtrusion.set(true);
        break;
      case 'M83':
        this._absoluteExtrusion.set(false);
        break;
    }
    return null;
  }

  /**
   * Execute command silently (used during jump reconstruction)
   */
  private executeCommandSilent(command: GCodeCommand): PathSegment | null {
    return this.executeCommand(command);
  }

  private executeLinearMove(
    command: GCodeCommand,
    startPos: PrinterPosition,
    startE: number
  ): PathSegment | null {
    const newPos = this.calculateNewPosition(command, startPos);
    const extrusionDiff = this.calculateExtrusionDiff(command, startE);

    this._printerPosition.set(newPos);
    if (command.f !== undefined) {
      this._feedRate.set(command.f);
    }

    const isExtrusion = extrusionDiff > 0.001;
    this._isExtruding.set(isExtrusion);

    if (this.hasMovement(startPos, newPos)) {
      // NUOVO: Applica offset di centraggio alle coordinate
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

  private executeArcMove(
    command: GCodeCommand,
    startPos: PrinterPosition,
    startE: number,
    clockwise: boolean
  ): PathSegment | null {
    // Simplified arc implementation for performance
    return this.executeLinearMove(command, startPos, startE);
  }

  private calculateNewPosition(
    command: GCodeCommand,
    startPos: PrinterPosition
  ): PrinterPosition {
    const absolute = this._absolutePositioning();
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

  private calculateExtrusionDiff(
    command: GCodeCommand,
    startE: number
  ): number {
    if (command.e === undefined) return 0;
    const absolute = this._absoluteExtrusion();
    const newE = absolute ? command.e : startE + command.e;
    this._extruderPosition.set(newE);
    return newE - startE;
  }

  private hasMovement(start: PrinterPosition, end: PrinterPosition): boolean {
    const threshold = 0.001;
    return (
      Math.abs(end.x - start.x) > threshold ||
      Math.abs(end.y - start.y) > threshold ||
      Math.abs(end.z - start.z) > threshold
    );
  }

  dispose(): void {
    this.stop();
    if (this.fileReader) {
      this.fileReader.cancel();
    }

    // Cleanup Three.js resources
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        if (Array.isArray(object.material)) {
          object.material.forEach((material) => material.dispose());
        } else {
          object.material.dispose();
        }
      }
    });
  }

  /**
   * Jump to specific command - handles streaming buffer properly
   */
  jumpToCommand(index: number): Promise<void> {
    const totalCommands = this.totalCommands();
    const currentBufferSize = this._commands().length;

    if (index < 0) {
      console.warn('Invalid command index: negative value');
      return Promise.resolve();
    }

    // If target is beyond current buffer, wait for streaming to load more
    if (
      index >= currentBufferSize &&
      this.streamingBuffer.processedLines > currentBufferSize
    ) {
      return this.jumpToFutureCommand(index);
    }

    // Normal jump within buffer
    return this.executeJump(index);
  }

  /**
   * Handle jump to command that's beyond current buffer
   */
  private async jumpToFutureCommand(targetIndex: number): Promise<void> {
    this._isJumping.set(true);
    this._jumpTarget.set(targetIndex);
    this._jumpProgress.set(0);

    console.log(
      `🎯 Jumping to command ${targetIndex}, waiting for buffer to load...`
    );

    // Wait for buffer to load up to target command
    return new Promise((resolve) => {
      const checkBuffer = () => {
        const currentBufferSize = this._commands().length;
        const totalProcessed = this.streamingBuffer.processedLines;

        // Calculate progress
        const progress = Math.min(
          (currentBufferSize / (targetIndex + 1)) * 100,
          100
        );
        this._jumpProgress.set(progress);

        // Check if we have enough commands loaded or streaming is complete
        if (
          currentBufferSize > targetIndex ||
          totalProcessed <= currentBufferSize
        ) {
          // Buffer has reached target or streaming is complete
          this._isJumping.set(false);
          this._jumpTarget.set(-1);
          this._jumpProgress.set(100);

          // Execute the actual jump
          this.executeJump(targetIndex).then(() => {
            console.log(`✅ Successfully jumped to command ${targetIndex}`);
            resolve();
          });
        } else {
          // Keep waiting
          setTimeout(checkBuffer, 100); // Check every 100ms
        }
      };

      checkBuffer();
    });
  }

  /**
   * Execute the actual jump to command
   */
  private async executeJump(index: number): Promise<void> {
    const totalCommands = this._commands().length;
    const actualTarget = Math.min(index, totalCommands - 1);

    if (actualTarget < 0) {
      console.warn('No commands available for jump');
      return;
    }

    const wasRunning = this._simulationState() === SimulationState.RUNNING;
    this.stop();

    // Reset state and re-execute commands up to target index
    this._printerPosition.set({ x: 0, y: 0, z: 0 });
    this._extruderPosition.set(0);
    this._feedRate.set(1500);
    this._temperature.set(0);
    this._bedTemperature.set(0);
    this._fanSpeed.set(0);
    this._absolutePositioning.set(true);
    this._absoluteExtrusion.set(true);
    this._isExtruding.set(false);

    this.clearAllPaths();
    const segments: PathSegment[] = [];

    console.log(`🎯 Executing jump to command ${actualTarget}...`);

    // Re-execute commands up to target index in batches to prevent UI blocking
    const batchSize = 1000; // Process 1000 commands at a time
    for (
      let batchStart = 0;
      batchStart <= actualTarget;
      batchStart += batchSize
    ) {
      const batchEnd = Math.min(batchStart + batchSize - 1, actualTarget);

      // Process batch
      for (let i = batchStart; i <= batchEnd; i++) {
        const command = this._commands()[i];
        if (command) {
          const segment = this.executeCommandSilent(command);
          if (segment) {
            segments.push(segment);
            this.visualizePath(segment);
          }
        }
      }

      // Allow UI to update between batches
      if (batchEnd < actualTarget) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    this._pathSegments.set(segments);
    this._currentCommandIndex.set(actualTarget);

    // Force mesh update after jump
    this.updateBatchedMeshes();

    if (wasRunning && actualTarget < totalCommands - 1) {
      this.start();
    }

    console.log(`✅ Jump to command ${actualTarget} completed.`);
  }

  /**
   * Visualize path segment (used during jump reconstruction)
   */
  private visualizePath(segment: PathSegment): void {
    // Add to appropriate batch for visualization
    const targetBatch = segment.isExtrusion
      ? this.batchedExtrusionPath
      : this.batchedTravelPath;

    if (segment.segments && segment.segments.length > 1) {
      // Add curve segments
      for (let i = 0; i < segment.segments.length - 1; i++) {
        targetBatch.points.push(segment.segments[i], segment.segments[i + 1]);
        if (segment.isExtrusion) {
          const color = this.getExtrusionColor(segment.extrusionAmount);
          targetBatch.colors.push(color, color);
        }
      }
    } else {
      // Add simple line segment
      targetBatch.points.push(segment.startPoint, segment.endPoint);
      if (segment.isExtrusion) {
        const color = this.getExtrusionColor(segment.extrusionAmount);
        targetBatch.colors.push(color, color);
      }
    }
  }

  // Legacy method for backward compatibility
  stepBack(steps: number = 1): void {
    const currentIndex = this._currentCommandIndex();
    const newIndex = Math.max(0, currentIndex - steps);
    this.jumpToCommand(newIndex);
  }

  stepForward(steps: number = 1): void {
    const currentIndex = this._currentCommandIndex();
    const totalCommands = Math.max(
      this._commands().length,
      this.streamingBuffer.processedLines
    );
    const newIndex = Math.min(totalCommands - 1, currentIndex + steps);
    this.jumpToCommand(newIndex);
  }

  // Backward compatibility methods
  loadCommands(gcodeLines?: string[]): void {
    if (gcodeLines && gcodeLines.length > 0) {
      const commands = gcodeLines
        .map((line, index) => this.parseLineOptimized(line.trim(), index + 1))
        .filter(Boolean) as GCodeCommand[];

      this._commands.set(commands);

      // NUOVO: Calcola bounds e centraggio
      this.calculateModelBounds(commands);
      this.calculateCenteringOffset();

      this._simulationState.set(SimulationState.IDLE);

      // Configura i limiti per il file appena caricato
      this.configureDynamicLimits();
    }
  }

  setBezierControlsVisible(visible: boolean): void {
    this.showBezierControlPoints = visible;
  }

  setMaxPathPoints(maxPoints: number): void {
    this.maxPathPoints = Math.max(1000, Math.min(100000, maxPoints));
  }

  setBatchSize(batchSize: number): void {
    this.pathBatchSize = Math.max(10, Math.min(1000, batchSize));
  }

  setCurveResolution(resolution: number): void {
    this.curveResolution = Math.max(5, Math.min(100, resolution));
  }

  /**
   * Metodo per ottenere informazioni sull'uso della memoria
   */
  getMemoryUsage(): { extrusionMB: number; travelMB: number; totalMB: number } {
    const extrusionPoints = this.batchedExtrusionPath.points.length;
    const travelPoints = this.batchedTravelPath.points.length;

    const extrusionMB =
      (extrusionPoints * 12 + this.batchedExtrusionPath.colors.length * 12) /
      (1024 * 1024);
    const travelMB = (travelPoints * 12) / (1024 * 1024);

    return {
      extrusionMB: Number(extrusionMB.toFixed(2)),
      travelMB: Number(travelMB.toFixed(2)),
      totalMB: Number((extrusionMB + travelMB).toFixed(2)),
    };
  }

  /**
   * Diagnostica completa dell'uso memoria
   */
  getDetailedMemoryUsage(): any {
    const extrusionPoints = this.batchedExtrusionPath.points.length;
    const extrusionColors = this.batchedExtrusionPath.colors.length;
    const travelPoints = this.batchedTravelPath.points.length;

    const extrusionPointsMB = (extrusionPoints * 12) / (1024 * 1024);
    const extrusionColorsMB = (extrusionColors * 12) / (1024 * 1024);
    const travelPointsMB = (travelPoints * 12) / (1024 * 1024);

    const totalMB = extrusionPointsMB + extrusionColorsMB + travelPointsMB;

    return {
      extrusion: {
        points: extrusionPoints,
        colors: extrusionColors,
        memoryMB: Number((extrusionPointsMB + extrusionColorsMB).toFixed(2)),
      },
      travel: {
        points: travelPoints,
        memoryMB: Number(travelPointsMB.toFixed(2)),
      },
      total: {
        points: extrusionPoints + travelPoints,
        memoryMB: Number(totalMB.toFixed(2)),
      },
      limits: {
        maxPathPoints: this.maxPathPoints,
        batchSize: this.pathBatchSize,
      },
      commands: {
        loaded: this._commands().length,
        processed: this.streamingBuffer.processedLines,
        current: this._currentCommandIndex(),
      },
    };
  }
}
