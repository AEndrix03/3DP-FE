import { Injectable, ElementRef } from '@angular/core';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { BehaviorSubject } from 'rxjs';

export interface ModelLoadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface ModelLoadResult {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
  boundingBox: THREE.Box3;
  center: THREE.Vector3;
  size: THREE.Vector3;
}

@Injectable({
  providedIn: 'root',
})
export class ThreeJsModelService {
  private readonly loader = new GLTFLoader();
  private readonly loadingSubject =
    new BehaviorSubject<ModelLoadProgress | null>(null);
  public readonly loading$ = this.loadingSubject.asObservable();

  /**
   * Load a GLB/GLTF model from URL
   * @param url The URL of the GLB/GLTF file
   * @returns Promise<ModelLoadResult>
   */
  async loadModel(url: string): Promise<ModelLoadResult> {
    return new Promise((resolve, reject) => {
      this.loader.load(
        url,
        (gltf) => {
          const boundingBox = new THREE.Box3().setFromObject(gltf.scene);
          const center = boundingBox.getCenter(new THREE.Vector3());
          const size = boundingBox.getSize(new THREE.Vector3());

          resolve({
            scene: gltf.scene,
            animations: gltf.animations,
            boundingBox,
            center,
            size,
          });

          this.loadingSubject.next(null);
        },
        (progress) => {
          const loadProgress: ModelLoadProgress = {
            loaded: progress.loaded,
            total: progress.total,
            percentage:
              progress.total > 0 ? (progress.loaded / progress.total) * 100 : 0,
          };
          this.loadingSubject.next(loadProgress);
        },
        (error) => {
          console.error('Error loading model:', error);
          this.loadingSubject.next(null);
          reject(error);
        }
      );
    });
  }

  /**
   * Load a GLB model from File object
   * @param file The File object containing GLB data
   * @returns Promise<ModelLoadResult>
   */
  async loadModelFromFile(file: File): Promise<ModelLoadResult> {
    const url = URL.createObjectURL(file);
    try {
      const result = await this.loadModel(url);
      return result;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  /**
   * Create a basic scene setup
   * @param container The container element
   * @param options Configuration options
   * @returns Object containing scene, camera, renderer, and controls
   */
  createScene(
    container: ElementRef<HTMLElement>,
    options: {
      enableControls?: boolean;
      backgroundColor?: number | string;
      antialias?: boolean;
      shadows?: boolean;
    } = {}
  ) {
    const {
      enableControls = true,
      backgroundColor = 0xf0f0f0,
      antialias = true,
      shadows = true,
    } = options;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(backgroundColor);

    // Camera
    const camera = new THREE.PerspectiveCamera(
      75,
      container.nativeElement.clientWidth /
        container.nativeElement.clientHeight,
      0.1,
      1000
    );
    camera.position.set(5, 5, 5);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias });
    renderer.setSize(
      container.nativeElement.clientWidth,
      container.nativeElement.clientHeight
    );
    renderer.setPixelRatio(window.devicePixelRatio);

    if (shadows) {
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    container.nativeElement.appendChild(renderer.domElement);

    // Controls
    let controls: OrbitControls | null = null;
    if (enableControls) {
      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
    }

    // Basic lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 5);
    if (shadows) {
      directionalLight.castShadow = true;
      directionalLight.shadow.mapSize.width = 2048;
      directionalLight.shadow.mapSize.height = 2048;
    }
    scene.add(directionalLight);

    return {
      scene,
      camera,
      renderer,
      controls,
      ambientLight,
      directionalLight,
    };
  }

  /**
   * Center and scale model to fit in view
   * @param model The loaded model
   * @param camera The camera
   * @param targetSize Optional target size for scaling
   */
  centerAndScaleModel(
    model: ModelLoadResult,
    camera: THREE.PerspectiveCamera,
    targetSize = 4
  ) {
    // Center the model
    model.scene.position.sub(model.center);

    // Scale the model
    const maxDimension = Math.max(model.size.x, model.size.y, model.size.z);
    if (maxDimension > 0) {
      const scale = targetSize / maxDimension;
      model.scene.scale.setScalar(scale);
    }

    // Adjust camera position
    const distance = targetSize * 2;
    camera.position.set(distance, distance, distance);
    camera.lookAt(0, 0, 0);
  }

  /**
   * Start animation loop
   * @param renderer The renderer
   * @param scene The scene
   * @param camera The camera
   * @param controls Optional controls
   * @param onBeforeRender Optional callback before each render
   * @returns Function to stop the animation loop
   */
  startAnimationLoop(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    controls?: OrbitControls,
    onBeforeRender?: () => void
  ): () => void {
    let animationId: number;

    const animate = () => {
      animationId = requestAnimationFrame(animate);

      if (controls) {
        controls.update();
      }

      if (onBeforeRender) {
        onBeforeRender();
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }

  /**
   * Handle window resize
   * @param camera The camera
   * @param renderer The renderer
   * @param container The container element
   */
  handleResize(
    camera: THREE.PerspectiveCamera,
    renderer: THREE.WebGLRenderer,
    container: ElementRef<HTMLElement>
  ) {
    const width = container.nativeElement.clientWidth;
    const height = container.nativeElement.clientHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  /**
   * Dispose of Three.js resources
   * @param objects Objects to dispose
   */
  dispose(
    ...objects: (
      | THREE.Object3D
      | THREE.Material
      | THREE.Texture
      | THREE.WebGLRenderer
    )[]
  ): void {
    objects.forEach((obj) => {
      if ('dispose' in obj && typeof obj.dispose === 'function') {
        obj.dispose();
      }

      if ('geometry' in obj && obj.geometry) {
        (obj.geometry as THREE.BufferGeometry).dispose();
      }

      if ('material' in obj && obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach((material: THREE.Material) =>
            material.dispose()
          );
        } else {
          (obj.material as THREE.Material).dispose();
        }
      }
    });
  }
}
