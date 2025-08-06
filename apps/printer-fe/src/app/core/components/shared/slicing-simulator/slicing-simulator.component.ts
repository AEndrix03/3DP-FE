import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  OnDestroy,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { debounceTime, Subject, takeUntil } from 'rxjs';

// Components
import { PrinterViewport3dComponent } from './viewport-3d/printer-viewport-3d.component';
import { PrinterStatusOverlaysComponent } from './status-overlays/printer-status-overlays.component';
import {
  ControlAction,
  PrinterControlPanelComponent,
  SettingsUpdate,
} from './control-panel/printer-control-panel.component';
import { PrinterMobileControlsComponent } from './mobile-controls/printer-mobile-controls.component';

// Services
import { StreamingCommandService } from '../../../services/streaming-service';
import { GCodeSimulatorService } from './slicing-simulator.service';

// Models
import {
  CameraSettings,
  CommandExecutionInfo,
  PerformanceMetrics,
  SimulationState,
  SimulatorEvent,
  ViewportSettings,
} from '../../../models/simulator/simulator.models';
import { PrinterCommandHistoryComponent } from './command-history/printer-command-history.component';

@Component({
  selector: 'printer-gcode-simulator',
  standalone: true,
  imports: [
    CommonModule,
    PrinterViewport3dComponent,
    PrinterStatusOverlaysComponent,
    PrinterControlPanelComponent,
    PrinterMobileControlsComponent,
    PrinterCommandHistoryComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="simulator-container h-screen flex flex-col lg:flex-row bg-gradient-to-br from-gray-100 to-gray-200"
    >
      <!-- Mobile Controls (Header) -->
      <printer-mobile-controls
        [printerState]="printerState()"
        [simulationState]="simulationState()"
        [settings]="viewportSettings()"
        (controlAction)="handleControlAction($event)"
        (settingsChange)="handleSettingsUpdate($event)"
        (cameraAction)="handleCameraAction($event)"
        (actionButtonClick)="handleActionButtonClick($event)"
      />

      <!-- Main Content Area -->
      <div class="flex-1 flex flex-col lg:flex-row relative overflow-hidden">
        <!-- 3D Viewport Container -->
        <div
          class="viewport-container flex-1 relative"
          [ngClass]="{
            'h-1/2': isMobile(),
            'lg:h-full': isMobile()
          }"
        >
          <!-- 3D Viewport -->
          <printer-viewport-3d
            [settings]="viewportSettings()"
            [cameraSettings]="cameraSettings()"
            [autoResize]="true"
            (cameraChange)="handleCameraChange($event)"
            (performanceUpdate)="handlePerformanceUpdate($event)"
            (renderError)="handleRenderError($event)"
            (userInteraction)="handleViewportInteraction($event)"
          />

          <!-- Status Overlays -->
          <printer-status-overlays
            [printerState]="printerState()"
            [simulationState]="simulationState()"
            [performanceMetrics]="performanceMetrics()"
            [errorMessage]="errorMessage()"
            [isLoading]="isLoading()"
            [loadingProgress]="loadingProgress()"
            [loadingMessage]="loadingMessage()"
            [isMobile]="isMobile()"
            [showDebugInfo]="showDebugInfo()"
          />
        </div>
      </div>

      <!-- Desktop Control Panel -->
      <printer-control-panel
        [printerState]="printerState()"
        [simulationState]="simulationState()"
        [settings]="viewportSettings()"
        (controlAction)="handleControlAction($event)"
        (settingsChange)="handleSettingsUpdate($event)"
        (cameraAction)="handleCameraAction($event)"
        (actionButtonClick)="handleActionButtonClick($event)"
        class="hidden lg:block"
      />
      <!-- Command History Dialog -->
      <printer-command-history
        [(visible)]="showCommandHistory"
        [commandHistory]="commandHistory()"
        [currentCommandIndex]="printerState().currentCommandIndex"
        [isLoading]="historyLoading()"
        (commandSelect)="handleCommandSelect($event)"
        (exportHistory)="handleExportHistory()"
        (filterChange)="handleHistoryFilter($event)"
      />
    </div>
  `,
  styles: [
    `
      .simulator-container {
        min-height: 100vh;
        max-height: 100vh;
        overflow: hidden;
      }

      .viewport-container {
        position: relative;
        background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
      }

      @media (max-width: 1024px) {
        .viewport-container {
          height: calc(100vh - 80px); /* Account for mobile header */
        }
      }

      @media (min-width: 1024px) {
        .viewport-container {
          height: 100vh;
        }
      }
    `,
  ],
})
export class SlicingSimulatorComponent implements OnInit, OnDestroy {
  // Injected services
  private streamingService = inject(StreamingCommandService);
  private simulatorService = inject(GCodeSimulatorService);

  // Inputs
  readonly gCodeText = input<string>('');
  readonly gCodeFile = input<File | null>(null);
  readonly autoStart = input<boolean>(false);
  readonly initialSettings = input<Partial<ViewportSettings> | null>(null);
  readonly initialCamera = input<CameraSettings | null>(null);

  // Outputs
  readonly stateChange = output<SimulatorEvent>();
  readonly layerChange = output<number>();
  readonly commandChange = output<number>();
  readonly simulationComplete = output<void>();
  readonly simulationError = output<string>();
  readonly settingsChange = output<ViewportSettings>();

  // Destroy subject
  private destroy$ = new Subject<void>();

  // Local state signals
  private _isLoading = signal<boolean>(false);
  private _loadingProgress = signal<number>(0);
  private _loadingMessage = signal<string>('Initializing...');
  private _errorMessage = signal<string | null>(null);
  private _performanceMetrics = signal<PerformanceMetrics>({
    fps: 60,
    pathObjects: 0,
    memoryUsage: 0,
    renderTime: 0,
    commandProcessingRate: 0,
  });
  private _commandHistory = signal<CommandExecutionInfo[]>([]);
  private _historyLoading = signal<boolean>(false);
  private _isMobile = signal<boolean>(false);
  private _showDebugInfo = signal<boolean>(false);

  // Settings
  private _viewportSettings = signal<ViewportSettings>({
    animationSpeed: 1.0,
    filamentColor: '#FF4444',
    layerHeight: 0.2,
    nozzleDiameter: 0.4,
    buildVolume: { x: 200, y: 200, z: 200 },
    showTravelMoves: false,
    showBuildPlate: true,
    showBezierControls: false,
    maxPathPoints: 50000,
    curveResolution: 20,
  });

  private _cameraSettings = signal<CameraSettings | null>(null);

  // Dialog states
  readonly showCommandHistory = signal<boolean>(false);

  // Public readonly signals
  readonly isLoading = this._isLoading.asReadonly();
  readonly loadingProgress = this._loadingProgress.asReadonly();
  readonly loadingMessage = this._loadingMessage.asReadonly();
  readonly errorMessage = this._errorMessage.asReadonly();
  readonly performanceMetrics = this._performanceMetrics.asReadonly();
  readonly commandHistory = this._commandHistory.asReadonly();
  readonly historyLoading = this._historyLoading.asReadonly();
  readonly isMobile = this._isMobile.asReadonly();
  readonly showDebugInfo = this._showDebugInfo.asReadonly();
  readonly viewportSettings = this._viewportSettings.asReadonly();
  readonly cameraSettings = this._cameraSettings.asReadonly();

  // Computed properties from simulator service
  readonly simulationState = computed(() =>
    this.simulatorService.simulationState()
  );
  readonly printerState = computed(() => this.simulatorService.fullState());

  // Computed properties for UI state
  readonly isSimulationActive = computed(() => {
    const state = this.simulationState();
    return (
      state === SimulationState.RUNNING || state === SimulationState.PAUSED
    );
  });

  readonly canLoadNewFile = computed(() => {
    return this.simulationState() === SimulationState.IDLE;
  });

  constructor() {
    this.setupEffects();
    this.checkMobileDevice();
    this.initializeSettings();
  }

  ngOnInit(): void {
    this.setupSubscriptions();
    this.loadInitialContent();
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  /**
   * Load G-code from text
   */
  async loadGCodeText(gCodeText: string): Promise<void> {
    if (!this.canLoadNewFile()) {
      this.handleError('Cannot load new file while simulation is running');
      return;
    }

    try {
      this._isLoading.set(true);
      this._loadingMessage.set('Processing G-code...');
      this._errorMessage.set(null);

      // Stream commands through the streaming service
      await this.streamingService.streamCommands(gCodeText);

      // Load commands into simulator
      const commands = this.streamingService.getCommands(
        0,
        this.streamingService.totalCommands()
      );
      await this.simulatorService.loadCommands(
        commands.map((cmd) => cmd.rawLine)
      );

      this._loadingMessage.set('Preparing 3D visualization...');

      // Auto-start if requested
      if (this.autoStart()) {
        await this.startSimulation();
      }
    } catch (error) {
      this.handleError(`Failed to load G-code: ${error}`);
    } finally {
      this._isLoading.set(false);
    }
  }

  /**
   * Load G-code from file
   */
  async loadGCodeFile(file: File): Promise<void> {
    if (!this.canLoadNewFile()) {
      this.handleError('Cannot load new file while simulation is running');
      return;
    }

    try {
      this._isLoading.set(true);
      this._loadingMessage.set(`Loading ${file.name}...`);
      this._errorMessage.set(null);

      // Stream commands from file
      await this.streamingService.streamFromFile(file);

      // Load commands into simulator
      const commands = this.streamingService.getCommands(
        0,
        this.streamingService.totalCommands()
      );
      await this.simulatorService.loadCommands(
        commands.map((cmd) => cmd.rawLine)
      );

      this._loadingMessage.set('Preparing 3D visualization...');

      // Auto-start if requested
      if (this.autoStart()) {
        await this.startSimulation();
      }
    } catch (error) {
      this.handleError(`Failed to load file: ${error}`);
    } finally {
      this._isLoading.set(false);
    }
  }

  /**
   * Start simulation
   */
  async startSimulation(): Promise<void> {
    try {
      this.simulatorService.start();
      this.emitStateChange('stateChange');
    } catch (error) {
      this.handleError(`Failed to start simulation: ${error}`);
    }
  }

  /**
   * Export current settings
   */
  exportSettings(): string {
    const settings = {
      viewport: this.viewportSettings(),
      camera: this.cameraSettings(),
      timestamp: new Date().toISOString(),
    };
    return JSON.stringify(settings, null, 2);
  }

  /**
   * Import settings
   */
  importSettings(settingsJson: string): void {
    try {
      const settings = JSON.parse(settingsJson);

      if (settings.viewport) {
        this._viewportSettings.set(settings.viewport);
      }

      if (settings.camera) {
        this._cameraSettings.set(settings.camera);
      }

      this.settingsChange.emit(this.viewportSettings());
    } catch (error) {
      this.handleError(`Failed to import settings: ${error}`);
    }
  }

  /**
   * Take screenshot
   */
  takeScreenshot(): string | null {
    // This would be implemented by accessing the viewport component
    // For now, return null - in a real implementation, you'd use ViewChild
    return null;
  }

  // Event handlers
  handleControlAction(action: ControlAction): void {
    try {
      switch (action.type) {
        case 'start':
          this.simulatorService.start();
          break;
        case 'pause':
          this.simulatorService.pause();
          break;
        case 'stop':
          this.simulatorService.stop();
          break;
        case 'reset':
          this.simulatorService.reset();
          this.resetCommandHistory();
          break;
        case 'stepBack':
          this.simulatorService.stepBack(action.payload || 1);
          break;
        case 'stepForward':
          this.simulatorService.stepForward(action.payload || 1);
          break;
        case 'jumpTo':
          this.simulatorService.jumpToCommand(action.payload);
          break;
      }
      this.emitStateChange('stateChange');
    } catch (error) {
      this.handleError(`Control action failed: ${error}`);
    }
  }

  handleSettingsUpdate(update: SettingsUpdate): void {
    this._viewportSettings.update((current) => ({
      ...current,
      [update.setting]: update.value,
    }));
    this.settingsChange.emit(this.viewportSettings());
  }

  handleCameraAction(
    action: 'reset' | 'focus' | 'topView' | 'isometric'
  ): void {
    // These would be handled by accessing the viewport component via ViewChild
    console.log('Camera action:', action);
  }

  handleActionButtonClick(action: 'showHistory' | 'exportSettings'): void {
    switch (action) {
      case 'showHistory':
        this.showCommandHistory.set(true);
        this.loadCommandHistory();
        break;
      case 'exportSettings':
        this.downloadSettings();
        break;
    }
  }

  handleCameraChange(settings: CameraSettings): void {
    this._cameraSettings.set(settings);
  }

  handlePerformanceUpdate(metrics: PerformanceMetrics): void {
    this._performanceMetrics.set(metrics);

    // Auto-enable debug info if performance is poor
    const shouldShowDebug = metrics.fps < 30 || metrics.renderTime > 16.67;
    this._showDebugInfo.set(shouldShowDebug);
  }

  handleRenderError(error: string): void {
    this.handleError(`Render error: ${error}`);
  }

  handleViewportInteraction(type: 'start' | 'end'): void {
    // Handle viewport interaction feedback if needed
  }

  handleCommandSelect(index: number): void {
    try {
      this.simulatorService.jumpToCommand(index);
      this.showCommandHistory.set(false);
      this.emitStateChange('commandChange');
    } catch (error) {
      this.handleError(`Failed to jump to command: ${error}`);
    }
  }

  handleExportHistory(): void {
    this.downloadCommandHistory();
  }

  handleHistoryFilter(filter: string): void {
    // Implement history filtering logic
    console.log('History filter:', filter);
  }

  private setupEffects(): void {
    // Watch for input changes
    effect(() => {
      const gCodeText = this.gCodeText();
      if (gCodeText && this.canLoadNewFile()) {
        this.loadGCodeText(gCodeText);
      }
    });

    effect(() => {
      const gCodeFile = this.gCodeFile();
      if (gCodeFile && this.canLoadNewFile()) {
        this.loadGCodeFile(gCodeFile);
      }
    });

    // Apply initial settings
    effect(() => {
      const initialSettings = this.initialSettings();
      if (initialSettings) {
        this._viewportSettings.update((current) => ({
          ...current,
          ...initialSettings,
        }));
      }
    });

    effect(() => {
      const initialCamera = this.initialCamera();
      if (initialCamera) {
        this._cameraSettings.set(initialCamera);
      }
    });

    // Update command history
    effect(() => {
      const currentIndex = this.printerState().currentCommandIndex;
      const currentCommand = this.simulatorService.getCurrentCommand();

      if (currentCommand && currentIndex >= 0) {
        this.updateCommandHistory(currentIndex, currentCommand);
      }
    });

    // Emit events
    effect(() => {
      const state = this.simulationState();
      if (state === SimulationState.COMPLETED) {
        this.simulationComplete.emit();
      }
      this.emitStateChange('stateChange');
    });

    effect(() => {
      this.layerChange.emit(this.printerState().currentLayer);
    });

    effect(() => {
      this.commandChange.emit(this.printerState().currentCommandIndex);
    });
  }

  private setupSubscriptions(): void {
    // Subscribe to streaming service events
    this.streamingService.errors$
      .pipe(takeUntil(this.destroy$))
      .subscribe((error) => {
        this.handleError(error);
      });

    // Subscribe to performance monitoring
    this.streamingService.commandChunks$
      .pipe(takeUntil(this.destroy$), debounceTime(100))
      .subscribe((chunk) => {
        const progress = (chunk.chunkIndex / chunk.totalChunks) * 100;
        this._loadingProgress.set(progress);
      });
  }

  private checkMobileDevice(): void {
    const checkMobile = () => {
      this._isMobile.set(window.innerWidth < 1024);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
  }

  private initializeSettings(): void {
    // Apply any initial settings
    const initial = this.initialSettings();
    if (initial) {
      this._viewportSettings.update((current) => ({
        ...current,
        ...initial,
      }));
    }
  }

  private async loadInitialContent(): Promise<void> {
    const gCodeText = this.gCodeText();
    const gCodeFile = this.gCodeFile();

    if (gCodeFile) {
      await this.loadGCodeFile(gCodeFile);
    } else if (gCodeText) {
      await this.loadGCodeText(gCodeText);
    }
  }

  private updateCommandHistory(index: number, command: any): void {
    this._commandHistory.update((history) => {
      const existingIndex = history.findIndex((h) => h.index === index);

      if (existingIndex === -1) {
        const newEntry: CommandExecutionInfo = {
          index,
          command,
          executionTime: 0.1, // Approximate
          cumulativeTime: this.printerState().executionTime,
          timestamp: new Date(),
        };

        return [...history, newEntry].sort((a, b) => a.index - b.index);
      }

      return history;
    });
  }

  private resetCommandHistory(): void {
    this._commandHistory.set([]);
  }

  private async loadCommandHistory(): Promise<void> {
    this._historyLoading.set(true);

    try {
      // Simulate loading delay for large histories
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Command history is already maintained through effects
      // Just indicate loading is complete
      this._historyLoading.set(false);
    } catch (error) {
      this.handleError(`Failed to load command history: ${error}`);
      this._historyLoading.set(false);
    }
  }

  private downloadSettings(): void {
    const settingsJson = this.exportSettings();
    const blob = new Blob([settingsJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'gcode-simulator-settings.json';
    a.click();

    URL.revokeObjectURL(url);
  }

  private downloadCommandHistory(): void {
    const history = this.commandHistory();
    const csvContent = [
      'Index,Command,Raw Line,Execution Time,Cumulative Time,Timestamp',
      ...history.map(
        (item) =>
          `${item.index},${item.command.command},"${item.command.rawLine}",${
            item.executionTime
          },${item.cumulativeTime},${item.timestamp.toISOString()}`
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'gcode-command-history.csv';
    a.click();

    URL.revokeObjectURL(url);
  }

  private handleError(error: string): void {
    console.error('Simulator Error:', error);
    this._errorMessage.set(error);
    this.simulationError.emit(error);
  }

  private emitStateChange(type: SimulatorEvent['type']): void {
    const event: SimulatorEvent = {
      type,
      data: this.printerState(),
      timestamp: new Date(),
    };
    this.stateChange.emit(event);
  }

  private cleanup(): void {
    this.destroy$.next();
    this.destroy$.complete();

    // Cleanup services
    this.streamingService.dispose();
    this.simulatorService.dispose();

    // Remove event listeners
    window.removeEventListener('resize', () => {});
  }
}
