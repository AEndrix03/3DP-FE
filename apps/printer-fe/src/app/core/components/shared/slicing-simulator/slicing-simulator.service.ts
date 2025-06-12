import { Injectable, signal, computed, effect } from '@angular/core';
import * as THREE from 'three';

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
  arcCenter?: THREE.Vector3;
  arcRadius?: number;
  segments?: THREE.Vector3[];
}

export enum SimulationState {
  IDLE = 'idle',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  ERROR = 'error',
}

@Injectable({
  providedIn: 'root',
})
export class GCodeSimulatorService {
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

  // Path tracking
  private readonly _pathSegments = signal<PathSegment[]>([]);
  private readonly _currentPath = signal<PathSegment | null>(null);

  // Three.js objects
  private scene: THREE.Scene;
  private extrudedPaths: THREE.Group;
  private travelPaths: THREE.Group;
  private nozzlePosition: THREE.Group;
  private buildPlate: THREE.Mesh;
  private animationId: number | null = null;
  private startTime = 0;
  private lastUpdateTime = 0;
  private commandStartTime = 0;

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

  // Computed state
  readonly totalCommands = computed(() => this._commands().length);
  readonly printProgress = computed(() => {
    const total = this.totalCommands();
    const current = this._currentCommandIndex();
    return total > 0 ? (current / total) * 100 : 0;
  });

  readonly currentLayer = computed(() => {
    const pos = this._printerPosition();
    return Math.max(1, Math.floor(pos.z / 0.2) + 1); // Assuming 0.2mm layer height
  });

  readonly totalLayers = computed(() => {
    const commands = this._commands();
    const uniqueZ = new Set<number>();
    commands.forEach((cmd) => {
      if (cmd.z !== undefined) {
        uniqueZ.add(Math.round(cmd.z * 100) / 100);
      }
    });
    return Math.max(1, uniqueZ.size);
  });

  readonly estimatedTimeRemaining = computed(() => {
    const total = this.totalCommands();
    const current = this._currentCommandIndex();
    const elapsed = this._executionTime();

    if (current === 0 || elapsed === 0) return 0;

    const avgTimePerCommand = elapsed / current;
    const remaining = total - current;
    return remaining * avgTimePerCommand;
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
    currentLayer: this.currentLayer(),
    totalLayers: this.totalLayers(),
    printProgress: this.printProgress(),
    isExtruding: this._isExtruding(),
    currentCommandIndex: this._currentCommandIndex(),
    totalCommands: this.totalCommands(),
    executionTime: this._executionTime(),
    estimatedTimeRemaining: this.estimatedTimeRemaining(),
  }));

  // G-code patterns for parsing
  private readonly GCODE_PATTERNS = {
    command: /^([GM]\d+)/,
    x: /X([-+]?\d*\.?\d+)/,
    y: /Y([-+]?\d*\.?\d+)/,
    z: /Z([-+]?\d*\.?\d+)/,
    e: /E([-+]?\d*\.?\d+)/,
    f: /F(\d*\.?\d+)/,
    i: /I([-+]?\d*\.?\d+)/,
    j: /J([-+]?\d*\.?\d+)/,
    k: /K([-+]?\d*\.?\d+)/,
    r: /R([-+]?\d*\.?\d+)/,
    p: /P(\d*\.?\d+)/,
    s: /S(\d*\.?\d+)/,
    t: /T(\d+)/,
  };

  constructor() {
    this.initializeScene();
    this.setupEffects();
  }

  private initializeScene(): void {
    this.scene = new THREE.Scene();
    this.extrudedPaths = new THREE.Group();
    this.travelPaths = new THREE.Group();

    this.scene.add(this.extrudedPaths);
    this.scene.add(this.travelPaths);

    // Create enhanced nozzle indicator
    this.createNozzle();

    // Create build plate
    this.createBuildPlate();

    // Add coordinate system helper
    const axesHelper = new THREE.AxesHelper(30);
    axesHelper.position.set(0, 0.1, 0);
    this.scene.add(axesHelper);

    // Add grid helper
    const gridHelper = new THREE.GridHelper(300, 30, 0x444444, 0x222222);
    gridHelper.rotateX(Math.PI / 2);
    this.scene.add(gridHelper);
  }

  private createNozzle(): void {
    // Create a more detailed nozzle assembly
    const nozzleGroup = new THREE.Group();

    // Nozzle tip (cone)
    const nozzleTipGeometry = new THREE.ConeGeometry(0.8, 3, 8);
    const nozzleTipMaterial = new THREE.MeshLambertMaterial({
      color: 0x666666,
      transparent: true,
      opacity: 0.9,
    });
    const nozzleTip = new THREE.Mesh(nozzleTipGeometry, nozzleTipMaterial);
    nozzleTip.position.y = 1.5;
    nozzleGroup.add(nozzleTip);

    // Heater block (cylinder)
    const heaterGeometry = new THREE.CylinderGeometry(2, 2, 4, 8);
    const heaterMaterial = new THREE.MeshLambertMaterial({
      color: 0x444444,
      transparent: true,
      opacity: 0.8,
    });
    const heater = new THREE.Mesh(heaterGeometry, heaterMaterial);
    heater.position.y = 5;
    nozzleGroup.add(heater);

    // Cooling fan (torus)
    const fanGeometry = new THREE.TorusGeometry(3, 0.5, 8, 16);
    const fanMaterial = new THREE.MeshLambertMaterial({
      color: 0x333333,
      transparent: true,
      opacity: 0.7,
    });
    const fan = new THREE.Mesh(fanGeometry, fanMaterial);
    fan.position.y = 8;
    fan.rotation.x = Math.PI / 2;
    nozzleGroup.add(fan);

    // Add glow effect when extruding
    const glowGeometry = new THREE.SphereGeometry(1.2, 16, 16);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xff4444,
      transparent: true,
      opacity: 0,
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.position.y = 0.5;
    nozzleGroup.add(glow);

    this.nozzlePosition = nozzleGroup;
    this.scene.add(this.nozzlePosition);
  }

  private createBuildPlate(): void {
    // Create build plate with texture
    const plateGeometry = new THREE.PlaneGeometry(200, 200);
    const plateMaterial = new THREE.MeshLambertMaterial({
      color: 0x888888,
      transparent: true,
      opacity: 0.8,
    });

    this.buildPlate = new THREE.Mesh(plateGeometry, plateMaterial);
    this.buildPlate.rotation.x = -Math.PI / 2;
    this.buildPlate.position.y = -0.1;
    this.buildPlate.receiveShadow = true;

    // Add build plate border
    const borderGeometry = new THREE.EdgesGeometry(plateGeometry);
    const borderMaterial = new THREE.LineBasicMaterial({
      color: 0x444444,
      linewidth: 2,
    });
    const border = new THREE.LineSegments(borderGeometry, borderMaterial);
    border.rotation.x = -Math.PI / 2;
    border.position.y = 0;

    this.scene.add(this.buildPlate);
    this.scene.add(border);
  }

  private setupEffects(): void {
    // Update nozzle position and glow effect
    effect(() => {
      const pos = this._printerPosition();
      const isExtruding = this._isExtruding();

      this.nozzlePosition.position.set(pos.x, pos.z + 8, pos.y);

      // Update glow effect based on extrusion
      const glowMesh = this.nozzlePosition.children.find(
        (child) =>
          child instanceof THREE.Mesh &&
          (child.material as THREE.MeshBasicMaterial).color.getHex() ===
            0xff4444
      ) as THREE.Mesh;

      if (glowMesh && glowMesh.material instanceof THREE.MeshBasicMaterial) {
        glowMesh.material.opacity = isExtruding ? 0.6 : 0;
        glowMesh.scale.setScalar(
          isExtruding ? 1 + Math.sin(Date.now() * 0.01) * 0.2 : 1
        );
      }
    });

    // Clear error after 5 seconds
    effect(() => {
      const error = this._errorMessage();
      if (error) {
        setTimeout(() => {
          if (this._errorMessage() === error) {
            this._errorMessage.set('');
          }
        }, 5000);
      }
    });
  }

  /**
   * Set animation speed (0.1 to 100)
   */
  setAnimationSpeed(speed: number): void {
    this._animationSpeed.set(Math.max(0.1, Math.min(100, speed)));
  }

  /**
   * Load G-code commands from array of strings
   */
  loadCommands(gcodeLines: string[]): void {
    try {
      const commands: GCodeCommand[] = [];

      gcodeLines.forEach((line, index) => {
        const command = this.parseLine(line.trim(), index + 1);
        if (command) {
          commands.push(command);
        }
      });

      this._commands.set(commands);
      this.reset();
      this._errorMessage.set('');
    } catch (error) {
      this._errorMessage.set(`Failed to load commands: ${error}`);
    }
  }

  /**
   * Parse single G-code line
   */
  private parseLine(line: string, lineNumber: number): GCodeCommand | null {
    const cleanLine = line.split(';')[0].trim().toUpperCase();
    if (!cleanLine) return null;

    const commandMatch = this.GCODE_PATTERNS.command.exec(cleanLine);
    if (!commandMatch) return null;

    const command: GCodeCommand = {
      command: commandMatch[1],
      lineNumber,
      rawLine: line,
    };

    // Parse all parameters
    Object.entries(this.GCODE_PATTERNS).forEach(([key, pattern]) => {
      if (key === 'command') return;

      const match = pattern.exec(cleanLine);
      if (match) {
        const value = match[1];
        (command as any)[key] =
          key === 't' ? parseInt(value) : parseFloat(value);
      }
    });

    return command;
  }

  /**
   * Start simulation
   */
  start(): void {
    if (this._commands().length === 0) {
      this._errorMessage.set('No commands loaded');
      return;
    }

    if (this._simulationState() === SimulationState.COMPLETED) {
      this.reset();
    }

    this._simulationState.set(SimulationState.RUNNING);
    this.startTime = performance.now();
    this.lastUpdateTime = this.startTime;
    this.commandStartTime = this.startTime;
    this.animate();
  }

  /**
   * Pause/Resume simulation
   */
  pause(): void {
    const currentState = this._simulationState();
    if (currentState === SimulationState.RUNNING) {
      this._simulationState.set(SimulationState.PAUSED);
      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
        this.animationId = null;
      }
    } else if (currentState === SimulationState.PAUSED) {
      this._simulationState.set(SimulationState.RUNNING);
      this.lastUpdateTime = performance.now();
      this.animate();
    }
  }

  /**
   * Stop simulation
   */
  stop(): void {
    this._simulationState.set(SimulationState.IDLE);
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  /**
   * Reset simulation to beginning
   */
  reset(): void {
    this.stop();
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

    this.clearPaths();
    this._simulationState.set(SimulationState.IDLE);
  }

  /**
   * Step back n commands
   */
  stepBack(steps = 1): void {
    const currentIndex = this._currentCommandIndex();
    const newIndex = Math.max(0, currentIndex - steps);

    if (newIndex !== currentIndex) {
      this.jumpToCommand(newIndex);
    }
  }

  /**
   * Step forward n commands
   */
  stepForward(steps = 1): void {
    const currentIndex = this._currentCommandIndex();
    const totalCommands = this.totalCommands();
    const newIndex = Math.min(totalCommands - 1, currentIndex + steps);

    if (newIndex !== currentIndex) {
      this.jumpToCommand(newIndex);
    }
  }

  /**
   * Jump to specific command index
   */
  jumpToCommand(index: number): void {
    const totalCommands = this.totalCommands();
    if (index < 0 || index >= totalCommands) return;

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

    this.clearPaths();
    const segments: PathSegment[] = [];

    // Re-execute commands up to target index
    for (let i = 0; i <= index; i++) {
      const command = this._commands()[i];
      if (command) {
        const segment = this.executeCommandSilent(command);
        if (segment) {
          segments.push(segment);
          this.visualizePath(segment);
        }
      }
    }

    this._pathSegments.set(segments);
    this._currentCommandIndex.set(index);

    if (wasRunning && index < totalCommands - 1) {
      this.start();
    }
  }

  /**
   * Get current command
   */
  getCurrentCommand(): GCodeCommand | null {
    const commands = this._commands();
    const index = this._currentCommandIndex();
    return commands[index] || null;
  }

  /**
   * Get command at specific index
   */
  getCommand(index: number): GCodeCommand | null {
    const commands = this._commands();
    return commands[index] || null;
  }

  /**
   * Animation loop with speed control
   */
  private animate(): void {
    if (this._simulationState() !== SimulationState.RUNNING) return;

    this.animationId = requestAnimationFrame(() => this.animate());

    const now = performance.now();
    const deltaTime = (now - this.lastUpdateTime) * this._animationSpeed();
    this.lastUpdateTime = now;

    // Update execution time
    const newExecutionTime = this._executionTime() + deltaTime / 1000;
    this._executionTime.set(newExecutionTime);

    // Execute next command if ready (with speed control)
    const timeSinceLastCommand = now - this.commandStartTime;
    const commandInterval = Math.max(10, 100 / this._animationSpeed()); // Minimum 10ms, scaled by speed

    if (timeSinceLastCommand >= commandInterval) {
      const commands = this._commands();
      const currentIndex = this._currentCommandIndex();

      if (currentIndex < commands.length) {
        const command = commands[currentIndex];
        const segment = this.executeCommand(command);

        if (segment) {
          const currentSegments = this._pathSegments();
          this._pathSegments.set([...currentSegments, segment]);
          this._currentPath.set(segment);
          this.visualizePath(segment);
        }

        this._currentCommandIndex.set(currentIndex + 1);
        this.commandStartTime = now;
      } else {
        // Simulation completed
        this._simulationState.set(SimulationState.COMPLETED);
        this._currentPath.set(null);
      }
    }
  }

  /**
   * Execute command and return path segment
   */
  private executeCommand(command: GCodeCommand): PathSegment | null {
    return this.executeCommandSilent(command);
  }

  /**
   * Execute command without side effects (for jumping)
   */
  private executeCommandSilent(command: GCodeCommand): PathSegment | null {
    const startPos = { ...this._printerPosition() };
    const startE = this._extruderPosition();

    try {
      switch (command.command) {
        case 'G0': // Rapid move
        case 'G1': // Linear move
          return this.executeLinearMove(command, startPos, startE);
        case 'G2': // Clockwise arc
          return this.executeArcMove(command, startPos, startE, true);
        case 'G3': // Counter-clockwise arc
          return this.executeArcMove(command, startPos, startE, false);
        case 'G4': // Dwell
          this.executeDwell(command);
          break;
        case 'G28': // Home
          this.executeHome(command);
          break;
        case 'G90': // Absolute positioning
          this._absolutePositioning.set(true);
          break;
        case 'G91': // Relative positioning
          this._absolutePositioning.set(false);
          break;
        case 'G92': // Set position
          this.executeSetPosition(command);
          break;
        case 'M82': // Absolute extrusion
          this._absoluteExtrusion.set(true);
          break;
        case 'M83': // Relative extrusion
          this._absoluteExtrusion.set(false);
          break;
        case 'M104': // Set extruder temperature
          if (command.s !== undefined) {
            this._temperature.set(command.s);
          }
          break;
        case 'M140': // Set bed temperature
          if (command.s !== undefined) {
            this._bedTemperature.set(command.s);
          }
          break;
        case 'M106': // Fan on
          this._fanSpeed.set(command.s || 255);
          break;
        case 'M107': // Fan off
          this._fanSpeed.set(0);
          break;
        case 'M109': // Wait for extruder temperature
          if (command.s !== undefined) {
            this._temperature.set(command.s);
          }
          break;
        case 'M190': // Wait for bed temperature
          if (command.s !== undefined) {
            this._bedTemperature.set(command.s);
          }
          break;
        default:
          // Handle other commands or log unknown
          console.debug(`Unknown command: ${command.command}`);
          break;
      }
    } catch (error) {
      this._errorMessage.set(
        `Error executing command ${command.command}: ${error}`
      );
      this._simulationState.set(SimulationState.ERROR);
    }

    return null;
  }

  private executeLinearMove(
    command: GCodeCommand,
    startPos: PrinterPosition,
    startE: number
  ): PathSegment | null {
    const newPos = this.calculateNewPosition(command, startPos);
    const extrusionDiff = this.calculateExtrusionDiff(command, startE);

    // Update printer state
    this._printerPosition.set(newPos);
    if (command.f !== undefined) {
      this._feedRate.set(command.f);
    }

    // Determine if this is an extrusion move
    const isExtrusion = extrusionDiff > 0.001;
    const isTravel = !isExtrusion && extrusionDiff >= -0.001;

    this._isExtruding.set(isExtrusion);

    // Create path segment if there's movement
    if (this.hasMovement(startPos, newPos)) {
      return {
        startPoint: new THREE.Vector3(startPos.x, startPos.z, startPos.y),
        endPoint: new THREE.Vector3(newPos.x, newPos.z, newPos.y),
        extrusionAmount: Math.abs(extrusionDiff),
        isExtrusion,
        isTravel,
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
    const newPos = this.calculateNewPosition(command, startPos);
    const extrusionDiff = this.calculateExtrusionDiff(command, startE);

    // Calculate arc center
    let centerPos: THREE.Vector3;
    if (command.i !== undefined || command.j !== undefined) {
      centerPos = new THREE.Vector3(
        startPos.x + (command.i || 0),
        startPos.z + (command.k || 0),
        startPos.y + (command.j || 0)
      );
    } else if (command.r !== undefined) {
      const center2D = this.calculateArcCenterFromRadius(
        { x: startPos.x, y: startPos.y },
        { x: newPos.x, y: newPos.y },
        command.r,
        clockwise
      );
      centerPos = new THREE.Vector3(center2D.x, startPos.z, center2D.y);
    } else {
      return this.executeLinearMove(command, startPos, startE);
    }

    // Update printer state
    this._printerPosition.set(newPos);
    if (command.f !== undefined) {
      this._feedRate.set(command.f);
    }

    const isExtrusion = extrusionDiff > 0.001;
    this._isExtruding.set(isExtrusion);

    // Generate arc segments
    const segments = this.generateArcPoints(
      new THREE.Vector3(startPos.x, startPos.z, startPos.y),
      new THREE.Vector3(newPos.x, newPos.z, newPos.y),
      centerPos,
      clockwise
    );

    const radius = new THREE.Vector3(
      startPos.x,
      startPos.z,
      startPos.y
    ).distanceTo(centerPos);

    return {
      startPoint: new THREE.Vector3(startPos.x, startPos.z, startPos.y),
      endPoint: new THREE.Vector3(newPos.x, newPos.z, newPos.y),
      extrusionAmount: Math.abs(extrusionDiff),
      isExtrusion,
      isTravel: !isExtrusion,
      isArc: true,
      arcCenter: centerPos,
      arcRadius: radius,
      segments,
    };
  }

  private executeDwell(command: GCodeCommand): void {
    if (command.p !== undefined) {
      console.debug(`Dwell: ${command.p}ms`);
    }
  }

  private executeHome(command: GCodeCommand): void {
    const currentPos = { ...this._printerPosition() };

    if (command.x !== undefined || (!command.x && !command.y && !command.z)) {
      currentPos.x = 0;
    }
    if (command.y !== undefined || (!command.x && !command.y && !command.z)) {
      currentPos.y = 0;
    }
    if (command.z !== undefined || (!command.x && !command.y && !command.z)) {
      currentPos.z = 0;
    }

    this._printerPosition.set(currentPos);
  }

  private executeSetPosition(command: GCodeCommand): void {
    const currentPos = { ...this._printerPosition() };

    if (command.x !== undefined) currentPos.x = command.x;
    if (command.y !== undefined) currentPos.y = command.y;
    if (command.z !== undefined) currentPos.z = command.z;
    if (command.e !== undefined) this._extruderPosition.set(command.e);

    this._printerPosition.set(currentPos);
  }

  private calculateNewPosition(
    command: GCodeCommand,
    currentPos: PrinterPosition
  ): PrinterPosition {
    const newPos = { ...currentPos };

    if (this._absolutePositioning()) {
      if (command.x !== undefined) newPos.x = command.x;
      if (command.y !== undefined) newPos.y = command.y;
      if (command.z !== undefined) newPos.z = command.z;
    } else {
      if (command.x !== undefined) newPos.x += command.x;
      if (command.y !== undefined) newPos.y += command.y;
      if (command.z !== undefined) newPos.z += command.z;
    }

    return newPos;
  }

  private calculateExtrusionDiff(
    command: GCodeCommand,
    currentE: number
  ): number {
    if (command.e === undefined) return 0;

    if (this._absoluteExtrusion()) {
      const diff = command.e - currentE;
      this._extruderPosition.set(command.e);
      return diff;
    } else {
      this._extruderPosition.set(currentE + command.e);
      return command.e;
    }
  }

  private hasMovement(pos1: PrinterPosition, pos2: PrinterPosition): boolean {
    const threshold = 0.001;
    return (
      Math.abs(pos1.x - pos2.x) > threshold ||
      Math.abs(pos1.y - pos2.y) > threshold ||
      Math.abs(pos1.z - pos2.z) > threshold
    );
  }

  private calculateArcCenterFromRadius(
    start: { x: number; y: number },
    end: { x: number; y: number },
    radius: number,
    clockwise: boolean
  ): { x: number; y: number } {
    const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
    const dist = Math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2);

    if (dist > 2 * Math.abs(radius)) {
      radius = dist / 2;
    }

    const h = Math.sqrt(Math.abs(radius * radius - (dist * dist) / 4));
    const dx = end.y - start.y;
    const dy = start.x - end.x;
    const len = Math.sqrt(dx * dx + dy * dy);

    if (len === 0) return mid;

    const ux = dx / len;
    const uy = dy / len;

    if (clockwise) {
      return { x: mid.x + h * ux, y: mid.y + h * uy };
    } else {
      return { x: mid.x - h * ux, y: mid.y - h * uy };
    }
  }

  private generateArcPoints(
    start: THREE.Vector3,
    end: THREE.Vector3,
    center: THREE.Vector3,
    clockwise: boolean
  ): THREE.Vector3[] {
    const startAngle = Math.atan2(start.z - center.z, start.x - center.x);
    const endAngle = Math.atan2(end.z - center.z, end.x - center.x);
    const radius = start.distanceTo(center);

    let angleDiff = endAngle - startAngle;
    if (clockwise) {
      if (angleDiff > 0) angleDiff -= 2 * Math.PI;
    } else {
      if (angleDiff < 0) angleDiff += 2 * Math.PI;
    }

    const numSegments = Math.max(8, (Math.abs(angleDiff) * radius) / 2);
    const points: THREE.Vector3[] = [];

    for (let i = 0; i <= numSegments; i++) {
      const t = i / numSegments;
      const angle = startAngle + t * angleDiff;
      const x = center.x + radius * Math.cos(angle);
      const z = center.z + radius * Math.sin(angle);
      const y = start.y + (end.y - start.y) * t;
      points.push(new THREE.Vector3(x, y, z));
    }

    return points;
  }

  private visualizePath(segment: PathSegment): void {
    if (segment.isArc && segment.segments) {
      this.createArcVisualization(segment);
    } else {
      this.createLinearVisualization(segment);
    }
  }

  private createLinearVisualization(segment: PathSegment): void {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      segment.startPoint,
      segment.endPoint,
    ]);

    if (segment.isExtrusion) {
      // Enhanced extrusion visualization with gradient effect
      const material = new THREE.LineBasicMaterial({
        color: new THREE.Color().setHSL(
          0,
          0.8,
          0.5 + segment.extrusionAmount * 0.1
        ),
        linewidth: Math.max(2, segment.extrusionAmount * 3),
        transparent: true,
        opacity: 0.9,
      });
      const line = new THREE.Line(geometry, material);
      line.castShadow = true;
      this.extrudedPaths.add(line);

      // Add subtle glow effect for recent extrusions
      if (this.extrudedPaths.children.length > 100) {
        const oldestLine = this.extrudedPaths.children[0];
        if (
          oldestLine instanceof THREE.Line &&
          oldestLine.material instanceof THREE.LineBasicMaterial
        ) {
          oldestLine.material.opacity = Math.max(
            0.3,
            oldestLine.material.opacity - 0.01
          );
        }
      }
    } else if (segment.isTravel) {
      const material = new THREE.LineBasicMaterial({
        color: 0x888888,
        transparent: true,
        opacity: 0.2,
        linewidth: 1,
      });
      const line = new THREE.Line(geometry, material);
      this.travelPaths.add(line);
    }
  }

  private createArcVisualization(segment: PathSegment): void {
    if (!segment.segments) return;

    const geometry = new THREE.BufferGeometry().setFromPoints(segment.segments);

    if (segment.isExtrusion) {
      const material = new THREE.LineBasicMaterial({
        color: new THREE.Color().setHSL(
          0.05,
          0.8,
          0.5 + segment.extrusionAmount * 0.1
        ),
        linewidth: Math.max(2, segment.extrusionAmount * 3),
        transparent: true,
        opacity: 0.9,
      });
      const line = new THREE.Line(geometry, material);
      line.castShadow = true;
      this.extrudedPaths.add(line);
    } else {
      const material = new THREE.LineBasicMaterial({
        color: 0x888888,
        transparent: true,
        opacity: 0.2,
        linewidth: 1,
      });
      const line = new THREE.Line(geometry, material);
      this.travelPaths.add(line);
    }
  }

  private clearPaths(): void {
    // Dispose of geometries and materials to prevent memory leaks
    this.extrudedPaths.children.forEach((child) => {
      if (child instanceof THREE.Line) {
        child.geometry.dispose();
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        }
      }
    });

    this.travelPaths.children.forEach((child) => {
      if (child instanceof THREE.Line) {
        child.geometry.dispose();
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        }
      }
    });

    this.extrudedPaths.clear();
    this.travelPaths.clear();
  }

  /**
   * Update build plate visibility
   */
  setBuildPlateVisible(visible: boolean): void {
    this.buildPlate.visible = visible;
  }

  /**
   * Update travel paths visibility
   */
  setTravelPathsVisible(visible: boolean): void {
    this.travelPaths.visible = visible;
  }

  /**
   * Update filament color
   */
  setFilamentColor(color: string): void {
    // Update existing paths color
    this.extrudedPaths.children.forEach((child) => {
      if (
        child instanceof THREE.Line &&
        child.material instanceof THREE.LineBasicMaterial
      ) {
        child.material.color.setStyle(color);
      }
    });
  }

  /**
   * Get Three.js scene
   */
  getScene(): THREE.Scene {
    return this.scene;
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.stop();
    this.clearPaths();
    this.scene.clear();
  }
}
