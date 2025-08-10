import { computed, effect, Injectable, signal } from '@angular/core';
import * as THREE from 'three';
import { GCodeCommand, SimulationState } from '../../types/gcode/gcode.types';
import { GCodeStreamingService } from './gcode-streaming.service';
import { SimulationStateService } from './simulation-state.service';
import { GeometryRenderingService } from './geometry-rendering.service';
import { GCodeExecutorService } from './gcode-executor.service';

@Injectable({
  providedIn: 'root',
})
export class GCodeSimulatorService {
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

  // Commands storage - NOW AS SIGNAL
  private readonly _commands = signal<GCodeCommand[]>([]);

  // Three.js objects
  private scene: THREE.Scene;
  private nozzlePosition: THREE.Group;
  private buildPlate: THREE.Mesh;

  // Computed signals from state service
  public readonly commands$ = this._commands.asReadonly();
  public readonly currentCommandIndex;
  public readonly simulationState;
  public readonly printerPosition;
  public readonly extruderPosition;
  public readonly feedRate;
  public readonly temperature;
  public readonly bedTemperature;
  public readonly fanSpeed;
  public readonly absolutePositioning;
  public readonly absoluteExtrusion;
  public readonly isExtruding;
  public readonly executionTime;
  public readonly errorMessage;
  public readonly pathSegments;
  public readonly currentPath;
  public readonly animationSpeed;
  public readonly loadingProgress;
  public readonly filamentColor;
  public readonly isJumping;
  public readonly jumpTarget;
  public readonly jumpProgress;

  // Method to get command progress
  getCommandProgress(): number {
    return this.stateService.getCommandProgress();
  }

  // Optimized computed signals with proper bounds checking
  readonly totalCommands = computed(
    () =>
      this.streamingService.getStreamingBuffer().processedLines ||
      this._commands().length
  );

  readonly printProgress = computed(() => {
    const currentLayer = this.currentLayer();
    const totalLayers = this.totalLayers();

    if (totalLayers === 0) return 0;

    const layerProgress = Math.min((currentLayer / totalLayers) * 100, 100);
    return Math.max(0, layerProgress);
  });

  readonly currentLayer = computed(() => {
    const currentIndex = this.stateService.currentCommandIndex();
    const commands = this._commands(); // NOW REACTIVE!

    if (commands.length === 0 || currentIndex === 0) return 1;

    // Conta i layer attraversati fino al comando corrente
    const uniqueZ = new Set<number>();
    let layerCount = 1;

    for (let i = 0; i < Math.min(currentIndex, commands.length); i++) {
      const cmd = commands[i];
      if (cmd.z !== undefined) {
        const roundedZ = Math.round(cmd.z * 100) / 100;
        if (!uniqueZ.has(roundedZ)) {
          uniqueZ.add(roundedZ);
          layerCount = uniqueZ.size;
        }
      }
    }

    const currentLayer = Math.max(1, layerCount);
    if (currentIndex % 100 === 0) {
      // Log ogni 100 comandi per non spammare
      console.log(
        `📍 Current layer: ${currentLayer} at command ${currentIndex}/${commands.length}`
      );
    }
    return currentLayer;
  });

  readonly totalLayers = computed(() => {
    const commands = this._commands(); // NOW REACTIVE!
    if (commands.length === 0) return 1;

    // Calcola i layer unici basati sui cambi di Z nel G-code
    const uniqueZ = new Set<number>();
    let lastZ = -1;

    commands.forEach((cmd) => {
      if (cmd.z !== undefined && cmd.z !== lastZ) {
        // Arrotonda a 2 decimali per evitare problemi di precisione float
        const roundedZ = Math.round(cmd.z * 100) / 100;
        uniqueZ.add(roundedZ);
        lastZ = cmd.z;
      }
    });

    const totalLayers = Math.max(1, uniqueZ.size);
    console.log(
      `🏗️ Total layers calculated: ${totalLayers} (from ${commands.length} commands)`
    );
    return totalLayers;
  });

  // Expose layer computeds as public readonly signals for the component
  readonly currentLayerSignal = this.currentLayer;
  readonly totalLayersSignal = this.totalLayers;

  readonly estimatedTimeRemaining;
  readonly fullState = computed(() => {
    const baseState = this.stateService.fullState();
    const currentLayer = this.currentLayer();
    const totalLayers = this.totalLayers();
    const printProgress = this.printProgress();

    // Debug logs per vedere se i valori sono corretti
    if (
      currentLayer !== baseState.currentLayer ||
      totalLayers !== baseState.totalLayers
    ) {
      console.log(
        `🔄 Layer update: ${currentLayer}/${totalLayers} (was ${baseState.currentLayer}/${baseState.totalLayers})`
      );
    }

    // Sostituisce i layer calcolati dal state service con quelli corretti
    return {
      ...baseState,
      currentLayer: currentLayer,
      totalLayers: totalLayers,
      printProgress: printProgress,
    };
  });

  constructor(
    private streamingService: GCodeStreamingService,
    private stateService: SimulationStateService,
    private geometryService: GeometryRenderingService,
    private executorService: GCodeExecutorService
  ) {
    this.estimatedTimeRemaining = this.stateService.estimatedTimeRemaining;
    // fullState è ora computed sopra con layer corretti
    this.currentCommandIndex = this.stateService.currentCommandIndex;
    this.simulationState = this.stateService.simulationState;
    this.printerPosition = this.stateService.printerPosition;
    this.extruderPosition = this.stateService.extruderPosition;
    this.feedRate = this.stateService.feedRate;
    this.temperature = this.stateService.temperature;
    this.bedTemperature = this.stateService.bedTemperature;
    this.fanSpeed = this.stateService.fanSpeed;
    this.absolutePositioning = this.stateService.absolutePositioning;
    this.absoluteExtrusion = this.stateService.absoluteExtrusion;
    this.isExtruding = this.stateService.isExtruding;
    this.executionTime = this.stateService.executionTime;
    this.errorMessage = this.stateService.errorMessage;
    this.pathSegments = this.geometryService.pathSegments;
    this.currentPath = this.geometryService.currentPath;
    this.animationSpeed = this.stateService.animationSpeed;
    this.loadingProgress = this.streamingService.loadingProgress;
    this.filamentColor = this.stateService.filamentColor;
    this.isJumping = this.stateService.isJumping;
    this.jumpTarget = this.stateService.jumpTarget;
    this.jumpProgress = this.stateService.jumpProgress;

    console.log('🚀 Initializing GCodeSimulatorService...');

    this.initializeScene();
    this.setupEffects();

    console.log('✅ GCodeSimulatorService initialized');
  }

  private initializeScene(): void {
    this.scene = this.geometryService.getScene();
    this.createNozzle();
    this.createBuildPlate();

    // Assi centrati
    const axesHelper = new THREE.AxesHelper(30);
    axesHelper.position.set(100, 0.1, 100);
    this.scene.add(axesHelper);

    // Griglia centrata
    const gridHelper = new THREE.GridHelper(300, 30, 0x444444, 0x222222);
    gridHelper.position.set(100, 0, 100);
    this.scene.add(gridHelper);
  }

  private createNozzle(): void {
    const nozzleGroup = new THREE.Group();

    const nozzleTipGeometry = new THREE.ConeGeometry(0.8, 3, 8);
    const nozzleTipMaterial = new THREE.MeshLambertMaterial({
      color: 0x666666,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    });
    const nozzleTip = new THREE.Mesh(nozzleTipGeometry, nozzleTipMaterial);
    nozzleTip.position.y = 1.5;
    nozzleTip.frustumCulled = false;
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

    const glowGeometry = new THREE.SphereGeometry(1.2, 12, 12);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xff4444,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthTest: false,
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.position.y = 0.5;
    glow.frustumCulled = false;
    glow.renderOrder = 999;
    nozzleGroup.add(glow);

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
    this.buildPlate.position.set(100, -0.1, 100);
    this.buildPlate.receiveShadow = true;

    this.scene.add(this.buildPlate);
  }

  private setupEffects(): void {
    effect(() => {
      const pos = this.stateService.printerPosition();
      const isExtruding = this.stateService.isExtruding();

      const bounds = this.executorService.getModelBounds();
      const centeredPos = {
        x: pos.x + bounds.offset.x,
        y: pos.y + bounds.offset.y,
        z: pos.z + bounds.offset.z,
      };

      if (this.nozzlePosition) {
        this.nozzlePosition.position.set(
          centeredPos.x,
          centeredPos.z + 8,
          centeredPos.y
        );

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

    effect(() => {
      const color = this.stateService.filamentColor();
      if (color) {
        this.geometryService.updateFilamentColor(color);
      }
    });
  }

  // Control methods
  start(): void {
    console.log('🚀 Starting simulation...');

    const commands = this._commands();
    if (commands.length === 0) {
      const error = 'No commands loaded.';
      this.stateService.setErrorMessage(error);
      console.error(error);
      return;
    }

    if (this.stateService.simulationState() === SimulationState.COMPLETED) {
      console.log('Simulation was completed, resetting...');
      this.reset();
    }

    if (this.stateService.simulationState() === SimulationState.RUNNING) {
      console.log('Simulation already running');
      return;
    }

    this.stateService.setErrorMessage('');
    this.stateService.setSimulationState(SimulationState.RUNNING);
    const now = performance.now();
    this.startTime = now;
    this.lastUpdateTime = now;
    this.commandStartTime = now;

    console.log('Starting animation loop...');
    this.animate();
  }

  pause(): void {
    const currentState = this.stateService.simulationState();
    console.log(`⏸️ Pause called, current state: ${currentState}`);

    if (currentState === SimulationState.RUNNING) {
      this.stateService.setSimulationState(SimulationState.PAUSED);
      if (this.animationId !== null) {
        cancelAnimationFrame(this.animationId);
        this.animationId = null;
      }
      console.log('🔸 Simulation paused');
    } else if (currentState === SimulationState.PAUSED) {
      console.log('▶️ Resuming simulation...');
      this.stateService.setSimulationState(SimulationState.RUNNING);
      this.lastUpdateTime = performance.now();
      this.animate();
      console.log('✅ Simulation resumed');
    }
  }

  stop(): void {
    console.log('⏹️ Stopping simulation...');
    this.forceStopPrivate();
    this.lastUpdateTime = 0;
    this.commandStartTime = 0;
    console.log('✅ Simulation stopped');
  }

  reset(): void {
    console.log('🔄 Resetting simulation...');

    this.forceStopPrivate();
    this.stateService.hardReset();

    this.startTime = 0;
    this.lastUpdateTime = 0;
    this.commandStartTime = 0;

    this.streamingService.getStreamingBuffer().currentIndex = 0;
    this.geometryService.clearAllPaths();

    console.log('✅ Simulation reset completed');
  }

  hardReset(): void {
    console.log('🔄 Performing hard reset of simulator service...');

    this.forceStopPrivate();
    this.stateService.hardReset();

    this._commands.set([]); // NOW REACTIVE!
    this.streamingService.getStreamingBuffer().commands = [];
    this.streamingService.getStreamingBuffer().processedLines = 0;
    this.streamingService.getStreamingBuffer().currentIndex = 0;

    this.startTime = 0;
    this.lastUpdateTime = 0;
    this.commandStartTime = 0;

    this.geometryService.clearAllPaths();
    this.streamingService.dispose();

    console.log('✅ Hard reset completed');
  }

  forceStop(): void {
    this.forceStopPrivate();
  }

  private forceStopPrivate(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    this.stateService.setSimulationState(SimulationState.IDLE);
    this.stateService.setIsJumping(false);
  }

  /**
   * Enhanced streaming G-code blob loader
   */
  async loadGCodeBlob(blob: Blob): Promise<void> {
    this.stateService.setSimulationState(SimulationState.LOADING);

    try {
      const commands = await this.streamingService.loadGCodeBlob(blob);
      this._commands.set(commands); // NOW REACTIVE!
      this.stateService.setTotalCommands(commands.length);

      if (commands.length > 0) {
        this.executorService.calculateModelBounds(commands);
        this.executorService.calculateCenteringOffset();
      }

      this.stateService.setSimulationState(SimulationState.IDLE);
      this.geometryService.configureDynamicLimits(commands.length);
    } catch (error) {
      this.stateService.setErrorMessage(`Error loading G-code: ${error}`);
      this.stateService.setSimulationState(SimulationState.ERROR);
      console.error('G-code loading failed:', error);
    }
  }

  async loadGCodeFile(file: File): Promise<void> {
    return this.loadGCodeBlob(file);
  }

  loadCommands(gcodeLines?: string[]): void {
    if (gcodeLines && gcodeLines.length > 0) {
      // Use streaming service's parser
      const commands =
        this.streamingService['parserService'].processBatchedLines(gcodeLines);
      this._commands.set(commands); // NOW REACTIVE!
      this.stateService.setTotalCommands(commands.length);

      if (commands.length > 0) {
        this.executorService.calculateModelBounds(commands);
        this.executorService.calculateCenteringOffset();
      }

      this.stateService.setSimulationState(SimulationState.IDLE);
      this.geometryService.configureDynamicLimits(commands.length);
    }
  }

  /**
   * Optimized animation loop
   */
  private animate(): void {
    if (this.stateService.simulationState() !== SimulationState.RUNNING) {
      console.log(
        `⏹️ Animation stopped, state: ${this.stateService.simulationState()}`
      );
      return;
    }

    this.animationId = requestAnimationFrame(() => this.animate());

    const now = performance.now();
    const deltaTime = now - this.lastUpdateTime;
    const speed = this.stateService.animationSpeed();
    const totalCommands = this.totalCommands();

    const baseInterval = this.getOptimalInterval(totalCommands, speed);
    const interval = Math.max(1, baseInterval / speed);

    if (deltaTime >= interval) {
      const batchSize = this.getOptimalBatchSize(totalCommands, speed);
      let processed = 0;

      const startTime = performance.now();
      const maxProcessingTime = 16;

      for (
        let i = 0;
        i < batchSize &&
        this.stateService.simulationState() === SimulationState.RUNNING;
        i++
      ) {
        const beforeIndex = this.stateService.currentCommandIndex();
        this.processNextCommand();
        const afterIndex = this.stateService.currentCommandIndex();

        if (afterIndex > beforeIndex) {
          processed++;
        } else {
          break;
        }

        if (performance.now() - startTime > maxProcessingTime) {
          break;
        }
      }

      this.lastUpdateTime = now;

      if (now - this.commandStartTime > 100) {
        this.stateService.setExecutionTime((now - this.startTime) / 1000);
        this.commandStartTime = now;
      }
    }
  }

  private getOptimalInterval(totalCommands: number, speed: number): number {
    let baseInterval = 50;

    if (totalCommands > 100000) baseInterval = 16;
    else if (totalCommands > 50000) baseInterval = 25;
    else if (totalCommands > 10000) baseInterval = 33;

    return baseInterval;
  }

  private getOptimalBatchSize(totalCommands: number, speed: number): number {
    let batchSize = 1;

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

  private processNextCommand(): void {
    const currentIndex = this.stateService.currentCommandIndex();
    const processedLines =
      this.streamingService.getStreamingBuffer().processedLines;
    const commands = this._commands();
    const actualTotal = Math.max(processedLines, commands.length);

    if (currentIndex >= actualTotal) {
      this.stateService.setSimulationState(SimulationState.COMPLETED);
      console.log(`✅ Simulation completed successfully!`);
      return;
    }

    if (currentIndex >= commands.length) {
      if (processedLines > commands.length) {
        return; // Wait for buffer
      } else {
        this.stateService.setSimulationState(SimulationState.COMPLETED);
        return;
      }
    }

    const command = commands[currentIndex];
    if (command) {
      const segment = this.executorService.executeCommand(command);
      if (segment) {
        this.geometryService.addPathSegment(
          segment,
          this.stateService.filamentColor(),
          this.stateService.animationSpeed(),
          this.totalCommands()
        );
      }
    }

    this.stateService.setCurrentCommandIndex(currentIndex + 1);
  }

  /**
   * Jump to specific command
   */
  async jumpToCommand(index: number): Promise<void> {
    const totalCommands = this.totalCommands();
    const currentBufferSize = this._commands().length;

    if (index < 0) {
      console.warn('Invalid command index: negative value');
      return Promise.resolve();
    }

    if (
      index >= currentBufferSize &&
      this.streamingService.getStreamingBuffer().processedLines >
        currentBufferSize
    ) {
      return this.jumpToFutureCommand(index);
    }

    return this.executeJump(index);
  }

  private async jumpToFutureCommand(targetIndex: number): Promise<void> {
    this.stateService.setIsJumping(true);
    this.stateService.setJumpTarget(targetIndex);
    this.stateService.setJumpProgress(0);

    return new Promise((resolve) => {
      const checkBuffer = () => {
        const currentBufferSize = this._commands().length;
        const totalProcessed =
          this.streamingService.getStreamingBuffer().processedLines;

        const progress = Math.min(
          (currentBufferSize / (targetIndex + 1)) * 100,
          100
        );
        this.stateService.setJumpProgress(progress);

        if (
          currentBufferSize > targetIndex ||
          totalProcessed <= currentBufferSize
        ) {
          this.stateService.setIsJumping(false);
          this.stateService.setJumpTarget(-1);
          this.stateService.setJumpProgress(100);

          this.executeJump(targetIndex).then(() => {
            console.log(`✅ Successfully jumped to command ${targetIndex}`);
            resolve();
          });
        } else {
          setTimeout(checkBuffer, 100);
        }
      };

      checkBuffer();
    });
  }

  private async executeJump(index: number): Promise<void> {
    const commands = this._commands();
    const totalCommands = commands.length;
    const actualTarget = Math.min(index, totalCommands - 1);

    if (actualTarget < 0) {
      console.warn('No commands available for jump');
      return;
    }

    const wasRunning =
      this.stateService.simulationState() === SimulationState.RUNNING;
    this.stop();

    // Reset state
    this.stateService.setPrinterPosition({ x: 0, y: 0, z: 0 });
    this.stateService.setExtruderPosition(0);
    this.stateService.setFeedRate(1500);
    this.stateService.setAbsolutePositioning(true);
    this.stateService.setAbsoluteExtrusion(true);
    this.stateService.setIsExtruding(false);

    this.geometryService.clearAllPaths();

    console.log(`🎯 Executing jump to command ${actualTarget}...`);

    const batchSize = 1000;
    for (
      let batchStart = 0;
      batchStart <= actualTarget;
      batchStart += batchSize
    ) {
      const batchEnd = Math.min(batchStart + batchSize - 1, actualTarget);

      for (let i = batchStart; i <= batchEnd; i++) {
        const command = commands[i];
        if (command) {
          const segment = this.executorService.executeCommand(command);
          if (segment) {
            this.geometryService.visualizePath(
              segment,
              this.stateService.filamentColor()
            );
          }
        }
      }

      if (batchEnd < actualTarget) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    this.stateService.setCurrentCommandIndex(actualTarget);
    this.geometryService.updateBatchedMeshes();

    if (wasRunning && actualTarget < totalCommands - 1) {
      this.start();
    }

    console.log(`✅ Jump to command ${actualTarget} completed.`);
  }

  // Utility methods
  getScene(): THREE.Scene {
    return this.scene;
  }

  getCurrentCommand(): GCodeCommand | null {
    const index = this.stateService.currentCommandIndex();
    const commands = this._commands();
    return commands[index] || null;
  }

  setAnimationSpeed(speed: number): void {
    this.stateService.setAnimationSpeed(speed);
  }

  setBuildVolume(x: number, y: number, z: number): void {
    this.executorService.setBuildVolume(x, y, z);
  }

  setAutoCenterModel(enabled: boolean): void {
    this.executorService.setAutoCenterModel(enabled);
  }

  getModelBounds() {
    return this.executorService.getModelBounds();
  }

  setFilamentColor(color: string): void {
    this.stateService.setFilamentColor(color);
  }

  setBezierControlsVisible(visible: boolean): void {
    this.showBezierControlPoints = visible;
  }

  setMaxPathPoints(maxPoints: number): void {
    this.geometryService.setMaxPathPoints(maxPoints);
  }

  setBatchSize(batchSize: number): void {
    this.geometryService.setBatchSize(batchSize);
  }

  setCurveResolution(resolution: number): void {
    this.curveResolution = Math.max(5, Math.min(100, resolution));
  }

  setBufferSize(size: number): void {
    this.streamingService.setBufferSize(size);
  }

  configureDynamicLimits(): void {
    this.geometryService.configureDynamicLimits(this._commands().length);
  }

  getMemoryUsage(): { extrusionMB: number; travelMB: number; totalMB: number } {
    return this.geometryService.getMemoryUsage();
  }

  getDetailedMemoryUsage(): any {
    const baseInfo = this.geometryService.getDetailedMemoryUsage();
    return {
      ...baseInfo,
      commands: {
        loaded: this._commands().length,
        processed: this.streamingService.getStreamingBuffer().processedLines,
        current: this.stateService.currentCommandIndex(),
      },
    };
  }

  // Legacy methods for backward compatibility
  stepBack(steps: number = 1): void {
    const currentIndex = this.stateService.currentCommandIndex();
    const newIndex = Math.max(0, currentIndex - steps);
    this.jumpToCommand(newIndex);
  }

  stepForward(steps: number = 1): void {
    const currentIndex = this.stateService.currentCommandIndex();
    const totalCommands = Math.max(
      this._commands().length,
      this.streamingService.getStreamingBuffer().processedLines
    );
    const newIndex = Math.min(totalCommands - 1, currentIndex + steps);
    this.jumpToCommand(newIndex);
  }

  dispose(): void {
    this.stop();
    this.streamingService.dispose();
    this.geometryService.dispose();
  }
}
