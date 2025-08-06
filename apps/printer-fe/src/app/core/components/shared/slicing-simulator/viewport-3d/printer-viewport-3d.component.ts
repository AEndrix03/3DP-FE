// src/app/printer-simulator/components/viewport-3d/printer-viewport-3d.component.ts

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  OnDestroy,
  OnInit,
  output,
  PLATFORM_ID,
  signal,
  ViewChild,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import * as THREE from 'three';
// Note: OrbitControls import should be adjusted based on your Three.js setup
// import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  BehaviorSubject,
  distinctUntilChanged,
  fromEvent,
  interval,
  map,
} from 'rxjs';
import {
  CameraSettings,
  createVector3D,
  PERFORMANCE_THRESHOLDS,
  PerformanceMetrics,
  SimulationState,
  Vector3D,
  ViewportSettings,
} from '../../../../models/simulator/simulator.models';
import { GCodeSimulatorService } from '../slicing-simulator.service';

interface ViewportState {
  readonly isInitialized: boolean;
  readonly isLoading: boolean;
  readonly hasWebGL: boolean;
  readonly isContextLost: boolean;
  readonly isRendering: boolean;
  readonly currentQuality: 'low' | 'medium' | 'high' | 'auto';
}

interface RenderingStats {
  readonly fps: number;
  readonly frameTime: number;
  readonly renderCalls: number;
  readonly triangles: number;
  readonly drawCalls: number;
  readonly geometries: number;
  readonly textures: number;
  readonly programs: number;
}

interface AdaptiveQuality {
  readonly targetFPS: number;
  readonly currentLevel: number;
  readonly autoAdjust: boolean;
  readonly performanceHistory: number[];
}

// Fallback OrbitControls interface for cases where the import might fail
interface OrbitControlsLike {
  enabled: boolean;
  enableDamping: boolean;
  dampingFactor: number;
  minDistance: number;
  maxDistance: number;
  enablePan: boolean;
  enableZoom: boolean;
  enableRotate: boolean;
  target: THREE.Vector3;

  addEventListener(event: string, callback: () => void): void;

  update(): void;

  dispose(): void;
}

@Component({
  selector: 'printer-viewport-3d',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="viewport-container" [class.loading]="viewportState().isLoading">
      <!-- Canvas Container -->
      <div class="canvas-wrapper" #canvasWrapper>
        <canvas
          #canvas
          class="viewport-canvas"
          [class.cursor-wait]="viewportState().isLoading"
          [class.cursor-grab]="!viewportState().isLoading && !isDragging()"
          [class.cursor-grabbing]="isDragging()"
          [attr.aria-label]="'3D printer simulation viewport'"
          tabindex="0"
        ></canvas>

        <!-- WebGL Not Supported Message -->
        <div class="webgl-error" *ngIf="!viewportState().hasWebGL">
          <div class="error-content">
            <i
              class="pi pi-exclamation-triangle text-4xl text-red-500 mb-4"
            ></i>
            <h3 class="text-lg font-bold mb-2">WebGL Not Supported</h3>
            <p class="text-gray-600 mb-4">
              Your browser doesn't support WebGL, which is required for 3D
              visualization.
            </p>
            <div class="text-sm text-gray-500">
              <p>
                Try updating your browser or enabling hardware acceleration.
              </p>
            </div>
          </div>
        </div>

        <!-- Context Lost Message -->
        <div class="context-lost-error" *ngIf="viewportState().isContextLost">
          <div class="error-content">
            <i class="pi pi-refresh text-4xl text-yellow-500 mb-4"></i>
            <h3 class="text-lg font-bold mb-2">Graphics Context Lost</h3>
            <p class="text-gray-600 mb-4">
              The graphics context was lost. Click to reinitialize the 3D
              viewport.
            </p>
            <button
              class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              (click)="reinitializeRenderer()"
            >
              <i class="pi pi-refresh mr-2"></i>
              Reinitialize
            </button>
          </div>
        </div>
      </div>

      <!-- Loading Overlay -->
      <div
        class="loading-overlay"
        *ngIf="viewportState().isLoading"
        [class.fade-out]="!viewportState().isLoading"
      >
        <div class="loading-content">
          <div class="loading-spinner">
            <div class="spinner-ring"></div>
            <div class="spinner-ring"></div>
            <div class="spinner-ring"></div>
          </div>
          <h3 class="loading-title">{{ loadingMessage() }}</h3>
          <div class="loading-progress" *ngIf="loadingProgress() > 0">
            <div class="progress-bar">
              <div
                class="progress-fill"
                [style.width.%]="loadingProgress()"
              ></div>
            </div>
            <span class="progress-text"
              >{{ loadingProgress().toFixed(1) }}%</span
            >
          </div>
          <p class="loading-hint">{{ loadingHint() }}</p>
        </div>
      </div>

      <!-- Performance Warning -->
      <div class="performance-warning" *ngIf="showPerformanceWarning()">
        <div class="warning-content">
          <i class="pi pi-exclamation-triangle warning-icon"></i>
          <div class="warning-text">
            <h4 class="warning-title">Performance Issue</h4>
            <p class="warning-message">{{ performanceWarningMessage() }}</p>
          </div>
          <div class="warning-actions">
            <button class="btn-optimize" (click)="optimizePerformance()">
              <i class="pi pi-wrench"></i>
              Optimize
            </button>
            <button class="btn-dismiss" (click)="dismissPerformanceWarning()">
              <i class="pi pi-times"></i>
            </button>
          </div>
        </div>
      </div>

      <!-- Quality Control (Debug) -->
      <div class="quality-control" *ngIf="showDebugControls()">
        <div class="quality-selector">
          <label class="quality-label">Quality:</label>
          <select
            class="quality-select"
            [value]="adaptiveQuality().currentLevel"
            (change)="setQualityLevel(+$any($event.target).value)"
          >
            <option value="0">Low</option>
            <option value="1">Medium</option>
            <option value="2">High</option>
            <option value="3">Auto</option>
          </select>
        </div>

        <div class="stats-display" *ngIf="renderingStats()">
          <div class="stat-item">FPS: {{ renderingStats()!.fps }}</div>
          <div class="stat-item">
            Triangles: {{ renderingStats()!.triangles.toLocaleString() }}
          </div>
          <div class="stat-item">
            Draw Calls: {{ renderingStats()!.drawCalls }}
          </div>
        </div>
      </div>

      <!-- Touch Controls Hint (Mobile) -->
      <div class="touch-controls-hint" *ngIf="isMobile() && showTouchHint()">
        <div class="hint-content">
          <p class="hint-text">
            <i class="pi pi-hand-point-up mr-2"></i>
            Drag to rotate • Pinch to zoom • Two fingers to pan
          </p>
          <button class="hint-dismiss" (click)="dismissTouchHint()">
            <i class="pi pi-times"></i>
          </button>
        </div>
      </div>

      <!-- Accessibility Controls -->
      <div class="a11y-controls sr-only" [attr.aria-live]="'polite'">
        <div
          class="viewport-description"
          [attr.aria-label]="getViewportDescription()"
        >
          {{ getViewportDescription() }}
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        @apply block w-full h-full relative overflow-hidden;
      }

      .viewport-container {
        @apply relative w-full h-full bg-gradient-to-b from-gray-900 to-gray-800 rounded-lg overflow-hidden;
      }

      .viewport-container.loading {
        @apply overflow-hidden;
      }

      .canvas-wrapper {
        @apply relative w-full h-full;
      }

      .viewport-canvas {
        @apply block w-full h-full outline-none;
        touch-action: none; /* Prevent default touch behaviors */
      }

      .viewport-canvas.cursor-grab {
        cursor: grab;
      }

      .viewport-canvas.cursor-grabbing {
        cursor: grabbing;
      }

      .viewport-canvas.cursor-wait {
        cursor: wait;
      }

      /* Error States */
      .webgl-error,
      .context-lost-error {
        @apply absolute inset-0 flex items-center justify-center bg-gray-900/90 backdrop-blur-sm;
      }

      .error-content {
        @apply text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-md;
      }

      /* Loading Overlay */
      .loading-overlay {
        @apply absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm;
        transition: opacity 0.3s ease-in-out;
      }

      .loading-overlay.fade-out {
        @apply opacity-0 pointer-events-none;
      }

      .loading-content {
        @apply text-center text-white;
      }

      .loading-spinner {
        @apply relative w-16 h-16 mx-auto mb-4;
      }

      .spinner-ring {
        @apply absolute inset-0 rounded-full border-4 border-transparent;
        border-top-color: currentColor;
        animation: spin 1s linear infinite;
      }

      .spinner-ring:nth-child(2) {
        animation-delay: -0.33s;
        @apply scale-75;
      }

      .spinner-ring:nth-child(3) {
        animation-delay: -0.67s;
        @apply scale-50;
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }

      .loading-title {
        @apply text-xl font-bold mb-2;
      }

      .loading-progress {
        @apply mb-4;
      }

      .progress-bar {
        @apply w-48 h-2 bg-gray-700 rounded-full overflow-hidden mx-auto mb-2;
      }

      .progress-fill {
        @apply h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300;
      }

      .progress-text {
        @apply text-sm font-semibold;
      }

      .loading-hint {
        @apply text-sm text-gray-300;
      }

      /* Performance Warning */
      .performance-warning {
        @apply absolute top-4 right-4 z-10;
      }

      .warning-content {
        @apply flex items-center gap-3 bg-yellow-500/90 text-yellow-900 px-4 py-3 rounded-lg shadow-lg backdrop-blur-sm;
      }

      .warning-icon {
        @apply text-xl animate-pulse;
      }

      .warning-text {
        @apply flex-1;
      }

      .warning-title {
        @apply font-bold text-sm;
      }

      .warning-message {
        @apply text-xs mt-1;
      }

      .warning-actions {
        @apply flex gap-1;
      }

      .btn-optimize,
      .btn-dismiss {
        @apply px-2 py-1 rounded text-xs font-medium transition-colors;
      }

      .btn-optimize {
        @apply bg-yellow-600 hover:bg-yellow-700 text-yellow-100;
      }

      .btn-dismiss {
        @apply bg-yellow-400 hover:bg-yellow-500 text-yellow-900;
      }

      /* Quality Control */
      .quality-control {
        @apply absolute top-4 left-4 z-10 bg-black/60 text-white p-3 rounded-lg backdrop-blur-sm;
      }

      .quality-selector {
        @apply flex items-center gap-2 mb-2;
      }

      .quality-label {
        @apply text-sm font-medium;
      }

      .quality-select {
        @apply bg-gray-700 text-white text-sm px-2 py-1 rounded border-none outline-none;
      }

      .stats-display {
        @apply space-y-1;
      }

      .stat-item {
        @apply text-xs font-mono;
      }

      /* Touch Controls Hint */
      .touch-controls-hint {
        @apply absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10;
      }

      .hint-content {
        @apply flex items-center gap-2 bg-black/80 text-white px-4 py-2 rounded-lg backdrop-blur-sm;
      }

      .hint-text {
        @apply text-sm;
      }

      .hint-dismiss {
        @apply text-gray-300 hover:text-white transition-colors;
      }

      /* Accessibility */
      .sr-only {
        @apply absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0;
      }

      /* Mobile Optimizations */
      @media (max-width: 768px) {
        .performance-warning {
          @apply top-2 right-2;
        }

        .warning-content {
          @apply px-3 py-2 text-xs;
        }

        .quality-control {
          @apply top-2 left-2 p-2;
        }

        .loading-content {
          @apply px-4;
        }

        .progress-bar {
          @apply w-32;
        }
      }

      /* Landscape Mobile */
      @media (orientation: landscape) and (max-height: 500px) {
        .performance-warning,
        .quality-control {
          @apply text-xs p-2;
        }

        .touch-controls-hint {
          @apply bottom-2;
        }
      }

      /* High Contrast */
      @media (prefers-contrast: high) {
        .viewport-container {
          @apply border-2 border-white;
        }

        .loading-overlay {
          @apply bg-black;
        }

        .performance-warning .warning-content {
          @apply bg-yellow-400 text-black border-2 border-yellow-600;
        }
      }

      /* Reduced Motion */
      @media (prefers-reduced-motion: reduce) {
        .spinner-ring {
          animation: none;
        }

        .warning-icon {
          @apply animate-none;
        }

        .progress-fill,
        .loading-overlay {
          transition: none;
        }
      }

      /* Dark Mode */
      @media (prefers-color-scheme: dark) {
        .error-content {
          @apply bg-gray-800 text-white;
        }
      }
    `,
  ],
})
export class PrinterViewport3dComponent implements OnInit, OnDestroy {
  @ViewChild('canvas', { static: true })
  canvasRef!: ElementRef<HTMLCanvasElement>;

  @ViewChild('canvasWrapper', { static: true })
  canvasWrapperRef!: ElementRef<HTMLDivElement>;

  // Injected services
  private readonly simulatorService = inject(GCodeSimulatorService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);

  // Inputs
  readonly settings = input<ViewportSettings>({
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
  });

  readonly cameraSettings = input<CameraSettings | null>(null);
  readonly autoResize = input<boolean>(true);
  readonly isMobile = input<boolean>(false);
  readonly simulationState = input<SimulationState>(SimulationState.IDLE);
  readonly showDebugControls = input<boolean>(false);

  // Outputs
  readonly cameraChange = output<CameraSettings>();
  readonly performanceUpdate = output<PerformanceMetrics>();
  readonly renderError = output<string>();
  readonly userInteraction = output<'start' | 'end'>();
  readonly qualityChange = output<'low' | 'medium' | 'high' | 'auto'>();

  // Three.js objects
  private renderer: THREE.WebGLRenderer | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private scene: THREE.Scene | null = null;
  private controls: OrbitControlsLike | null = null;
  private animationId: number = 0;
  private resizeObserver: ResizeObserver | null = null;

  // State management
  protected readonly viewportState = signal<ViewportState>({
    isInitialized: false,
    isLoading: false,
    hasWebGL: true,
    isContextLost: false,
    isRendering: false,
    currentQuality: 'auto',
  });

  protected readonly isDragging = signal<boolean>(false);
  protected readonly loadingProgress = signal<number>(0);
  protected readonly loadingMessage = signal<string>(
    'Initializing 3D Viewport...'
  );
  protected readonly loadingHint = signal<string>(
    'Setting up WebGL renderer and scene'
  );
  private readonly performanceWarningDismissed = signal<boolean>(false);
  private readonly touchHintDismissed = signal<boolean>(false);

  // Performance tracking
  protected readonly renderingStats = signal<RenderingStats | null>(null);
  protected readonly adaptiveQuality = signal<AdaptiveQuality>({
    targetFPS: 30,
    currentLevel: 2, // High quality by default
    autoAdjust: true,
    performanceHistory: [],
  });

  private frameCount = 0;
  private lastFrameTime = 0;
  private performanceCheckInterval = 1000; // ms
  private qualityAdjustmentThreshold = 5; // frames before adjusting

  // Public readonly state
  readonly isInitialized = computed(() => this.viewportState().isInitialized);
  readonly isLoading = computed(() => this.viewportState().isLoading);
  readonly hasWebGL = computed(() => this.viewportState().hasWebGL);

  // Computed properties
  readonly showPerformanceWarning = computed(() => {
    if (this.performanceWarningDismissed()) return false;

    const stats = this.renderingStats();
    return stats ? stats.fps < PERFORMANCE_THRESHOLDS.FPS.ACCEPTABLE : false;
  });

  readonly performanceWarningMessage = computed(() => {
    const stats = this.renderingStats();
    if (!stats) return '';

    if (stats.fps < PERFORMANCE_THRESHOLDS.FPS.POOR) {
      return 'Very low FPS detected. Consider lowering quality settings.';
    } else if (stats.fps < PERFORMANCE_THRESHOLDS.FPS.ACCEPTABLE) {
      return 'Low FPS detected. Performance optimization recommended.';
    }

    return 'Performance issues detected.';
  });

  readonly showTouchHint = computed(() => {
    return (
      this.isMobile() && !this.touchHintDismissed() && this.isInitialized()
    );
  });

  readonly cameraPosition = computed(() => {
    if (!this.camera) return createVector3D(0, 0, 0);
    return createVector3D(
      this.camera.position.x,
      this.camera.position.y,
      this.camera.position.z
    );
  });

  constructor() {
    this.setupEffects();
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.initializeViewport();
    }
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  // Public API methods
  resetCamera(): void {
    if (!this.camera || !this.controls) return;

    const buildVolume = this.settings().buildVolume;
    const distance =
      Math.max(buildVolume.x, buildVolume.y, buildVolume.z) * 1.5;

    this.setCameraPosition(
      createVector3D(distance, distance, distance),
      createVector3D(buildVolume.x / 2, buildVolume.z / 2, buildVolume.y / 2)
    );
  }

  setTopView(): void {
    if (!this.camera || !this.controls) return;

    const buildVolume = this.settings().buildVolume;
    this.setCameraPosition(
      createVector3D(buildVolume.x / 2, buildVolume.z + 200, buildVolume.y / 2),
      createVector3D(buildVolume.x / 2, 0, buildVolume.y / 2)
    );
  }

  setIsometricView(): void {
    this.resetCamera();
  }

  focusOnPosition(position: Vector3D, distance: number = 50): void {
    const offset = distance / Math.sqrt(3);
    this.setCameraPosition(
      createVector3D(
        position.x + offset,
        position.z + offset,
        position.y + offset
      ),
      position
    );
  }

  setCameraPosition(position: Vector3D, target: Vector3D): void {
    if (!this.camera || !this.controls) return;

    this.camera.position.set(position.x, position.y, position.z);
    this.controls.target.set(target.x, target.y, target.z);
    this.controls.update();
    this.emitCameraChange();
  }

  getCurrentCameraSettings(): CameraSettings {
    if (!this.camera || !this.controls) {
      return {
        position: createVector3D(0, 0, 0),
        target: createVector3D(0, 0, 0),
        fov: 75,
        near: 0.1,
        far: 2000,
      };
    }

    return {
      position: createVector3D(
        this.camera.position.x,
        this.camera.position.y,
        this.camera.position.z
      ),
      target: createVector3D(
        this.controls.target.x,
        this.controls.target.y,
        this.controls.target.z
      ),
      fov: this.camera.fov,
      near: this.camera.near,
      far: this.camera.far,
    };
  }

  takeScreenshot(width: number = 1920, height: number = 1080): string {
    if (!this.renderer || !this.camera || !this.scene) return '';

    try {
      const originalSize = this.renderer.getSize(new THREE.Vector2());
      this.renderer.setSize(width, height, false);
      this.renderer.render(this.scene, this.camera);

      const dataURL = this.renderer.domElement.toDataURL('image/png');

      // Restore original size
      this.renderer.setSize(originalSize.x, originalSize.y, false);

      return dataURL;
    } catch (error) {
      console.error('Failed to take screenshot:', error);
      return '';
    }
  }

  // Performance optimization methods
  optimizePerformance(): void {
    const currentLevel = this.adaptiveQuality().currentLevel;
    const newLevel = Math.max(0, currentLevel - 1);

    this.setQualityLevel(newLevel);
    this.performanceWarningDismissed.set(true);
  }

  setQualityLevel(level: number): void {
    const quality = ['low', 'medium', 'high', 'auto'][level] as
      | 'low'
      | 'medium'
      | 'high'
      | 'auto';

    this.adaptiveQuality.update((current) => ({
      ...current,
      currentLevel: level,
      autoAdjust: quality === 'auto',
    }));

    this.applyQualitySettings(quality);
    this.qualityChange.emit(quality);
  }

  dismissPerformanceWarning(): void {
    this.performanceWarningDismissed.set(true);
  }

  dismissTouchHint(): void {
    this.touchHintDismissed.set(true);
  }

  reinitializeRenderer(): void {
    this.cleanup();
    this.initializeViewport();
  }

  getViewportDescription(): string {
    const state = this.simulationState();
    const stats = this.renderingStats();

    let description = `3D printer simulation viewport. Current state: ${state}.`;

    if (stats) {
      description += ` Rendering at ${
        stats.fps
      } FPS with ${stats.triangles.toLocaleString()} triangles.`;
    }

    if (this.camera) {
      const pos = this.camera.position;
      description += ` Camera positioned at ${pos.x.toFixed(
        1
      )}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}.`;
    }

    return description;
  }

  // Private methods
  private async initializeViewport(): Promise<void> {
    try {
      this.viewportState.update((state) => ({ ...state, isLoading: true }));
      this.updateLoadingMessage('Checking WebGL support...');

      // Check WebGL support
      if (!this.checkWebGLSupport()) {
        this.viewportState.update((state) => ({
          ...state,
          hasWebGL: false,
          isLoading: false,
        }));
        return;
      }

      this.updateLoadingMessage('Initializing renderer...');
      await this.initializeRenderer();

      this.updateLoadingMessage('Setting up camera...');
      await this.initializeCamera();

      this.updateLoadingMessage('Configuring controls...');
      await this.initializeControls();

      this.updateLoadingMessage('Creating scene...');
      await this.initializeScene();

      this.updateLoadingMessage('Starting render loop...');
      this.startRenderLoop();

      if (this.autoResize()) {
        this.setupResizeObserver();
      }

      this.setupEventHandlers();
      this.startPerformanceMonitoring();

      this.viewportState.update((state) => ({
        ...state,
        isInitialized: true,
        isLoading: false,
      }));
    } catch (error) {
      this.handleInitializationError(error as Error);
    }
  }

  private checkWebGLSupport(): boolean {
    try {
      const canvas = document.createElement('canvas');
      const context =
        canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      return !!context;
    } catch {
      return false;
    }
  }

  private async initializeRenderer(): Promise<void> {
    const canvas = this.canvasRef.nativeElement;
    const container = this.canvasWrapperRef.nativeElement;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: this.settings().antialiasing,
      alpha: true,
      powerPreference: 'high-performance',
      failIfMajorPerformanceCaveat: false,
    });

    const rect = container.getBoundingClientRect();
    this.renderer.setSize(rect.width, rect.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Optimize for mobile
    if (this.isMobile()) {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    }

    this.renderer.setClearColor(0x1a1a1a, 1);

    if (this.settings().enableShadows) {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.info.autoReset = false;

    this.updateLoadingProgress(25);
  }

  private async initializeCamera(): Promise<void> {
    const container = this.canvasWrapperRef.nativeElement;
    const rect = container.getBoundingClientRect();

    const fov = this.isMobile() ? 80 : 75;
    this.camera = new THREE.PerspectiveCamera(
      fov,
      rect.width / rect.height,
      0.1,
      2000
    );

    this.resetCamera();
    this.updateLoadingProgress(50);
  }

  private async initializeControls(): Promise<void> {
    if (!this.camera) throw new Error('Camera not initialized');

    try {
      // Dynamic import to handle potential import issues
      const { OrbitControls } = await import(
        'three/examples/jsm/controls/OrbitControls.js'
      );

      this.controls = new OrbitControls(
        this.camera,
        this.canvasRef.nativeElement
      ) as OrbitControlsLike;

      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;
      this.controls.minDistance = 50;
      this.controls.maxDistance = 1000;
      this.controls.enablePan = true;
      this.controls.enableZoom = true;
      this.controls.enableRotate = true;

      // Event handlers
      this.controls.addEventListener('start', () => {
        this.isDragging.set(true);
        this.userInteraction.emit('start');
      });

      this.controls.addEventListener('end', () => {
        this.isDragging.set(false);
        this.userInteraction.emit('end');
        this.emitCameraChange();
      });

      this.updateLoadingProgress(75);
    } catch (error) {
      console.warn('Failed to load OrbitControls, using basic camera:', error);
      // Fallback: create a basic controls object
      this.controls = this.createFallbackControls();
    }
  }

  private createFallbackControls(): OrbitControlsLike {
    // Minimal fallback implementation
    return {
      enabled: true,
      enableDamping: false,
      dampingFactor: 0,
      minDistance: 50,
      maxDistance: 1000,
      enablePan: false,
      enableZoom: false,
      enableRotate: false,
      target: new THREE.Vector3(),
      addEventListener: () => {},
      update: () => {},
      dispose: () => {},
    };
  }

  private async initializeScene(): Promise<void> {
    this.scene = this.simulatorService.getScene() || new THREE.Scene();

    // Setup lighting if scene is empty
    if (this.scene.children.length === 0) {
      this.setupDefaultLighting();
    }

    this.updateLoadingProgress(100);
  }

  private setupDefaultLighting(): void {
    if (!this.scene) return;

    // Ambient light
    const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
    this.scene.add(ambientLight);

    // Main directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(100, 200, 100);

    if (this.settings().enableShadows) {
      directionalLight.castShadow = true;
      directionalLight.shadow.mapSize.width = 2048;
      directionalLight.shadow.mapSize.height = 2048;
      directionalLight.shadow.camera.near = 0.5;
      directionalLight.shadow.camera.far = 500;
    }

    this.scene.add(directionalLight);

    // Fill lights
    const fillLight1 = new THREE.PointLight(0xffffff, 0.3);
    fillLight1.position.set(-100, 100, 100);
    this.scene.add(fillLight1);

    const fillLight2 = new THREE.PointLight(0x4488ff, 0.2);
    fillLight2.position.set(100, 100, -100);
    this.scene.add(fillLight2);
  }

  private startRenderLoop(): void {
    const render = (timestamp: number) => {
      if (!this.renderer || !this.camera || !this.scene) return;

      this.viewportState.update((state) => ({ ...state, isRendering: true }));

      try {
        const renderStart = performance.now();

        if (this.controls) {
          this.controls.update();
        }

        this.renderer.render(this.scene, this.camera);

        const renderTime = performance.now() - renderStart;
        this.updatePerformanceMetrics(timestamp, renderTime);

        this.animationId = requestAnimationFrame(render);
      } catch (error) {
        console.error('Render error:', error);
        this.renderError.emit(`Render error: ${error}`);
      }
    };

    this.animationId = requestAnimationFrame(render);
  }

  private setupEventHandlers(): void {
    if (!this.canvasRef?.nativeElement) return;

    const canvas = this.canvasRef.nativeElement;

    // Context loss handling
    canvas.addEventListener(
      'webglcontextlost',
      this.handleContextLoss.bind(this),
      false
    );
    canvas.addEventListener(
      'webglcontextrestored',
      this.handleContextRestore.bind(this),
      false
    );

    // Touch events for mobile
    if (this.isMobile()) {
      this.setupMobileEventHandlers(canvas);
    }
  }

  private setupMobileEventHandlers(canvas: HTMLCanvasElement): void {
    // Prevent default touch behaviors
    fromEvent<TouchEvent>(canvas, 'touchstart', { passive: false })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        event.preventDefault();
      });

    fromEvent<TouchEvent>(canvas, 'touchmove', { passive: false })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        event.preventDefault();
      });

    fromEvent<TouchEvent>(canvas, 'touchend', { passive: false })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        event.preventDefault();
      });
  }

  private setupResizeObserver(): void {
    const container = this.canvasWrapperRef.nativeElement;

    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        this.handleResize(width, height);
      }
    });

    this.resizeObserver.observe(container);
  }

  private handleResize(width: number, height: number): void {
    if (!this.camera || !this.renderer) return;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private startPerformanceMonitoring(): void {
    const performanceSubject = new BehaviorSubject<RenderingStats>({
      fps: 60,
      frameTime: 16.67,
      renderCalls: 0,
      triangles: 0,
      drawCalls: 0,
      geometries: 0,
      textures: 0,
      programs: 0,
    });

    interval(this.performanceCheckInterval)
      .pipe(
        map(() => this.gatherRenderingStats()),
        distinctUntilChanged((prev, curr) => prev.fps === curr.fps),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((stats) => {
        this.renderingStats.set(stats);
        performanceSubject.next(stats);

        // Emit performance metrics
        this.performanceUpdate.emit({
          fps: stats.fps,
          pathObjects: this.simulatorService.getPathObjectCount?.() || 0,
          memoryUsage: this.getMemoryUsage(),
          renderTime: stats.frameTime,
          commandProcessingRate: 0,
          bufferUtilization: 0,
        });

        // Auto quality adjustment
        if (this.adaptiveQuality().autoAdjust) {
          this.adjustQualityBasedOnPerformance(stats);
        }
      });
  }

  private gatherRenderingStats(): RenderingStats {
    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastFrameTime;

    this.frameCount++;

    let fps = 60;
    if (deltaTime > 0) {
      fps = Math.round(1000 / deltaTime);
    }

    let renderingInfo = {
      renderCalls: 0,
      triangles: 0,
      drawCalls: 0,
      geometries: 0,
      textures: 0,
      programs: 0,
    };

    if (this.renderer) {
      const info = this.renderer.info;
      renderingInfo = {
        renderCalls: info.render.calls,
        triangles: info.render.triangles,
        drawCalls: info.render.calls,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
        programs: info.programs?.length || 0,
      };
    }

    this.lastFrameTime = currentTime;

    return {
      fps,
      frameTime: deltaTime,
      ...renderingInfo,
    };
  }

  private adjustQualityBasedOnPerformance(stats: RenderingStats): void {
    const quality = this.adaptiveQuality();
    const targetFPS = quality.targetFPS;

    // Update performance history
    const newHistory = [...quality.performanceHistory, stats.fps].slice(-10);

    this.adaptiveQuality.update((current) => ({
      ...current,
      performanceHistory: newHistory,
    }));

    // Check if adjustment is needed
    const averageFPS =
      newHistory.reduce((a, b) => a + b, 0) / newHistory.length;

    if (averageFPS < targetFPS - 5 && quality.currentLevel > 0) {
      // Reduce quality
      this.setQualityLevel(quality.currentLevel - 1);
    } else if (averageFPS > targetFPS + 10 && quality.currentLevel < 2) {
      // Increase quality
      this.setQualityLevel(quality.currentLevel + 1);
    }
  }

  private applyQualitySettings(
    quality: 'low' | 'medium' | 'high' | 'auto'
  ): void {
    if (!this.renderer) return;

    const qualitySettings = {
      low: {
        pixelRatio: Math.min(1, window.devicePixelRatio),
        antialias: false,
        shadows: false,
        maxPathPoints: 10000,
      },
      medium: {
        pixelRatio: Math.min(1.5, window.devicePixelRatio),
        antialias: this.settings().antialiasing,
        shadows: false,
        maxPathPoints: 25000,
      },
      high: {
        pixelRatio: Math.min(2, window.devicePixelRatio),
        antialias: this.settings().antialiasing,
        shadows: this.settings().enableShadows,
        maxPathPoints: 50000,
      },
      auto: {
        pixelRatio: Math.min(window.devicePixelRatio, 2),
        antialias: this.settings().antialiasing,
        shadows: this.settings().enableShadows,
        maxPathPoints: this.settings().maxPathPoints,
      },
    };

    const config = qualitySettings[quality];

    this.renderer.setPixelRatio(config.pixelRatio);
    this.renderer.shadowMap.enabled = config.shadows;

    // Apply settings to simulator service if available
    if (this.simulatorService.updateQualitySettings) {
      this.simulatorService.updateQualitySettings({
        maxPathPoints: config.maxPathPoints,
        enableShadows: config.shadows,
        antialiasing: config.antialias,
      });
    }
  }

  private updatePerformanceMetrics(
    timestamp: number,
    renderTime: number
  ): void {
    // Performance tracking is handled by the monitoring system
  }

  private getMemoryUsage(): number {
    // Try to get memory usage from performance API
    try {
      const memory = (performance as any).memory;
      return memory ? memory.usedJSHeapSize : 0;
    } catch {
      return 0;
    }
  }

  private handleContextLoss(event: Event): void {
    event.preventDefault();
    console.warn('WebGL context lost');

    this.viewportState.update((state) => ({
      ...state,
      isContextLost: true,
      isRendering: false,
    }));

    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = 0;
    }
  }

  private handleContextRestore(): void {
    console.log('WebGL context restored');

    this.viewportState.update((state) => ({
      ...state,
      isContextLost: false,
    }));

    // Reinitialize the viewport
    this.reinitializeRenderer();
  }

  private handleInitializationError(error: Error): void {
    console.error('Viewport initialization failed:', error);

    this.viewportState.update((state) => ({
      ...state,
      isLoading: false,
      hasWebGL: false,
    }));

    this.renderError.emit(`Initialization failed: ${error.message}`);
  }

  private updateLoadingMessage(message: string): void {
    this.loadingMessage.set(message);
  }

  private updateLoadingProgress(progress: number): void {
    this.loadingProgress.set(progress);
  }

  private emitCameraChange(): void {
    const settings = this.getCurrentCameraSettings();
    this.cameraChange.emit(settings);
  }

  private setupEffects(): void {
    // Apply settings changes
    effect(() => {
      const settings = this.settings();
      if (this.renderer && this.viewportState().isInitialized) {
        this.applySettingsToRenderer(settings);
      }
    });

    // Apply camera settings
    effect(() => {
      const cameraSettings = this.cameraSettings();
      if (cameraSettings && this.camera && this.controls) {
        this.applyCameraSettings(cameraSettings);
      }
    });
  }

  private applySettingsToRenderer(settings: ViewportSettings): void {
    if (!this.renderer) return;

    // Update shadows
    if (this.renderer.shadowMap.enabled !== settings.enableShadows) {
      this.renderer.shadowMap.enabled = settings.enableShadows;
    }

    // Other settings would be applied here
  }

  private applyCameraSettings(cameraSettings: CameraSettings): void {
    if (!this.camera || !this.controls) return;

    this.camera.position.set(
      cameraSettings.position.x,
      cameraSettings.position.y,
      cameraSettings.position.z
    );

    this.camera.fov = cameraSettings.fov;
    this.camera.near = cameraSettings.near;
    this.camera.far = cameraSettings.far;
    this.camera.updateProjectionMatrix();

    this.controls.target.set(
      cameraSettings.target.x,
      cameraSettings.target.y,
      cameraSettings.target.z
    );
    this.controls.update();
  }

  private cleanup(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = 0;
    }

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    if (this.controls) {
      this.controls.dispose();
      this.controls = null;
    }

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }

    // Clear references
    this.camera = null;
    this.scene = null;

    // Reset state
    this.viewportState.update((state) => ({
      ...state,
      isInitialized: false,
      isLoading: false,
      isRendering: false,
    }));
  }
}
