import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  input,
  OnDestroy,
  OnInit,
  output,
  signal,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { animate, style, transition, trigger } from '@angular/animations';

// PrimeNG imports - optimized
import { ButtonModule } from 'primeng/button';
import { SliderModule } from 'primeng/slider';
import { ProgressBarModule } from 'primeng/progressbar';
import { InputNumberModule } from 'primeng/inputnumber';
import { ColorPickerModule } from 'primeng/colorpicker';
import { ToggleButtonModule } from 'primeng/togglebutton';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { DialogModule } from 'primeng/dialog';
import { TableModule } from 'primeng/table';
import { TabViewModule } from 'primeng/tabview';
import { SidebarModule } from 'primeng/sidebar';
import { SpeedDialModule } from 'primeng/speeddial';
import { PanelModule } from 'primeng/panel';
import { AccordionModule } from 'primeng/accordion';

import {
  GCodeCommand,
  GCodeSimulatorService,
  SimulationState,
} from './slicing-simulator.service';

interface CommandExecutionInfo {
  index: number;
  command: GCodeCommand;
  executionTime: number;
  cumulativeTime: number;
}

@Component({
  selector: 'printer-gcode-simulator',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    SliderModule,
    ProgressBarModule,
    InputNumberModule,
    ColorPickerModule,
    ToggleButtonModule,
    TagModule,
    TooltipModule,
    DialogModule,
    TableModule,
    TabViewModule,
    SidebarModule,
    SpeedDialModule,
    PanelModule,
    AccordionModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './slicing-simulator.component.html',
  styles: [
    `
      .simulator-container {
        @apply min-h-screen;
      }

      .canvas-container canvas {
        @apply w-full h-full block;
      }

      .glass-panel {
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
      }

      :host ::ng-deep .modern-panel .p-panel-header {
        @apply bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-t-lg;
      }

      :host ::ng-deep .modern-panel .p-panel-content {
        @apply bg-white/90 backdrop-blur-sm;
      }

      :host ::ng-deep .modern-accordion .p-accordion-header {
        @apply bg-gradient-to-r from-gray-100 to-gray-200;
      }

      :host ::ng-deep .modern-accordion .p-accordion-content {
        @apply bg-white/95;
      }

      :host ::ng-deep .custom-progress .p-progressbar-value {
        @apply bg-gradient-to-r from-blue-500 to-blue-600;
      }

      :host ::ng-deep .custom-progress-green .p-progressbar-value {
        @apply bg-gradient-to-r from-green-500 to-green-600;
      }

      :host ::ng-deep .modern-slider .p-slider-range {
        @apply bg-gradient-to-r from-blue-500 to-blue-600;
      }

      :host ::ng-deep .modern-button {
        @apply shadow-lg hover:shadow-xl transition-all duration-300;
      }

      :host ::ng-deep .modern-input .p-inputnumber-input {
        @apply border-2 border-gray-200 focus:border-blue-500 rounded-lg;
      }

      :host ::ng-deep .modern-toggle.p-togglebutton {
        @apply border-2 border-gray-200 rounded-lg transition-all duration-300;
      }

      :host ::ng-deep .modern-dialog .p-dialog-header {
        @apply bg-gradient-to-r from-blue-500 to-blue-600 text-white;
      }

      :host ::ng-deep .modern-table .p-datatable-thead > tr > th {
        @apply bg-gradient-to-r from-gray-100 to-gray-200 border-b-2 border-gray-300;
      }

      :host ::ng-deep .mobile-tabs .p-tabview-nav {
        @apply justify-center;
      }

      @media (max-width: 768px) {
        .control-panel {
          @apply hidden;
        }
      }
    `,
  ],
  animations: [
    trigger('slideIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateX(-20px)' }),
        animate(
          '0.5s ease-out',
          style({ opacity: 1, transform: 'translateX(0)' })
        ),
      ]),
      transition(':leave', [
        animate(
          '0.3s ease-in',
          style({ opacity: 0, transform: 'translateX(20px)' })
        ),
      ]),
    ]),
  ],
})
export class SlicingSimulatorComponent implements OnInit, OnDestroy {
  @ViewChild('canvas', { static: true })
  canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('fileInput') fileInput!: ElementRef;

  // Inputs - streamlined
  readonly commands = input<string[]>([]);
  readonly gcodeBlobInput = input<Blob>();
  readonly animationSpeedInput = input<number>(1.0);
  readonly filamentColorInput = input<string>('#FF4444');
  readonly layerHeightInput = input<number>(0.2);
  readonly autoStart = input<boolean>(false);

  // Outputs - essential only
  readonly stateChange = output<any>();
  readonly simulationComplete = output<void>();
  readonly simulationError = output<string>();

  // Three.js objects
  private renderer!: THREE.WebGLRenderer;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  private animationId!: number;
  private resizeObserver!: ResizeObserver;

  // UI State - minimized
  readonly sidebarVisible = signal(false);
  readonly showCommandDialog = signal(false);
  readonly isMobile = signal(false);

  // Control values - streamlined
  readonly animationSpeedValue = signal(1.0);
  readonly filamentColorValue = signal('#FF4444');
  readonly layerHeightValue = signal(0.2);
  readonly buildVolumeX = signal(200);
  readonly buildVolumeY = signal(200);
  readonly buildVolumeZ = signal(200);
  readonly showTravelMoves = signal(false);
  readonly showBuildPlate = signal(true);
  readonly jumpTarget = signal(0);

  // Advanced settings - consolidated
  readonly showBezierControls = signal(false);
  readonly maxPathPoints = signal(50000);
  readonly batchUpdateSize = signal(100);
  readonly curveResolution = signal(20);
  readonly bufferSize = signal(1000);

  // Centraggio automatico
  readonly autoCenterModel = signal(true);
  readonly modelBounds = signal<any>(null);

  // Performance tracking - optimized
  private performanceMetrics = {
    fps: 0,
    frameCount: 0,
    lastFrameTime: 0,
  };

  // Performance monitoring interval
  private performanceMonitorInterval: any;

  // Command history - simplified
  private readonly _commandHistory = signal<CommandExecutionInfo[]>([]);
  readonly commandHistory = this._commandHistory.asReadonly();

  // Computed signals - essential only
  readonly simulationState = computed(() =>
    this.simulatorService.simulationState()
  );
  readonly printerState = computed(() => this.simulatorService.fullState());
  readonly errorMessage = computed(() => this.simulatorService.errorMessage());
  readonly loadingProgress = computed(() =>
    this.simulatorService.loadingProgress()
  );
  readonly isJumping = computed(() => this.simulatorService.isJumping());
  readonly jumpProgress = computed(() => this.simulatorService.jumpProgress());
  readonly commandProgress = computed(() =>
    this.simulatorService.getCommandProgress()
  );

  // Control states - streamlined
  readonly canStart = computed(
    () =>
      (this.simulationState() === SimulationState.IDLE ||
        this.simulationState() === SimulationState.COMPLETED) &&
      !this.isJumping()
  );
  readonly canPause = computed(
    () =>
      (this.simulationState() === SimulationState.RUNNING ||
        this.simulationState() === SimulationState.PAUSED) &&
      !this.isJumping()
  );
  readonly canStop = computed(
    () =>
      (this.simulationState() === SimulationState.RUNNING ||
        this.simulationState() === SimulationState.PAUSED) &&
      !this.isJumping()
  );
  readonly canReset = computed(
    () =>
      this.simulationState() !== SimulationState.RUNNING && !this.isJumping()
  );

  readonly canStep = computed(
    () =>
      this.simulationState() !== SimulationState.RUNNING && !this.isJumping()
  );

  // Speed dial items - cached
  readonly speedDialItems = computed(() => [
    {
      icon: 'pi pi-play',
      command: () => this.canStart() && this.start(),
      disabled: !this.canStart(),
    },
    {
      icon: 'pi pi-pause',
      command: () => this.canPause() && this.pause(),
      disabled: !this.canPause(),
    },
    {
      icon: 'pi pi-stop',
      command: () => this.canStop() && this.stop(),
      disabled: !this.canStop(),
    },
    {
      icon: 'pi pi-refresh',
      command: () => this.canReset() && this.reset(),
      disabled: !this.canReset(),
    },
    // NUOVO: Pulsante per centrare modello
    {
      icon: 'pi pi-crosshairs',
      command: () => this.centerModel(),
      disabled: false,
    },
  ]);

  readonly jumpTargetValue = computed(() => this.simulatorService.jumpTarget());

  protected readonly Math = Math;

  constructor(private simulatorService: GCodeSimulatorService) {
    console.log('🚀 Initializing SlicingSimulatorComponent...');

    this.setupOptimizedEffects();
    this.checkMobileOptimized();
    this.startPerformanceTracking();
    this.setupPerformanceMonitoring();

    console.log('✅ SlicingSimulatorComponent constructor completed');
  }

  ngOnInit() {
    console.log('🔄 SlicingSimulatorComponent ngOnInit starting...');

    // IMPORTANTE: Hard reset del servizio all'init del componente
    // Questo risolve il problema del mantenimento dello stato al cambio pagina
    console.log('🧹 Performing hard reset of simulator service...');
    this.simulatorService.hardReset();

    this.initializeThreeJS();
    this.setupResizeHandler();

    // Piccolo delay per assicurarsi che Three.js sia completamente inizializzato
    setTimeout(() => {
      this.resetCameraOptimized();
    }, 100);

    console.log('✅ SlicingSimulatorComponent initialized successfully');
  }

  ngOnDestroy() {
    console.log('🗑️ Destroying SlicingSimulatorComponent...');

    // Ferma tutto prima della distruzione
    this.simulatorService.forceStop();

    // Clear performance monitoring
    if (this.performanceMonitorInterval) {
      clearInterval(this.performanceMonitorInterval);
    }

    this.cleanup();

    console.log('✅ SlicingSimulatorComponent destroyed');
  }

  private checkMobileOptimized() {
    const updateMobile = () => this.isMobile.set(window.innerWidth < 1024);
    updateMobile();
    window.addEventListener('resize', updateMobile, { passive: true });
  }

  private setupOptimizedEffects() {
    // Streamlined input sync
    effect(() => {
      this.animationSpeedValue.set(this.animationSpeedInput());
      this.filamentColorValue.set(this.filamentColorInput());
      this.layerHeightValue.set(this.layerHeightInput());
    });

    // Effect per sincronizzare build volume con service
    effect(() => {
      const x = this.buildVolumeX();
      const y = this.buildVolumeY();
      const z = this.buildVolumeZ();

      this.simulatorService.setBuildVolume(x, y, z);
    });

    // Sync filament color with service
    effect(() => {
      const color = this.filamentColorInput();
      if (color) {
        this.simulatorService.setFilamentColor(color);
      }
    });

    // Blob processing
    effect(() => {
      const blob = this.gcodeBlobInput();
      if (blob) {
        console.log(
          `📁 New G-code blob received: ${(blob.size / 1024 / 1024).toFixed(
            2
          )} MB`
        );
        // Reset prima di caricare un nuovo file
        this.simulatorService.hardReset();

        // Piccolo delay per permettere al reset di completarsi
        setTimeout(() => {
          this.simulatorService.loadGCodeBlob(blob);
        }, 100);
      }
    });

    // Commands processing - optimized
    effect(() => {
      const commands = this.commands();
      if (commands.length > 0) {
        console.log(`📝 Loading ${commands.length} G-code commands`);

        // Reset prima di caricare nuovi comandi
        this.simulatorService.hardReset();

        setTimeout(() => {
          this.simulatorService.loadCommands(commands);
          this._commandHistory.set([]);
          if (this.autoStart()) {
            console.log('🎬 Auto-starting simulation...');
            this.simulatorService.start();
          }
        }, 100);
      }
    });

    // Essential output emissions only
    effect(() => {
      const state = this.printerState();
      this.stateChange.emit(state);

      if (this.simulationState() === SimulationState.COMPLETED) {
        console.log('🏁 Simulation completed, emitting event');
        this.simulationComplete.emit();
      }

      const error = this.errorMessage();
      if (error) {
        console.error('❌ Simulation error:', error);
        this.simulationError.emit(error);
      }
    });

    // Optimized command history tracking
    effect(() => {
      const currentIndex = this.printerState().currentCommandIndex;
      const command = this.simulatorService.getCurrentCommand();

      if (command && currentIndex > 0) {
        const history = this._commandHistory();
        if (!history.some((h) => h.index === currentIndex - 1)) {
          const newEntry: CommandExecutionInfo = {
            index: currentIndex - 1,
            command,
            executionTime: 0.1,
            cumulativeTime: this.printerState().executionTime,
          };
          this._commandHistory.set([...history, newEntry]);
        }
      }
    });
  }

  private startPerformanceTracking(): void {
    const trackFPS = (timestamp: number) => {
      this.performanceMetrics.frameCount++;

      if (timestamp - this.performanceMetrics.lastFrameTime >= 1000) {
        this.performanceMetrics.fps = Math.round(
          (this.performanceMetrics.frameCount * 1000) /
            (timestamp - this.performanceMetrics.lastFrameTime)
        );
        this.performanceMetrics.frameCount = 0;
        this.performanceMetrics.lastFrameTime = timestamp;
      }

      requestAnimationFrame(trackFPS);
    };

    requestAnimationFrame(trackFPS);
  }

  /**
   * Monitoraggio performance migliorato
   */
  private setupPerformanceMonitoring(): void {
    // Log info memoria ogni 30 secondi durante simulazione
    this.performanceMonitorInterval = setInterval(() => {
      if (this.simulationState() === 'running') {
        const memInfo = this.getMemoryInfo();
        console.log('📊 Performance Info:', {
          fps: memInfo.performance.fps,
          memory: memInfo.memory,
          progress: memInfo.simulation.progress.toFixed(1) + '%',
          pathPoints: memInfo.pathPoints,
        });
      }
    }, 30000); // Ogni 30 secondi
  }

  private initializeThreeJS() {
    const canvas = this.canvasRef.nativeElement;
    const container = canvas.parentElement!;

    // Fix: Enhanced renderer setup to prevent disappearing objects
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !this.isMobile(),
      alpha: true,
      powerPreference: 'high-performance',
      logarithmicDepthBuffer: true, // Fix depth precision issues
    });

    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, this.isMobile() ? 1 : 2)
    );
    this.renderer.setClearColor(0x1a1a1a, 1);

    // Fix: Better sorting and rendering settings
    this.renderer.sortObjects = true;
    this.renderer.autoClear = true;

    // Conditional shadow mapping for performance
    if (!this.isMobile()) {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    // Fix: Improved camera with better clipping planes
    this.camera = new THREE.PerspectiveCamera(
      this.isMobile() ? 85 : 75,
      container.clientWidth / container.clientHeight,
      0.5, // Near plane - prevent z-fighting
      10000 // Far plane - prevent far clipping
    );

    // Fix: Enhanced controls with better settings
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 5; // Allow very close zoom
    this.controls.maxDistance = 3000; // Allow very far zoom
    this.controls.maxPolarAngle = Math.PI;
    this.controls.minPolarAngle = 0;
    this.controls.enableZoom = true;
    this.controls.enableRotate = true;
    this.controls.enablePan = true;

    // Smooth controls
    this.controls.zoomSpeed = 1.0;
    this.controls.rotateSpeed = 1.0;
    this.controls.panSpeed = 1.0;

    // Set target to center of build volume
    this.controls.target.set(100, 10, 100);

    this.setupLighting();
    this.animate();
  }

  private setupLighting() {
    const scene = this.simulatorService.getScene();

    // Optimized lighting - fewer lights for mobile
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(100, 200, 100);

    if (!this.isMobile()) {
      directionalLight.castShadow = true;
      directionalLight.shadow.mapSize.width = 1024;
      directionalLight.shadow.mapSize.height = 1024;
    }

    scene.add(directionalLight);

    // Add hemisphere light for better overall illumination
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.4);
    scene.add(hemiLight);
  }

  getCurrentFPS(): number {
    return this.performanceMetrics.fps;
  }

  getTotalPathObjects(): number {
    return this.simulatorService.pathSegments().length;
  }

  private resetCameraOptimized() {
    const buildVolume = {
      x: this.buildVolumeX(),
      y: this.buildVolumeY(),
      z: this.buildVolumeZ(),
    };

    const maxDimension = Math.max(buildVolume.x, buildVolume.y, buildVolume.z);
    const cameraDistance = maxDimension * 1.8;

    // NUOVO: Usa il centro del volume di build
    const center = {
      x: buildVolume.x / 2,
      y: buildVolume.y / 2,
      z: 0,
    };

    // Position camera at optimal isometric angle
    this.camera.position.set(
      center.x + cameraDistance * 0.7,
      cameraDistance * 1.2,
      center.y + cameraDistance * 0.7
    );

    // Target center of build volume at ground level
    this.controls.target.set(center.x, 0, center.y);

    // Force immediate update
    this.controls.update();

    setTimeout(() => {
      this.controls.update();
    }, 100);

    console.log(
      `📷 Camera reset to center: (${center.x}, ${center.y}, ${center.z})`
    );
  }

  private setupResizeHandler() {
    const canvas = this.canvasRef.nativeElement;
    const container = canvas.parentElement!;

    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
      }
    });

    this.resizeObserver.observe(container);
  }

  private animate() {
    this.animationId = requestAnimationFrame(() => this.animate());
    this.controls.update();
    this.renderer.render(this.simulatorService.getScene(), this.camera);
  }

  private cleanup() {
    console.log('🧹 Cleaning up component resources...');

    // Cancella animazione frame se presente
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }

    // Disconnetti resize observer
    this.resizeObserver?.disconnect();

    // Dispose delle risorse Three.js
    if (this.controls) {
      this.controls.dispose();
    }

    if (this.renderer) {
      // Pulisci il renderer
      this.renderer.dispose();
      this.renderer.forceContextLoss();
    }

    // Non chiamare dispose del service qui perché è un singleton
    // e potrebbe essere usato da altre istanze del componente

    console.log('✅ Component cleanup completed');
  }

  // Streamlined control methods
  start() {
    console.log('▶️ Component: Starting simulation');
    this.simulatorService.start();
  }

  pause() {
    console.log('⏸️ Component: Pausing/Resuming simulation');
    this.simulatorService.pause();
  }

  stop() {
    console.log('⏹️ Component: Stopping simulation');
    this.simulatorService.stop();
  }

  reset() {
    console.log('🔄 Component: Resetting simulation');
    this.simulatorService.reset();
    this._commandHistory.set([]);

    // Piccolo delay per permettere al reset di completarsi
    setTimeout(() => {
      this.resetCameraOptimized();
    }, 100);
  }

  stepBack(steps = 1) {
    const currentIndex = this.printerState().currentCommandIndex;
    const newIndex = Math.max(0, currentIndex - steps);
    this.simulatorService.jumpToCommand(newIndex);
  }

  stepForward(steps = 1) {
    const currentIndex = this.printerState().currentCommandIndex;
    const newIndex = currentIndex + steps;
    this.simulatorService.jumpToCommand(newIndex);
  }

  jumpToCommand() {
    const target = this.jumpTarget();
    const totalCommands = this.printerState().totalCommands;

    if (target < 0) {
      console.warn('Invalid jump target: negative value');
      return;
    }

    if (
      target >= totalCommands &&
      this.simulatorService['streamingBuffer'].processedLines <= totalCommands
    ) {
      console.warn(
        `Jump target ${target} exceeds total commands ${totalCommands}`
      );
      return;
    }

    console.log(
      `🎯 Requesting jump to command ${target} (total: ${totalCommands})`
    );

    // Mostra feedback immediato
    const wasRunning = this.simulationState() === 'running';
    if (wasRunning) {
      this.pause(); // Pausa durante il jump
    }

    this.simulatorService
      .jumpToCommand(target)
      .then(() => {
        console.log(`✅ Jump to command ${target} completed successfully`);

        // Riprendi se era in esecuzione
        if (wasRunning) {
          setTimeout(() => {
            this.start();
          }, 500); // Piccolo delay per stabilità
        }
      })
      .catch((error) => {
        console.error(`❌ Jump to command ${target} failed:`, error);

        // Riprendi comunque se era in esecuzione
        if (wasRunning) {
          setTimeout(() => {
            this.start();
          }, 500);
        }
      });
  }

  // Optimized settings updates
  updateAnimationSpeed(event: any) {
    const speed = typeof event === 'number' ? event : event.value;
    this.animationSpeedValue.set(speed);
    this.simulatorService.setAnimationSpeed(speed);
  }

  updateFilamentColor(event: any) {
    const newColor = event.value || event;
    this.filamentColorValue.set(newColor);
    this.simulatorService.setFilamentColor(newColor);
  }

  updateLayerHeight(event: any) {
    this.layerHeightValue.set(event.value);
  }

  updateBuildVolume() {
    const x = this.buildVolumeX();
    const y = this.buildVolumeY();
    const z = this.buildVolumeZ();

    console.log(`📐 Build volume updated: ${x} x ${y} x ${z}`);
    this.simulatorService.setBuildVolume(x, y, z);

    // Aggiorna anche la camera per adattarsi al nuovo volume
    setTimeout(() => {
      this.resetCameraOptimized();
    }, 100);
  }

  updateShowTravelMoves(event: any) {
    this.showTravelMoves.set(event.checked);
  }

  updateShowBuildPlate(event: any) {
    this.showBuildPlate.set(event.checked);
  }

  updateShowBezierControls(event: any) {
    this.showBezierControls.set(event.checked);
    this.simulatorService.setBezierControlsVisible(event.checked);
  }

  updateMaxPathPoints(event: any) {
    const value = typeof event === 'number' ? event : event.value;
    this.maxPathPoints.set(value);
    this.simulatorService.setMaxPathPoints(value);
  }

  updateBatchSize(event: any) {
    const value = typeof event === 'number' ? event : event.value;
    this.batchUpdateSize.set(value);
    this.simulatorService.setBatchSize(value);
  }

  updateCurveResolution(event: any) {
    const value = typeof event === 'number' ? event : event.value;
    this.curveResolution.set(value);
    this.simulatorService.setCurveResolution(value);
  }

  updateBufferSize(event: any) {
    const value = typeof event === 'number' ? event : event.value;
    this.bufferSize.set(value);
    this.simulatorService.setBufferSize(value);
  }

  /**
   * Abilita/disabilita centraggio automatico
   */
  updateAutoCenterModel(event: any) {
    const enabled = event.checked;
    this.autoCenterModel.set(enabled);
    this.simulatorService.setAutoCenterModel(enabled);

    console.log(`🎯 Auto-centering ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Centra manualmente il modello
   */
  centerModel() {
    console.log('🎯 Manual model centering requested');
    this.simulatorService.setAutoCenterModel(true);
    this.autoCenterModel.set(true);
  }

  /**
   * Ottieni informazioni sui bounds del modello
   */
  getModelBounds() {
    return this.simulatorService.getModelBounds();
  }

  /**
   * Metodo diagnostico per verificare il posizionamento
   */
  logModelPositioning() {
    const bounds = this.simulatorService.getModelBounds();
    const printerState = this.printerState();

    const info = {
      bounds: bounds,
      currentPosition: printerState.position,
      buildVolume: {
        x: this.buildVolumeX(),
        y: this.buildVolumeY(),
        z: this.buildVolumeZ(),
      },
      autoCentering: this.autoCenterModel(),
    };

    console.log('📍 Model Positioning Info:', info);
    return info;
  }

  // Camera controls
  resetCamera() {
    this.resetCameraOptimized();
  }

  focusOnNozzle() {
    const pos = this.printerState().position;
    const bounds = this.simulatorService.getModelBounds();

    // Applica offset di centraggio
    const centeredPos = {
      x: pos.x + bounds.offset.x,
      y: pos.y + bounds.offset.y,
      z: pos.z + bounds.offset.z,
    };

    this.controls.target.set(centeredPos.x, centeredPos.z, centeredPos.y);
    const distance = 50;
    this.camera.position.set(
      centeredPos.x + distance,
      centeredPos.z + distance,
      centeredPos.y + distance
    );
    this.controls.update();

    console.log(`🎯 Focused on nozzle at centered position:`, centeredPos);
  }

  setTopView() {
    const buildVolume = {
      x: this.buildVolumeX(),
      y: this.buildVolumeY(),
      z: this.buildVolumeZ(),
    };

    const center = {
      x: buildVolume.x / 2,
      y: buildVolume.y / 2,
    };

    this.camera.position.set(center.x, buildVolume.z + 200, center.y);
    this.controls.target.set(center.x, 0, center.y);
    this.controls.update();
  }

  setIsometricView() {
    this.resetCameraOptimized();
  }

  // File handling - optimized
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];

      console.log(
        `📁 Loading G-code file: ${file.name} (${(
          file.size /
          1024 /
          1024
        ).toFixed(2)} MB)`
      );

      // Reset prima di caricare un nuovo file
      this.simulatorService.hardReset();

      // Piccolo delay per permettere al reset di completarsi
      setTimeout(() => {
        this.simulatorService.loadGCodeBlob(file);
      }, 100);
    }
  }

  // Command history - streamlined
  filterCommandHistory(event: any) {
    const value = event.target.value.toLowerCase();
    const filtered = this._commandHistory().filter(
      (item) =>
        item.command.command.toLowerCase().includes(value) ||
        item.command.rawLine.toLowerCase().includes(value)
    );
    // Could implement actual table filtering here
    console.log('🔍 Filtered commands:', filtered.length);
  }

  exportCommandHistory() {
    const data = this.commandHistory();
    if (data.length === 0) return;

    const csvContent = [
      'Index,Command,Raw Line,Execution Time,Cumulative Time',
      ...data.map(
        (item) =>
          `${item.index + 1},"${item.command.command}","${
            item.command.rawLine
          }",${item.executionTime},${item.cumulativeTime}`
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gcode-history-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    console.log('📥 Command history exported successfully');
  }

  exportPerformanceStats() {
    const stats = {
      timestamp: new Date().toISOString(),
      totalCommands: this.printerState().totalCommands,
      pathObjects: this.getTotalPathObjects(),
      currentFPS: this.getCurrentFPS(),
      animationSpeed: this.animationSpeedValue(),
      maxPathPoints: this.maxPathPoints(),
      batchSize: this.batchUpdateSize(),
      curveResolution: this.curveResolution(),
      memoryUsage: this.simulatorService.getMemoryUsage(),
    };

    const blob = new Blob([JSON.stringify(stats, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gcode-performance-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    console.log('📊 Performance stats exported successfully');
  }

  // Utility methods - streamlined
  getStateSeverity(
    state: SimulationState
  ): 'success' | 'info' | 'warning' | 'danger' | 'secondary' {
    const severityMap = {
      [SimulationState.RUNNING]: 'success',
      [SimulationState.PAUSED]: 'warning',
      [SimulationState.COMPLETED]: 'info',
      [SimulationState.ERROR]: 'danger',
      [SimulationState.LOADING]: 'info',
      [SimulationState.IDLE]: 'secondary',
    } as const;

    return severityMap[state] || 'secondary';
  }

  getCommandSeverity(
    command: string
  ): 'success' | 'info' | 'warning' | 'danger' | 'secondary' {
    if (command.startsWith('G0') || command.startsWith('G1')) return 'success';
    if (command.startsWith('G2') || command.startsWith('G3')) return 'info';
    if (command.startsWith('M')) return 'warning';
    return 'secondary';
  }

  formatTime(seconds: number): string {
    if (seconds < 60) return `${seconds.toFixed(0)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
  }

  // Metodi di utilità per debug e monitoraggio
  getMemoryInfo() {
    const memoryUsage = this.simulatorService.getMemoryUsage();
    const diagnostic = this.getDiagnosticInfo();

    return {
      ...diagnostic,
      memory: memoryUsage,
      pathPoints: {
        extrusion: this.simulatorService['batchedExtrusionPath'].points.length,
        travel: this.simulatorService['batchedTravelPath'].points.length,
      },
    };
  }

  // Diagnostic info for debugging
  getDiagnosticInfo() {
    const bounds = this.simulatorService.getModelBounds();

    return {
      simulation: {
        state: this.simulationState(),
        progress: this.printerState().printProgress,
        currentCommand: this.printerState().currentCommandIndex,
        totalCommands: this.printerState().totalCommands,
      },
      performance: {
        fps: this.getCurrentFPS(),
        pathObjects: this.getTotalPathObjects(),
        maxPathPoints: this.maxPathPoints(),
        batchSize: this.batchUpdateSize(),
      },
      settings: {
        animationSpeed: this.animationSpeedValue(),
        curveResolution: this.curveResolution(),
        showBezierControls: this.showBezierControls(),
      },
      // NUOVO: Informazioni centraggio
      positioning: {
        autoCentering: this.autoCenterModel(),
        modelBounds: bounds.bounds,
        centeringOffset: bounds.offset,
        buildCenter: bounds.buildCenter,
      },
    };
  }

  logCurrentState() {
    const state = {
      simulation: this.simulationState(),
      commands: {
        current: this.printerState().currentCommandIndex,
        total: this.printerState().totalCommands,
        loaded: this.simulatorService['_commands']().length,
        processed: this.simulatorService['streamingBuffer'].processedLines,
      },
      memory: this.simulatorService.getMemoryUsage(),
      performance: {
        fps: this.getCurrentFPS(),
        pathObjects: this.getTotalPathObjects(),
      },
    };

    console.log('🔍 Current Simulator State:', state);
    return state;
  }

  // Metodo per pulire manualmente la memoria se necessario
  clearMemoryCache() {
    console.log('🧹 Manual memory cleanup requested');

    const wasRunning = this.simulationState() === 'running';
    if (wasRunning) {
      this.pause();
    }

    // Forza configurazione e pulizia
    this.simulatorService.configureDynamicLimits();

    // Forza aggiornamento mesh
    this.simulatorService['updateBatchedMeshes']();

    if (wasRunning) {
      setTimeout(() => {
        this.start();
      }, 500);
    }

    console.log('✅ Memory cleanup completed');
  }

  // Metodo per ottenere statistiche avanzate
  getAdvancedStats() {
    const detailedMemory = this.simulatorService.getDetailedMemoryUsage();
    const basicInfo = this.getDiagnosticInfo();

    return {
      ...basicInfo,
      detailedMemory,
      buildVolume: {
        x: this.buildVolumeX(),
        y: this.buildVolumeY(),
        z: this.buildVolumeZ(),
      },
      ui: {
        isMobile: this.isMobile(),
        showTravelMoves: this.showTravelMoves(),
        showBuildPlate: this.showBuildPlate(),
      },
    };
  }
}
