// model-viewer.component.ts - IMPROVED VERSION
import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  computed,
  effect,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  input,
  OnDestroy,
  OnInit,
  Output,
  signal,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProgressBarModule } from 'primeng/progressbar';
import { Button } from 'primeng/button';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  ModelLoadProgress,
  ModelLoadResult,
  ThreeJsModelService,
} from '../../../../services/three/three-js-model.service';

export interface ModelViewerOptions {
  enableControls?: boolean;
  backgroundColor?: number | string;
  antialias?: boolean;
  shadows?: boolean;
  autoRotate?: boolean;
  showWireframe?: boolean;
  showStats?: boolean;
}

@Component({
  selector: 'printer-model-viewer',
  standalone: true,
  imports: [CommonModule, ProgressBarModule, Button],
  templateUrl: './model-viewer.component.html',
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        height: 100%;
        contain: layout style paint;
      }

      .cursor-grab:active {
        cursor: grabbing !important;
      }
    `,
  ],
})
export class ModelViewerComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('container', { static: true }) container!: ElementRef<HTMLElement>;

  // Convert @Input to InputSignal for reactivity
  modelUrl = input<string | null>(null);
  modelFile = input<Blob | null>(null);
  @Input() options: ModelViewerOptions = {};
  @Input() showButtons: boolean = true;

  @Output() modelLoaded = new EventEmitter<ModelLoadResult>();
  @Output() modelError = new EventEmitter<string>();

  // Signals
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly loadingProgress = signal<ModelLoadProgress | null>(null);
  protected readonly modelInfo = signal<ModelLoadResult | null>(null);
  protected readonly wireframe = signal(false);
  protected readonly autoRotate = signal(true);
  protected readonly isFullscreen = signal(false);

  // Computed signals
  protected readonly canInteract = computed(
    () => !this.loading() && !this.error()
  );

  // Three.js objects
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private controls: OrbitControls | null = null;
  private stopAnimation: (() => void) | null = null;
  protected currentModel: THREE.Group | null = null;

  // ResizeObserver per gestire il resize del container
  private resizeObserver: ResizeObserver | null = null;
  protected isSceneInitialized = false;
  private pendingResize = false;

  constructor(
    private readonly modelService: ThreeJsModelService,
    private readonly cdr: ChangeDetectorRef
  ) {
    // Subscribe to loading progress
    effect(() => {
      this.modelService.loading$.subscribe((progress) => {
        this.loadingProgress.set(progress);
      });
    });

    // Watch for input changes
    effect(() => {
      console.log('ModelViewerComponent effect triggered.');
      console.log('  modelUrl:', this.modelUrl());
      console.log('  modelFile:', this.modelFile());
      if (this.modelUrl() || this.modelFile()) {
        this.loadModel();
      }
    });

    // Handle wireframe toggle
    effect(() => {
      if (this.currentModel) {
        this.toggleModelWireframe(this.wireframe());
      }
    });

    // Handle auto rotate
    effect(() => {
      if (this.controls) {
        this.controls.autoRotate = this.autoRotate();
      }
    });
  }

  ngOnInit(): void {
    // Non inizializzare la scena qui, aspettiamo ngAfterViewInit
  }

  ngAfterViewInit(): void {
    // Aspettiamo che il DOM sia completamente renderizzato
    setTimeout(() => {
      this.initializeScene();
      this.setupResizeObserver();
    }, 0);
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  private setupResizeObserver(): void {
    if (!this.container?.nativeElement) return;

    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === this.container.nativeElement) {
          this.handleContainerResize();
        }
      }
    });

    this.resizeObserver.observe(this.container.nativeElement);
  }

  private handleContainerResize(): void {
    if (!this.isSceneInitialized) return;

    // Debounce il resize per evitare troppe chiamate
    if (this.pendingResize) return;

    this.pendingResize = true;
    requestAnimationFrame(() => {
      if (this.camera && this.renderer && this.container) {
        this.updateRendererSize();
      }
      this.pendingResize = false;
    });
  }

  private updateRendererSize(): void {
    if (!this.camera || !this.renderer || !this.container) return;

    const element = this.container.nativeElement;
    const rect = element.getBoundingClientRect();

    // Verifica che il container abbia dimensioni valide
    if (rect.width <= 0 || rect.height <= 0) return;

    const width = rect.width;
    const height = rect.height;

    // Aggiorna aspect ratio della camera
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    // Aggiorna dimensioni del renderer
    this.renderer.setSize(width, height);

    console.log(`Renderer resized to: ${width}x${height}`);
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    // Fallback per browser che non supportano ResizeObserver
    if (!this.resizeObserver) {
      this.handleContainerResize();
    }
  }

  private initializeScene(): void {
    if (!this.container?.nativeElement) {
      console.error('Container not available for scene initialization');
      return;
    }

    const element = this.container.nativeElement;
    const rect = element.getBoundingClientRect();

    // Verifica che il container abbia dimensioni valide
    if (rect.width <= 0 || rect.height <= 0) {
      console.warn('Container has invalid dimensions, retrying...');
      setTimeout(() => this.initializeScene(), 100);
      return;
    }

    console.log(
      `Initializing scene with container size: ${rect.width}x${rect.height}`
    );

    const sceneSetup = this.modelService.createScene(this.container, {
      enableControls: this.options.enableControls ?? true,
      backgroundColor: this.options.backgroundColor ?? 0xf0f0f0,
      antialias: this.options.antialias ?? true,
      shadows: this.options.shadows ?? true,
    });

    this.scene = sceneSetup.scene;
    this.camera = sceneSetup.camera;
    this.renderer = sceneSetup.renderer;
    this.controls = sceneSetup.controls;

    if (this.controls) {
      this.controls.autoRotate = this.autoRotate();
    }

    // Forza un resize iniziale
    this.updateRendererSize();

    // Start animation loop
    this.stopAnimation = this.modelService.startAnimationLoop(
      this.renderer,
      this.scene,
      this.camera,
      this.controls || undefined
    );

    this.isSceneInitialized = true;

    // Se c'è già un modello in attesa, caricalo
    if ((this.modelUrl() || this.modelFile()) && !this.currentModel) {
      this.loadModel();
    }
  }

  private async loadModel(): Promise<void> {
    console.log('ModelViewerComponent loadModel() called.');

    // Aspetta che la scena sia inizializzata
    if (!this.isSceneInitialized) {
      console.log('  Scene not initialized yet, waiting...');
      setTimeout(() => this.loadModel(), 100);
      return;
    }

    if (!this.modelUrl() && !this.modelFile()) {
      console.log('  No model URL or file provided. Returning.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      let result: ModelLoadResult;

      if (this.modelFile()) {
        console.log('  Loading model from file (Blob).');
        result = await this.modelService.loadModelFromFile(this.modelFile());
      } else if (this.modelUrl()) {
        console.log('  Loading model from URL.');
        result = await this.modelService.loadModel(this.modelUrl());
      } else {
        throw new Error('No model source provided');
      }

      // Remove previous model
      if (this.currentModel && this.scene) {
        this.scene.remove(this.currentModel);
        this.modelService.dispose(this.currentModel);
      }

      // Add new model to scene
      if (this.scene && this.camera) {
        this.scene.add(result.scene);
        this.currentModel = result.scene;

        // Log model details before centering and scaling
        console.log('Model details before centering and scaling:');
        console.log(
          '  Bounding Box:',
          result.boundingBox.min,
          result.boundingBox.max
        );
        console.log(
          '  Center:',
          result.center.x,
          result.center.y,
          result.center.z
        );
        console.log('  Size:', result.size.x, result.size.y, result.size.z);

        // Center and scale model
        this.modelService.centerAndScaleModel(result, this.camera);

        // Apply current wireframe setting
        if (this.wireframe()) {
          this.toggleModelWireframe(true);
        }

        // Forza un aggiornamento del renderer dopo il caricamento
        requestAnimationFrame(() => {
          this.updateRendererSize();
        });
      }

      this.modelInfo.set(result);
      this.modelLoaded.emit(result);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Unknown error occurred';
      this.error.set(errorMessage);
      this.modelError.emit(errorMessage);
      console.error('Model loading error:', err);
    } finally {
      this.loading.set(false);
    }
  }

  private toggleModelWireframe(enabled: boolean): void {
    if (!this.currentModel) return;

    this.currentModel.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (enabled) {
          child.material = new THREE.MeshBasicMaterial({
            wireframe: true,
            color: 0x00ff00,
          });
        } else {
          // This is a simplified approach - in a real app you'd want to restore original materials
          child.material = new THREE.MeshLambertMaterial({
            color: 0xcccccc,
          });
        }
      }
    });
  }

  private cleanup(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    if (this.stopAnimation) {
      this.stopAnimation();
    }

    if (this.currentModel) {
      this.modelService.dispose(this.currentModel);
    }

    if (this.renderer) {
      this.renderer.dispose();
      if (this.container?.nativeElement.contains(this.renderer.domElement)) {
        this.container.nativeElement.removeChild(this.renderer.domElement);
      }
    }

    if (this.controls) {
      this.controls.dispose();
    }

    this.isSceneInitialized = false;
  }

  // Public methods
  resetView(): void {
    if (this.controls && this.camera && this.modelInfo()) {
      this.controls.reset();
      if (this.camera && this.modelInfo()) {
        this.modelService.centerAndScaleModel(this.modelInfo()!, this.camera);
      }
    }
  }

  toggleWireframe(): void {
    this.wireframe.set(!this.wireframe());
  }

  toggleAutoRotate(): void {
    this.autoRotate.set(!this.autoRotate());
  }

  toggleFullscreen(): void {
    if (!document.fullscreenElement) {
      this.container.nativeElement.requestFullscreen();
      this.isFullscreen.set(true);
    } else {
      document.exitFullscreen();
      this.isFullscreen.set(false);
    }
  }

  retry(): void {
    this.error.set(null);
    this.loadModel();
  }

  // Metodo pubblico per forzare il resize (utile per debugging)
  public forceResize(): void {
    this.handleContainerResize();
  }

  /**
   * Get container dimensions safely (for debugging)
   */
  protected getContainerDimensions(): { width: number; height: number } {
    if (!this.container?.nativeElement) {
      return { width: 0, height: 0 };
    }

    const rect = this.container.nativeElement.getBoundingClientRect();
    return {
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    };
  }

  // Utility methods
  protected formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  protected formatVector(vector: THREE.Vector3): string {
    return `${vector.x.toFixed(2)} × ${vector.y.toFixed(
      2
    )} × ${vector.z.toFixed(2)}`;
  }

  // Expose signals as getters for template access
  protected loading$ = this.loading.asReadonly();
  protected error$ = this.error.asReadonly();
  protected loadingProgress$ = this.loadingProgress.asReadonly();
  protected modelInfo$ = this.modelInfo.asReadonly();
  protected wireframe$ = this.wireframe.asReadonly();
  protected autoRotate$ = this.autoRotate.asReadonly();
  protected isFullscreen$ = this.isFullscreen.asReadonly();
}
