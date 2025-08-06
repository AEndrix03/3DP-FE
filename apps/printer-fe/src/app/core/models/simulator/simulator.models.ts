// src/app/printer-simulator/models/simulator.models.ts

export enum SimulationState {
  IDLE = 'idle',
  LOADING = 'loading',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  ERROR = 'error',
}

export interface Vector3D {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface GCodeCommand {
  readonly command: string;
  readonly parameters: ReadonlyMap<string, number>;
  readonly rawLine: string;
  readonly lineNumber: number;
  readonly timestamp?: number;
  readonly estimatedDuration?: number;
}

export interface PrinterState {
  readonly position: Vector3D;
  readonly extruderPosition: number;
  readonly feedRate: number;
  readonly temperature: number;
  readonly bedTemperature: number;
  readonly fanSpeed: number;
  readonly absolutePositioning: boolean;
  readonly absoluteExtrusion: boolean;
  readonly currentLayer: number;
  readonly totalLayers: number;
  readonly printProgress: number;
  readonly isExtruding: boolean;
  readonly currentCommandIndex: number;
  readonly totalCommands: number;
  readonly executionTime: number;
  readonly estimatedTimeRemaining: number;
}

export interface CommandExecutionInfo {
  readonly index: number;
  readonly command: GCodeCommand;
  readonly executionTime: number;
  readonly cumulativeTime: number;
  readonly timestamp: Date;
  readonly success: boolean;
  readonly error?: string;
}

export interface PerformanceMetrics {
  readonly fps: number;
  readonly pathObjects: number;
  readonly memoryUsage: number;
  readonly renderTime: number;
  readonly commandProcessingRate: number;
  readonly bufferUtilization: number;
  readonly gcCount?: number;
}

export interface StreamingConfig {
  readonly chunkSize: number;
  readonly maxBufferSize: number;
  readonly processingRate: number;
  readonly adaptiveChunking: boolean;
  readonly memoryThreshold: number;
  readonly backpressureThreshold: number;
}

export interface ViewportSettings {
  readonly animationSpeed: number;
  readonly filamentColor: string;
  readonly layerHeight: number;
  readonly nozzleDiameter: number;
  readonly buildVolume: Vector3D;
  readonly showTravelMoves: boolean;
  readonly showBuildPlate: boolean;
  readonly showBezierControls: boolean;
  readonly maxPathPoints: number;
  readonly curveResolution: number;
  readonly enableShadows: boolean;
  readonly antialiasing: boolean;
}

export interface CameraSettings {
  readonly position: Vector3D;
  readonly target: Vector3D;
  readonly fov: number;
  readonly near: number;
  readonly far: number;
}

export interface SimulatorEvent {
  readonly type: SimulatorEventType;
  readonly data: unknown;
  readonly timestamp: Date;
  readonly severity: 'info' | 'warning' | 'error';
}

export type SimulatorEventType =
  | 'stateChange'
  | 'layerChange'
  | 'commandChange'
  | 'error'
  | 'complete'
  | 'performanceWarning'
  | 'memoryWarning';

export interface CommandChunk {
  readonly commands: ReadonlyArray<GCodeCommand>;
  readonly chunkIndex: number;
  readonly totalChunks: number;
  readonly metadata: ChunkMetadata;
}

export interface ChunkMetadata {
  readonly layerStart?: number;
  readonly layerEnd?: number;
  readonly estimatedTime?: number;
  readonly byteOffset?: number;
  readonly byteLength?: number;
}

export interface PathSegment {
  readonly startPoint: Vector3D;
  readonly endPoint: Vector3D;
  readonly extrusionAmount: number;
  readonly isExtrusion: boolean;
  readonly isTravel: boolean;
  readonly isArc: boolean;
  readonly isBezier?: boolean;
  readonly isNurbs?: boolean;
  readonly arcCenter?: Vector3D;
  readonly arcRadius?: number;
  readonly segments?: ReadonlyArray<Vector3D>;
  readonly controlPoints?: ReadonlyArray<Vector3D>;
}

// UI Component Interfaces
export interface ControlAction {
  readonly type: ControlActionType;
  readonly payload?: unknown;
}

export type ControlActionType =
  | 'start'
  | 'pause'
  | 'stop'
  | 'reset'
  | 'stepBack'
  | 'stepForward'
  | 'jumpTo';

export interface SettingsUpdate {
  readonly setting: keyof ViewportSettings;
  readonly value: unknown;
}

// Error handling
export interface SimulatorError {
  readonly type: SimulatorErrorType;
  readonly message: string;
  readonly details?: Record<string, unknown>;
  readonly timestamp: Date;
  readonly commandIndex?: number;
  readonly recoverable: boolean;
}

export type SimulatorErrorType =
  | 'parsing'
  | 'execution'
  | 'rendering'
  | 'performance'
  | 'system'
  | 'memory'
  | 'network';

// File handling
export interface FileLoadOptions {
  readonly skipComments?: boolean;
  readonly validateCommands?: boolean;
  readonly preprocessCommands?: boolean;
  readonly estimateTime?: boolean;
  readonly chunkSize?: number;
}

export interface FileLoadResult {
  readonly commands: ReadonlyArray<GCodeCommand>;
  readonly metadata: FileMetadata;
  readonly warnings: ReadonlyArray<string>;
  readonly errors: ReadonlyArray<SimulatorError>;
}

export interface FileMetadata {
  readonly totalLines: number;
  readonly validCommands: number;
  readonly estimatedTime?: number;
  readonly layerCount?: number;
  readonly filamentLength?: number;
  readonly fileSize: number;
  readonly processingTime: number;
}

// Performance monitoring
export interface PerformanceProfile {
  readonly loadTime: number;
  readonly renderingStats: RenderingStats;
  readonly memoryStats: MemoryStats;
  readonly commandStats: CommandStats;
}

export interface RenderingStats {
  readonly averageFPS: number;
  readonly minFPS: number;
  readonly maxFPS: number;
  readonly frameDrops: number;
  readonly renderTime: number;
}

export interface MemoryStats {
  readonly peakUsage: number;
  readonly averageUsage: number;
  readonly gcCount: number;
  readonly bufferSize: number;
}

export interface CommandStats {
  readonly totalProcessed: number;
  readonly processingRate: number;
  readonly errors: number;
  readonly averageExecutionTime: number;
}

// Quality profiles
export interface QualityProfile {
  readonly name: string;
  readonly description: string;
  readonly settings: QualitySettings;
  readonly recommended: SystemRequirements;
}

export interface QualitySettings {
  readonly curveResolution: number;
  readonly maxPathPoints: number;
  readonly batchSize: number;
  readonly frameRate: number;
  readonly antialiasing: boolean;
  readonly shadows: boolean;
}

export interface SystemRequirements {
  readonly minRAM: number; // MB
  readonly minVRAM: number; // MB
  readonly cpuCores: number;
}

// Built-in quality profiles
export const QUALITY_PROFILES: ReadonlyArray<QualityProfile> = [
  {
    name: 'Low Quality',
    description: 'Best performance, basic visuals',
    settings: {
      curveResolution: 8,
      maxPathPoints: 10000,
      batchSize: 200,
      frameRate: 30,
      antialiasing: false,
      shadows: false,
    },
    recommended: {
      minRAM: 2048,
      minVRAM: 512,
      cpuCores: 2,
    },
  },
  {
    name: 'Medium Quality',
    description: 'Balanced performance and quality',
    settings: {
      curveResolution: 16,
      maxPathPoints: 25000,
      batchSize: 150,
      frameRate: 45,
      antialiasing: true,
      shadows: false,
    },
    recommended: {
      minRAM: 4096,
      minVRAM: 1024,
      cpuCores: 4,
    },
  },
  {
    name: 'High Quality',
    description: 'Best visuals, higher requirements',
    settings: {
      curveResolution: 32,
      maxPathPoints: 50000,
      batchSize: 100,
      frameRate: 60,
      antialiasing: true,
      shadows: true,
    },
    recommended: {
      minRAM: 8192,
      minVRAM: 2048,
      cpuCores: 8,
    },
  },
] as const;

// Utility types
export type CommandType =
  | 'movement'
  | 'extrusion'
  | 'temperature'
  | 'fan'
  | 'positioning'
  | 'other';

export type MovementType = 'linear' | 'arc' | 'bezier' | 'nurbs';
export type ExtrusionType = 'normal' | 'retraction' | 'travel';

// Type guards with improved performance
export const isMovementCommand = (command: GCodeCommand): boolean => {
  const movementCommands = new Set(['G0', 'G1', 'G2', 'G3', 'G5', 'G6']);
  return movementCommands.has(command.command);
};

export const isExtrusionCommand = (command: GCodeCommand): boolean => {
  return command.parameters.has('E');
};

export const isTemperatureCommand = (command: GCodeCommand): boolean => {
  const tempCommands = new Set(['M104', 'M109', 'M140', 'M190']);
  return tempCommands.has(command.command);
};

export const isFanCommand = (command: GCodeCommand): boolean => {
  const fanCommands = new Set(['M106', 'M107']);
  return fanCommands.has(command.command);
};

// Helper functions with improved error handling
export const getCommandType = (command: GCodeCommand): CommandType => {
  if (isMovementCommand(command)) return 'movement';
  if (isTemperatureCommand(command)) return 'temperature';
  if (isFanCommand(command)) return 'fan';

  const positioningCommands = new Set(['G90', 'G91', 'G92']);
  if (positioningCommands.has(command.command)) return 'positioning';

  return 'other';
};

export const getMovementType = (command: GCodeCommand): MovementType | null => {
  const movementMap: Record<string, MovementType> = {
    G0: 'linear',
    G1: 'linear',
    G2: 'arc',
    G3: 'arc',
    G5: 'bezier',
    'G5.1': 'bezier',
    G6: 'nurbs',
  };

  return movementMap[command.command] || null;
};

export const calculateDistance = (start: Vector3D, end: Vector3D): number => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dz = end.z - start.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'] as const;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = bytes / Math.pow(k, i);

  return `${size.toFixed(i === 0 ? 0 : 2)} ${sizes[i]}`;
};

export const formatDuration = (seconds: number): string => {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
};

// Immutable factory functions
export const createVector3D = (x: number, y: number, z: number): Vector3D => ({
  x,
  y,
  z,
});

export const createGCodeCommand = (
  command: string,
  parameters: Record<string, number>,
  rawLine: string,
  lineNumber: number,
  timestamp?: number
): GCodeCommand => ({
  command,
  parameters: new Map(Object.entries(parameters)),
  rawLine,
  lineNumber,
  timestamp,
});

// Constants with readonly enforcement
export const DEFAULT_VIEWPORT_SETTINGS: ViewportSettings = {
  animationSpeed: 1.0,
  filamentColor: '#FF4444',
  layerHeight: 0.2,
  nozzleDiameter: 0.4,
  buildVolume: createVector3D(200, 200, 200),
  showTravelMoves: false,
  showBuildPlate: true,
  showBezierControls: false,
  maxPathPoints: 50000,
  curveResolution: 20,
  enableShadows: true,
  antialiasing: true,
} as const;

export const DEFAULT_STREAMING_CONFIG: StreamingConfig = {
  chunkSize: 1000,
  maxBufferSize: 5000,
  processingRate: 60,
  adaptiveChunking: true,
  memoryThreshold: 512 * 1024 * 1024, // 512MB
  backpressureThreshold: 0.8, // 80%
} as const;

export const DEFAULT_PRINTER_CONFIG = {
  name: 'Generic 3D Printer',
  buildVolume: createVector3D(200, 200, 200),
  nozzleDiameter: 0.4,
  filamentDiameter: 1.75,
  maxFeedRate: 3000,
  maxAcceleration: 1000,
  homePosition: createVector3D(0, 0, 0),
  endstops: {
    xMin: true,
    xMax: false,
    yMin: true,
    yMax: false,
    zMin: true,
    zMax: false,
  } as const,
} as const;

// Performance thresholds
export const PERFORMANCE_THRESHOLDS = {
  FPS: {
    GOOD: 45,
    ACCEPTABLE: 30,
    POOR: 20,
  },
  RENDER_TIME: {
    GOOD: 16.67, // 60fps
    ACCEPTABLE: 33.33, // 30fps
    POOR: 50, // 20fps
  },
  MEMORY: {
    WARNING: 512 * 1024 * 1024, // 512MB
    CRITICAL: 1024 * 1024 * 1024, // 1GB
  },
  COMMANDS_PER_SECOND: {
    SLOW: 10,
    NORMAL: 60,
    FAST: 200,
  },
} as const;

// Validation helpers
export const validateVector3D = (vector: unknown): vector is Vector3D => {
  return (
    typeof vector === 'object' &&
    vector !== null &&
    typeof (vector as Vector3D).x === 'number' &&
    typeof (vector as Vector3D).y === 'number' &&
    typeof (vector as Vector3D).z === 'number'
  );
};

export const validateGCodeCommand = (
  command: unknown
): command is GCodeCommand => {
  return (
    typeof command === 'object' &&
    command !== null &&
    typeof (command as GCodeCommand).command === 'string' &&
    (command as GCodeCommand).parameters instanceof Map &&
    typeof (command as GCodeCommand).rawLine === 'string' &&
    typeof (command as GCodeCommand).lineNumber === 'number'
  );
};

// Error creation helpers
export const createSimulatorError = (
  type: SimulatorErrorType,
  message: string,
  details?: Record<string, unknown>,
  recoverable = true
): SimulatorError => ({
  type,
  message,
  details,
  timestamp: new Date(),
  recoverable,
});

// Memory management utilities
export const estimateCommandMemoryUsage = (command: GCodeCommand): number => {
  // Rough estimation in bytes
  const baseSize = 100; // Base object overhead
  const stringSize = command.rawLine.length * 2; // Unicode strings
  const parametersSize = command.parameters.size * 16; // Key-value pairs

  return baseSize + stringSize + parametersSize;
};

export const estimateChunkMemoryUsage = (chunk: CommandChunk): number => {
  return chunk.commands.reduce(
    (total, command) => total + estimateCommandMemoryUsage(command),
    200 // Chunk overhead
  );
};
