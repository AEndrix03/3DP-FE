import * as THREE from 'three';

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

export interface BatchedPath {
  points: THREE.Vector3[];
  colors: THREE.Color[];
  isExtrusion: boolean;
}

export interface StreamingBuffer {
  commands: GCodeCommand[];
  maxSize: number;
  currentIndex: number;
  processedLines: number;
}

export enum SimulationState {
  IDLE = 'idle',
  LOADING = 'loading',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  ERROR = 'error',
}
