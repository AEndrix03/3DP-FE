import {
  Component,
  ElementRef,
  ViewChild,
  OnInit,
  OnDestroy,
  input,
  output,
  effect,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  trigger,
  state,
  style,
  transition,
  animate,
} from '@angular/animations';

// PrimeNG imports
import { ButtonModule } from 'primeng/button';
import { SliderModule } from 'primeng/slider';
import { ProgressBarModule } from 'primeng/progressbar';
import { CardModule } from 'primeng/card';
import { InputNumberModule } from 'primeng/inputnumber';
import { ColorPickerModule } from 'primeng/colorpicker';
import { ToggleButtonModule } from 'primeng/togglebutton';
import { ChipModule } from 'primeng/chip';
import { DividerModule } from 'primeng/divider';
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
  GCodeSimulatorService,
  SimulationState,
  GCodeCommand,
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
    CardModule,
    InputNumberModule,
    ColorPickerModule,
    ToggleButtonModule,
    ChipModule,
    DividerModule,
    TagModule,
    TooltipModule,
    DialogModule,
    TableModule,
    TabViewModule,
    SidebarModule,
    SpeedDialModule,
    PanelModule,
    AccordionModule,
    CommonModule,
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

      /* Animations */
      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translateX(-20px);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }

      .animate-slide-in {
        animation: slideIn 0.5s ease-out;
      }
    `,
  ],
  animations: [
    trigger('slideIn', [
      state(
        'void',
        style({
          opacity: 0,
          transform: 'translateX(-20px)',
        })
      ),
      transition('void => *', [
        animate(
          '0.5s ease-out',
          style({
            opacity: 1,
            transform: 'translateX(0)',
          })
        ),
      ]),
      transition('* => void', [
        animate(
          '0.3s ease-in',
          style({
            opacity: 0,
            transform: 'translateX(20px)',
          })
        ),
      ]),
    ]),
  ],
})
export class SlicingSimulatorComponent implements OnInit, OnDestroy {
  @ViewChild('canvas', { static: true })
  canvasRef!: ElementRef<HTMLCanvasElement>;

  // Inputs
  readonly commands = input<string[]>([]);
  readonly animationSpeedInput = input<number>(1.0);
  readonly filamentColorInput = input<string>('#FF4444');
  readonly layerHeightInput = input<number>(0.2);
  readonly nozzleDiameterInput = input<number>(0.4);
  readonly buildVolumeXInput = input<number>(200);
  readonly buildVolumeYInput = input<number>(200);
  readonly buildVolumeZInput = input<number>(200);
  readonly showTravelMovesInput = input<boolean>(false);
  readonly showBuildPlateInput = input<boolean>(true);
  readonly autoStart = input<boolean>(false);

  // Outputs
  readonly stateChange = output<any>();
  readonly layerChange = output<number>();
  readonly commandChange = output<number>();
  readonly simulationComplete = output<void>();
  readonly simulationError = output<string>();

  // Three.js objects
  private renderer!: THREE.WebGLRenderer;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  private animationId!: number;

  // UI State
  readonly sidebarVisible = signal<boolean>(false);
  readonly showCommandDialog = signal<boolean>(false);
  readonly isMobile = signal<boolean>(false);

  // Control values
  animationSpeedValue = signal<number>(1.0);
  filamentColorValue = signal<string>('#FF4444');
  layerHeightValue = signal<number>(0.2);
  nozzleDiameterValue = signal<number>(0.4);
  buildVolumeX = signal<number>(200);
  buildVolumeY = signal<number>(200);
  buildVolumeZ = signal<number>(200);
  showTravelMoves = signal<boolean>(false);
  showBuildPlate = signal<boolean>(true);
  jumpTarget = signal<number>(0);

  showBezierControls = signal<boolean>(false);
  maxPathPoints = signal<number>(50000);
  batchUpdateSize = signal<number>(100);
  curveResolution = signal<number>(20);

  // Performance tracking
  private lastFrameTime = 0;
  private frameCount = 0;
  private fps = 0;
  private fpsUpdateInterval = 1000;

  // Command history
  private _commandHistory = signal<CommandExecutionInfo[]>([]);
  readonly commandHistory = this._commandHistory.asReadonly();

  // Computed signals
  readonly simulationState = computed(() =>
    this.simulatorService.simulationState()
  );
  readonly printerState = computed(() => this.simulatorService.fullState());
  readonly errorMessage = computed(() => this.simulatorService.errorMessage());
  readonly currentCommand = computed(() =>
    this.simulatorService.getCurrentCommand()
  );

  // Control states
  readonly canStart = computed(
    () =>
      this.simulationState() === SimulationState.IDLE ||
      this.simulationState() === SimulationState.COMPLETED
  );
  readonly canPause = computed(
    () =>
      this.simulationState() === SimulationState.RUNNING ||
      this.simulationState() === SimulationState.PAUSED
  );
  readonly canStop = computed(
    () =>
      this.simulationState() === SimulationState.RUNNING ||
      this.simulationState() === SimulationState.PAUSED
  );
  readonly canReset = computed(
    () => this.simulationState() !== SimulationState.RUNNING
  );

  // Speed dial items for mobile
  readonly speedDialItems = computed(() => [
    {
      icon: 'pi pi-play',
      command: () => {
        if (this.canStart()) this.start();
      },
      disabled: !this.canStart(),
    },
    {
      icon: 'pi pi-pause',
      command: () => {
        if (this.canPause()) this.pause();
      },
      disabled: !this.canPause(),
    },
    {
      icon: 'pi pi-stop',
      command: () => {
        if (this.canStop()) this.stop();
      },
      disabled: !this.canStop(),
    },
    {
      icon: 'pi pi-refresh',
      command: () => {
        if (this.canReset()) this.reset();
      },
      disabled: !this.canReset(),
    },
  ]);

  protected readonly Math = Math;

  constructor(private simulatorService: GCodeSimulatorService) {
    this.setupEffects();
    this.checkMobile();
    this.startFPSTracking();
  }

  ngOnInit() {
    this.initializeThreeJS();
    this.setupResizeHandler();

    // Center camera and set better initial zoom
    setTimeout(() => {
      this.resetCameraWithBetterView();
    }, 100);
  }

  ngOnDestroy() {
    this.cleanup();
  }

  private checkMobile() {
    this.isMobile.set(window.innerWidth < 1024);
    window.addEventListener('resize', () => {
      this.isMobile.set(window.innerWidth < 1024);
    });
  }

  private setupEffects() {
    // Sync input values
    effect(() => {
      this.animationSpeedValue.set(this.animationSpeedInput());
      this.filamentColorValue.set(this.filamentColorInput());
      this.layerHeightValue.set(this.layerHeightInput());
      this.nozzleDiameterValue.set(this.nozzleDiameterInput());
      this.buildVolumeX.set(this.buildVolumeXInput());
      this.buildVolumeY.set(this.buildVolumeYInput());
      this.buildVolumeZ.set(this.buildVolumeZInput());
      this.showTravelMoves.set(this.showTravelMovesInput());
      this.showBuildPlate.set(this.showBuildPlateInput());
    });

    // Effect per sincronizzare velocità con il servizio
    effect(() => {
      const speed = this.animationSpeedValue();
      this.simulatorService.setAnimationSpeed(speed);
    });

    // Nuovo effect per performance monitoring
    effect(() => {
      const pathCount = this.getTotalPathObjects();
      const fps = this.getCurrentFPS();

      // Warning se performance scadenti
      if (pathCount > 10000 && fps < 30) {
        console.warn(
          'Performance warning: Consider reducing max path points or batch size'
        );
      }
    });

    // Effect per ottimizzazioni automatiche
    effect(() => {
      const totalCommands = this.printerState().totalCommands;
      const currentFPS = this.getCurrentFPS();

      // Auto-ottimizzazione se file molto grande
      if (totalCommands > 50000 && this.maxPathPoints() > 30000) {
        console.info(
          'Large file detected, consider reducing max path points for better performance'
        );
      }

      // Auto-riduzione qualità se FPS troppo basso
      if (currentFPS < 20 && currentFPS > 0 && this.curveResolution() > 30) {
        console.info('Low FPS detected, consider reducing curve resolution');
      }
    });

    // Effect per aggiornamento velocità in tempo reale
    effect(() => {
      const speed = this.animationSpeedValue();
      this.simulatorService.setAnimationSpeed(speed);
    });

    // Load commands
    effect(() => {
      const commands = this.commands();
      if (commands.length > 0) {
        this.simulatorService.loadCommands(commands);
        this._commandHistory.set([]);
        if (this.autoStart()) {
          this.simulatorService.start();
        }
      }
    });

    // Track command execution for history
    effect(() => {
      const currentIndex = this.printerState().currentCommandIndex;
      const command = this.currentCommand();

      if (command && currentIndex > 0) {
        const currentHistory = this._commandHistory();
        const existingIndex = currentHistory.findIndex(
          (h) => h.index === currentIndex - 1
        );

        if (existingIndex === -1) {
          const newEntry: CommandExecutionInfo = {
            index: currentIndex - 1,
            command: command,
            executionTime: 0.1, // Approximate execution time
            cumulativeTime: this.printerState().executionTime,
          };

          this._commandHistory.set([...currentHistory, newEntry]);
        }
      }
    });

    // Emit events
    effect(() => {
      this.stateChange.emit(this.printerState());
    });

    effect(() => {
      this.layerChange.emit(this.printerState().currentLayer);
    });

    effect(() => {
      this.commandChange.emit(this.printerState().currentCommandIndex);
    });

    effect(() => {
      if (this.simulationState() === SimulationState.COMPLETED) {
        this.simulationComplete.emit();
      }
    });

    effect(() => {
      const error = this.errorMessage();
      if (error) {
        this.simulationError.emit(error);
      }
    });
  }

  /**
   * Avvia il tracking FPS
   */
  private startFPSTracking(): void {
    const trackFPS = (timestamp: number) => {
      this.frameCount++;

      if (timestamp - this.lastFrameTime >= this.fpsUpdateInterval) {
        this.fps = Math.round(
          (this.frameCount * 1000) / (timestamp - this.lastFrameTime)
        );
        this.frameCount = 0;
        this.lastFrameTime = timestamp;
      }

      requestAnimationFrame(trackFPS);
    };

    requestAnimationFrame(trackFPS);
  }

  private initializeThreeJS() {
    const canvas = this.canvasRef.nativeElement;
    const container = canvas.parentElement!;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: true,
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x1a1a1a, 1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Camera with better FOV for mobile
    this.camera = new THREE.PerspectiveCamera(
      this.isMobile() ? 85 : 75,
      container.clientWidth / container.clientHeight,
      0.1,
      2000
    );

    // Controls
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 50;
    this.controls.maxDistance = 1000;

    this.setupLighting();
    this.animate();
  }

  private setupLighting() {
    const scene = this.simulatorService.getScene();

    // Enhanced lighting setup
    const ambientLight = new THREE.AmbientLight(0x404040, 0.8);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(100, 200, 100);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    const pointLight = new THREE.PointLight(0xffffff, 0.7);
    pointLight.position.set(-100, 100, 100);
    scene.add(pointLight);

    // Add rim lighting
    const rimLight = new THREE.DirectionalLight(0x4488ff, 0.3);
    rimLight.position.set(-100, 50, -100);
    scene.add(rimLight);
  }

  /**
   * Ottiene FPS corrente
   */
  getCurrentFPS(): number {
    return this.fps;
  }

  /**
   * Ottiene numero totale oggetti path
   */
  getTotalPathObjects(): number {
    const pathSegments = this.simulatorService.pathSegments();
    return pathSegments.length;
  }

  /**
   * Controlla se ci sono comandi avanzati
   */
  hasAdvancedCommands(): boolean {
    const commands = this.simulatorService.commands();
    return commands.some(
      (cmd) =>
        cmd.command.includes('G2') ||
        cmd.command.includes('G3') ||
        cmd.command.includes('G5') ||
        cmd.command.includes('G6')
    );
  }

  /**
   * Conta comandi di un tipo specifico
   */
  getCommandCount(commandType: string): number {
    const commands = this.simulatorService.commands();
    return commands.filter((cmd) => cmd.command === commandType).length;
  }

  /**
   * Aggiorna visualizzazione punti controllo Bezier
   */
  updateShowBezierControls(event: any): void {
    this.showBezierControls.set(event.checked);
    this.simulatorService.setBezierControlsVisible(event.checked);
  }

  /**
   * Aggiorna limite massimo punti path
   */
  updateMaxPathPoints(event: any): void {
    const value = typeof event === 'number' ? event : event.value;
    this.maxPathPoints.set(value);
    this.simulatorService.setMaxPathPoints(value);
  }

  /**
   * Aggiorna dimensione batch per aggiornamenti
   */
  updateBatchSize(event: any): void {
    const value = typeof event === 'number' ? event : event.value;
    this.batchUpdateSize.set(value);
    this.simulatorService.setBatchSize(value);
  }

  /**
   * Aggiorna risoluzione curve
   */
  updateCurveResolution(event: any): void {
    const value = typeof event === 'number' ? event : event.value;
    this.curveResolution.set(value);
    this.simulatorService.setCurveResolution(value);
  }

  private resetCameraWithBetterView() {
    const buildVolume = {
      x: this.buildVolumeX(),
      y: this.buildVolumeY(),
      z: this.buildVolumeZ(),
    };

    // Calculate optimal camera position based on build volume
    const maxDimension = Math.max(buildVolume.x, buildVolume.y, buildVolume.z);
    const cameraDistance = maxDimension * 1.5;

    // Position camera at 45-degree angle for good view
    this.camera.position.set(
      buildVolume.x / 2 + cameraDistance * 0.7,
      cameraDistance,
      buildVolume.y / 2 + cameraDistance * 0.7
    );

    // Target center of build volume
    this.controls.target.set(
      buildVolume.x / 2,
      buildVolume.z / 4,
      buildVolume.y / 2
    );

    this.controls.update();
  }

  private setupResizeHandler() {
    const canvas = this.canvasRef.nativeElement;
    const container = canvas.parentElement!;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
      }
    });

    resizeObserver.observe(container);
  }

  private animate() {
    this.animationId = requestAnimationFrame(() => this.animate());
    this.controls.update();
    this.renderer.render(this.simulatorService.getScene(), this.camera);
  }

  private cleanup() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    this.simulatorService.dispose();
    this.controls?.dispose();
    this.renderer?.dispose();
  }

  // Control Methods
  start() {
    this.simulatorService.start();
  }

  pause() {
    this.simulatorService.pause();
  }

  stop() {
    this.simulatorService.stop();
  }

  reset() {
    // Reset normale
    this.simulatorService.reset();
    this._commandHistory.set([]);

    // Reset contatori performance
    this.frameCount = 0;
    this.fps = 0;

    console.debug('Simulator reset with performance counters cleared');
  }

  stepBack(steps = 1) {
    this.simulatorService.stepBack(steps);
  }

  stepForward(steps = 1) {
    this.simulatorService.stepForward(steps);
  }

  jumpToCommand() {
    const target = this.jumpTarget();
    if (target >= 0 && target < this.printerState().totalCommands) {
      this.simulatorService.jumpToCommand(target);
    }
  }

  xportPerformanceStats(): void {
    const stats = {
      timestamp: new Date().toISOString(),
      totalCommands: this.printerState().totalCommands,
      pathObjects: this.getTotalPathObjects(),
      currentFPS: this.getCurrentFPS(),
      animationSpeed: this.animationSpeedValue(),
      maxPathPoints: this.maxPathPoints(),
      batchSize: this.batchUpdateSize(),
      curveResolution: this.curveResolution(),
      advancedCommands: {
        arcs: this.getCommandCount('G2') + this.getCommandCount('G3'),
        bezier: this.getCommandCount('G5') + this.getCommandCount('G5.1'),
        nurbs: this.getCommandCount('G6'),
      },
    };

    const blob = new Blob([JSON.stringify(stats, null, 2)], {
      type: 'application/json',
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gcode-performance-stats.json';
    a.click();
    window.URL.revokeObjectURL(url);
  }

  // Settings Updates
  updateAnimationSpeed(event: any) {
    const newSpeed = typeof event === 'number' ? event : event.value;
    this.animationSpeedValue.set(newSpeed);

    // Applica immediatamente al servizio
    this.simulatorService.setAnimationSpeed(newSpeed);

    // Feedback visivo opzionale
    if (newSpeed > 10) {
      console.debug(`High speed mode: ${newSpeed}x`);
    }
  }

  updateFilamentColor(event: any) {
    this.filamentColorValue.set(event.value);
  }

  updateLayerHeight(event: any) {
    this.layerHeightValue.set(event.value);
  }

  updateNozzleDiameter(event: any) {
    this.nozzleDiameterValue.set(event.value);
  }

  updateBuildVolume() {
    // Update build volume visualization in service
  }

  updateShowTravelMoves(event: any) {
    this.showTravelMoves.set(event.checked);
  }

  updateShowBuildPlate(event: any) {
    this.showBuildPlate.set(event.checked);
  }

  // Camera Controls
  resetCamera() {
    this.resetCameraWithBetterView();
  }

  focusOnNozzle() {
    const pos = this.printerState().position;
    this.controls.target.set(pos.x, pos.z, pos.y);
    const distance = 50;
    this.camera.position.set(
      pos.x + distance,
      pos.z + distance,
      pos.y + distance
    );
    this.controls.update();
  }

  setTopView() {
    const buildVolume = {
      x: this.buildVolumeX(),
      y: this.buildVolumeY(),
      z: this.buildVolumeZ(),
    };

    this.camera.position.set(
      buildVolume.x / 2,
      buildVolume.z + 200,
      buildVolume.y / 2
    );
    this.controls.target.set(buildVolume.x / 2, 0, buildVolume.y / 2);
    this.controls.update();
  }

  setIsometricView() {
    this.resetCameraWithBetterView();
  }

  // Command History
  filterCommandHistory(event: any) {
    // Implement table filtering
    const value = event.target.value;
    // This would typically filter the table data
    console.log('Filtering commands:', value);
  }

  exportCommandHistory() {
    const data = this.commandHistory();
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
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gcode-command-history.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  }

  // Utility Methods
  getStateSeverity(
    state: SimulationState
  ): 'success' | 'info' | 'warning' | 'danger' | 'secondary' {
    switch (state) {
      case SimulationState.RUNNING:
        return 'success';
      case SimulationState.PAUSED:
        return 'warning';
      case SimulationState.COMPLETED:
        return 'info';
      case SimulationState.ERROR:
        return 'danger';
      default:
        return 'secondary';
    }
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
    if (seconds < 60) {
      return `${seconds.toFixed(0)}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
  }

  /**
   * Metodo utility per diagnostica
   */
  getDiagnosticInfo(): any {
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
    };
  }
}
