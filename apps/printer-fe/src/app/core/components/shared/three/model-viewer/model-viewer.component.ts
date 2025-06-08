// model-viewer.component.ts
import {
  Component,
  ElementRef,
  Input,
  OnDestroy,
  OnInit,
  ViewChild,
  HostListener,
  Output,
  EventEmitter,
  signal,
  computed,
  effect,
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
      }

      .cursor-grab:active {
        cursor: grabbing !important;
      }
    `,
  ],
})
export class ModelViewerComponent implements OnInit, OnDestroy {
  @ViewChild('container', { static: true }) container!: ElementRef<HTMLElement>;

  @Input() modelUrl: string | null = null;
  @Input() modelFile: File | null = null;
  @Input() options: ModelViewerOptions = {};

  @Output() modelLoaded = new EventEmitter<ModelLoadResult>();
  @Output() modelError = new EventEmitter<string>();

  // Signals
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly loadingProgress = signal<ModelLoadProgress | null>(null);
  protected readonly modelInfo = signal<ModelLoadResult | null>(null);
  protected readonly wireframe = signal(false);
  protected readonly autoRotate = signal(false);
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
  private currentModel: THREE.Group | null = null;

  constructor(private readonly modelService: ThreeJsModelService) {
    // Subscribe to loading progress
    effect(() => {
      this.modelService.loading$.subscribe((progress) => {
        this.loadingProgress.set(progress);
      });
    });

    // Watch for input changes
    effect(() => {
      if (this.modelUrl || this.modelFile) {
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
    this.initializeScene();
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    if (this.camera && this.renderer && this.container) {
      this.modelService.handleResize(
        this.camera,
        this.renderer,
        this.container
      );
    }
  }

  private initializeScene(): void {
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

    // Start animation loop
    this.stopAnimation = this.modelService.startAnimationLoop(
      this.renderer,
      this.scene,
      this.camera,
      this.controls || undefined
    );
  }

  private async loadModel(): Promise<void> {
    if (!this.modelUrl && !this.modelFile) return;

    this.loading.set(true);
    this.error.set(null);

    try {
      let result: ModelLoadResult;

      if (this.modelFile) {
        result = await this.modelService.loadModelFromFile(this.modelFile);
      } else if (this.modelUrl) {
        result = await this.modelService.loadModel(this.modelUrl);
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

        // Center and scale model
        this.modelService.centerAndScaleModel(result, this.camera);

        // Apply current wireframe setting
        if (this.wireframe()) {
          this.toggleModelWireframe(true);
        }
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
    this.loadModel();
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
