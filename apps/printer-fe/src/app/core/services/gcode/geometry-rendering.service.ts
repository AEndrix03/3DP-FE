import { Injectable, signal } from '@angular/core';
import * as THREE from 'three';
import { BatchedPath, PathSegment } from '../../types/gcode/gcode.types';

@Injectable({
  providedIn: 'root',
})
export class GeometryRenderingService {
  // Optimized mesh handling
  private extrusionMesh: THREE.Line | null = null;
  private travelMesh: THREE.Line | null = null;
  private meshUpdateCounter = 0;
  private maxPathPoints = 100000; // Valore iniziale ragionevole
  private pathBatchSize = 100;

  private batchedExtrusionPath: BatchedPath = {
    points: [],
    colors: [],
    isExtrusion: true,
  };
  private batchedTravelPath: BatchedPath = {
    points: [],
    colors: [],
    isExtrusion: false,
  };

  // Path tracking (optimized)
  private readonly _pathSegments = signal<PathSegment[]>([]);
  private readonly _currentPath = signal<PathSegment | null>(null);

  readonly pathSegments = this._pathSegments.asReadonly();
  readonly currentPath = this._currentPath.asReadonly();

  // Three.js objects
  private scene: THREE.Scene;
  private extrudedPaths: THREE.Group;
  private travelPaths: THREE.Group;

  constructor() {
    this.scene = new THREE.Scene();
    this.extrudedPaths = new THREE.Group();
    this.travelPaths = new THREE.Group();

    this.scene.add(this.extrudedPaths);
    this.scene.add(this.travelPaths);

    this.initializeOptimizedBatchedMeshes();
  }

  /**
   * Optimized batched mesh initialization with better memory management and rendering fixes
   */
  private initializeOptimizedBatchedMeshes(): void {
    // Pre-allocate buffers for better performance
    const maxVertices = this.maxPathPoints * 2; // Line segments need 2 vertices each

    const extrusionGeometry = new THREE.BufferGeometry();
    const travelGeometry = new THREE.BufferGeometry();

    // Pre-allocate typed arrays with proper size
    const extrusionPositions = new Float32Array(maxVertices * 3);
    const extrusionColors = new Float32Array(maxVertices * 3);
    const travelPositions = new Float32Array(maxVertices * 3);

    extrusionGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(extrusionPositions, 3)
    );
    extrusionGeometry.setAttribute(
      'color',
      new THREE.BufferAttribute(extrusionColors, 3)
    );
    travelGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(travelPositions, 3)
    );

    // Fix: Optimized materials with proper rendering settings
    const extrusionMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      depthTest: true,
      depthWrite: true,
      side: THREE.DoubleSide, // Fix disappearing issue
    });

    const travelMaterial = new THREE.LineBasicMaterial({
      color: 0x888888,
      transparent: true,
      opacity: 0.3,
      depthTest: true,
      depthWrite: false, // Travel moves don't need depth write
      side: THREE.DoubleSide, // Fix disappearing issue
    });

    this.extrusionMesh = new THREE.Line(extrusionGeometry, extrusionMaterial);
    this.travelMesh = new THREE.Line(travelGeometry, travelMaterial);

    // Fix: Prevent frustum culling issues
    this.extrusionMesh.frustumCulled = false;
    this.travelMesh.frustumCulled = false;

    // Set render order to ensure proper display
    this.extrusionMesh.renderOrder = 1;
    this.travelMesh.renderOrder = 0;

    this.extrudedPaths.add(this.extrusionMesh);
    this.travelPaths.add(this.travelMesh);
  }

  /**
   * Optimized path visualization with adaptive batching for large files
   */
  addPathSegment(
    segment: PathSegment,
    filamentColor: string,
    speed: number,
    totalCommands: number
  ): void {
    const targetBatch = segment.isExtrusion
      ? this.batchedExtrusionPath
      : this.batchedTravelPath;

    // Configura limiti dinamici se non fatto
    if (this.meshUpdateCounter === 0) {
      this.configureDynamicLimits(totalCommands);
    }

    if (segment.segments && segment.segments.length > 1) {
      // Add curve segments with adaptive LOD
      const segmentStep = speed > 50 ? Math.max(2, Math.floor(speed / 25)) : 1;

      for (
        let i = 0;
        i < segment.segments.length - segmentStep;
        i += segmentStep
      ) {
        const next = Math.min(i + segmentStep, segment.segments.length - 1);
        targetBatch.points.push(segment.segments[i], segment.segments[next]);

        if (segment.isExtrusion) {
          const color = this.getExtrusionColor(
            segment.extrusionAmount,
            filamentColor
          );
          targetBatch.colors.push(color, color);
        }
      }
    } else {
      // Add simple line segment
      targetBatch.points.push(segment.startPoint, segment.endPoint);

      if (segment.isExtrusion) {
        const color = this.getExtrusionColor(
          segment.extrusionAmount,
          filamentColor
        );
        targetBatch.colors.push(color, color);
      }
    }

    // Controllo memoria solo se necessario - soglia più alta
    if (targetBatch.points.length > this.maxPathPoints * 1.2) {
      this.trimPathBatch(targetBatch, totalCommands);
    }

    // Aggiornamento mesh adattivo
    this.meshUpdateCounter++;
    const updateFrequency = this.getAdaptiveBatchSize(totalCommands, speed);

    if (this.meshUpdateCounter >= updateFrequency) {
      this.updateBatchedMeshes();
      this.meshUpdateCounter = 0;
    }

    // Update path segments array
    const currentSegments = this._pathSegments();
    this._pathSegments.set([...currentSegments, segment]);
    this._currentPath.set(segment);
  }

  /**
   * Get adaptive batch size based on file size and speed
   */
  private getAdaptiveBatchSize(totalCommands: number, speed: number): number {
    let batchSize = this.pathBatchSize;

    // Larger batches for bigger files
    if (totalCommands > 50000) batchSize *= 4;
    else if (totalCommands > 10000) batchSize *= 2;

    // Larger batches for higher speeds
    if (speed > 500) batchSize *= 8;
    else if (speed > 100) batchSize *= 4;
    else if (speed > 10) batchSize *= 2;

    return Math.min(batchSize, 1000); // Cap at 1000
  }

  /**
   * Sistema di trimming intelligente migliorato
   */
  private trimPathBatch(batch: BatchedPath, totalCommands: number): void {
    const currentPoints = batch.points.length;

    // Non tagliare mai per file piccoli
    if (totalCommands < 100000) {
      return;
    }

    // Calcola uso memoria
    const pointsMemoryMB = (currentPoints * 12) / (1024 * 1024); // 12 bytes per punto (x,y,z)
    const colorsMemoryMB = (batch.colors.length * 12) / (1024 * 1024); // 12 bytes per colore (r,g,b)
    const totalMemoryMB = pointsMemoryMB + colorsMemoryMB;

    // Soglie basate sulla dimensione del file
    let memoryLimitMB = 50; // Default 50MB
    if (totalCommands > 1000000) memoryLimitMB = 200; // 200MB per file giganti
    else if (totalCommands > 500000)
      memoryLimitMB = 150; // 150MB per file molto grandi
    else if (totalCommands > 100000) memoryLimitMB = 100; // 100MB per file grandi

    if (totalMemoryMB > memoryLimitMB) {
      const keepRatio = 0.75; // Mantieni 75% dei punti
      const keepCount = Math.floor(this.maxPathPoints * keepRatio);
      const removeCount = currentPoints - keepCount;

      console.warn(
        `🗑️  Memory limit exceeded (${totalMemoryMB.toFixed(
          1
        )}MB > ${memoryLimitMB}MB)`
      );
      console.warn(`🔄 Trimming ${removeCount} points (keeping ${keepCount})`);

      // Rimuovi dall'inizio (punti più vecchi)
      batch.points.splice(0, removeCount);
      if (batch.colors.length > 0) {
        batch.colors.splice(0, removeCount);
      }

      console.log(
        `✅ Trimming completed, new memory usage: ${(
          (batch.points.length * 12 + batch.colors.length * 12) /
          (1024 * 1024)
        ).toFixed(1)}MB`
      );
    }
  }

  /**
   * Efficient mesh updates with proper buffer management
   */
  updateBatchedMeshes(): void {
    this.updateMeshFromBatch(this.extrusionMesh!, this.batchedExtrusionPath);
    this.updateMeshFromBatch(this.travelMesh!, this.batchedTravelPath);
  }

  private updateMeshFromBatch(mesh: THREE.Line, batch: BatchedPath): void {
    if (batch.points.length === 0) return;

    const geometry = mesh.geometry;
    const positionAttribute = geometry.getAttribute(
      'position'
    ) as THREE.BufferAttribute;
    const colorAttribute = geometry.getAttribute(
      'color'
    ) as THREE.BufferAttribute;

    const requiredPositions = batch.points.length * 3;
    const currentPositions = positionAttribute
      ? positionAttribute.array.length
      : 0;

    // Se serve più spazio di quello allocato, ricreiamo la geometria
    if (requiredPositions > currentPositions) {
      this.recreateGeometry(mesh, batch);
      return;
    }

    // Aggiorna le posizioni esistenti
    batch.points.forEach((point, i) => {
      const index = i * 3;
      (positionAttribute.array as Float32Array)[index] = point.x;
      (positionAttribute.array as Float32Array)[index + 1] = point.y;
      (positionAttribute.array as Float32Array)[index + 2] = point.z;
    });

    positionAttribute.needsUpdate = true;

    // Aggiorna i colori se necessario
    if (batch.isExtrusion && colorAttribute && batch.colors.length > 0) {
      batch.colors.forEach((color, i) => {
        const index = i * 3;
        (colorAttribute.array as Float32Array)[index] = color.r;
        (colorAttribute.array as Float32Array)[index + 1] = color.g;
        (colorAttribute.array as Float32Array)[index + 2] = color.b;
      });
      colorAttribute.needsUpdate = true;
    }

    // Imposta il range di disegno per evitare di disegnare vertici vuoti
    geometry.setDrawRange(0, batch.points.length);
  }

  private recreateGeometry(mesh: THREE.Line, batch: BatchedPath): void {
    // Disponi della vecchia geometria
    mesh.geometry.dispose();

    // Crea una nuova geometria con la dimensione corretta
    const newGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(batch.points.length * 3);

    batch.points.forEach((point, i) => {
      positions[i * 3] = point.x;
      positions[i * 3 + 1] = point.y;
      positions[i * 3 + 2] = point.z;
    });

    newGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(positions, 3)
    );

    // Aggiungi attributi colore se necessario
    if (batch.isExtrusion && batch.colors.length > 0) {
      const colors = new Float32Array(batch.colors.length * 3);
      batch.colors.forEach((color, i) => {
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
      });
      newGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }

    mesh.geometry = newGeometry;
  }

  private getExtrusionColor(
    extrusionAmount: number,
    filamentColor: string
  ): THREE.Color {
    // Use selected filament color with intensity variation
    const baseColor = new THREE.Color(filamentColor);
    const intensity = Math.min(extrusionAmount * 10, 1.0);

    // Vary brightness based on extrusion amount
    const factor = 0.7 + intensity * 0.3;
    return baseColor.multiplyScalar(factor);
  }

  /**
   * Update filament color
   */
  updateFilamentColor(color: string): void {
    // Update existing extrusion materials with new color
    if (
      this.extrusionMesh &&
      this.extrusionMesh.material instanceof THREE.LineBasicMaterial
    ) {
      // If not using vertex colors, update material color
      if (!this.extrusionMesh.material.vertexColors) {
        this.extrusionMesh.material.color.setStyle(color);
        this.extrusionMesh.material.needsUpdate = true;
      }
    }

    // Update batched colors
    this.batchedExtrusionPath.colors.forEach((existingColor, index) => {
      const newColor = new THREE.Color(color);
      const intensity = 0.7 + (index % 10) * 0.03; // Some variation
      existingColor.copy(newColor.multiplyScalar(intensity));
    });

    // Mark for update
    this.meshUpdateCounter = this.pathBatchSize; // Force immediate update
  }

  /**
   * Configurazione dinamica dei limiti di memoria basata sulla dimensione del file
   */
  configureDynamicLimits(totalCommands: number): void {
    // Configurazione più aggressiva per file grandi
    if (totalCommands > 1000000) {
      // File giganti (>1M comandi)
      this.maxPathPoints = 500000; // 500k punti = ~60MB
      this.pathBatchSize = 1000;
      console.log(
        `🔥 Huge file detected (${totalCommands} commands), using maximum capacity settings`
      );
    } else if (totalCommands > 500000) {
      // File molto grandi (>500k comandi)
      this.maxPathPoints = 300000; // 300k punti = ~36MB
      this.pathBatchSize = 500;
      console.log(
        `📈 Very large file detected (${totalCommands} commands), using high-capacity settings`
      );
    } else if (totalCommands > 100000) {
      // File grandi (>100k comandi)
      this.maxPathPoints = 200000; // 200k punti = ~24MB
      this.pathBatchSize = 200;
      console.log(
        `📊 Large file detected (${totalCommands} commands), using expanded settings`
      );
    } else if (totalCommands > 20000) {
      // File medi (>20k comandi)
      this.maxPathPoints = 100000; // 100k punti = ~12MB
      this.pathBatchSize = 100;
      console.log(
        `📋 Medium file detected (${totalCommands} commands), using standard settings`
      );
    } else {
      // File piccoli
      this.maxPathPoints = 50000; // 50k punti = ~6MB
      this.pathBatchSize = 50;
      console.log(
        `📄 Small file detected (${totalCommands} commands), using optimized settings`
      );
    }

    console.log(
      `🎛️  Memory configuration: ${this.maxPathPoints} max points, ${this.pathBatchSize} batch size`
    );
  }

  /**
   * Pulizia completa di tutti i path con dispose delle risorse
   */
  clearAllPaths(): void {
    console.log('🧹 Clearing all geometry paths...');

    // Pulisci batch paths
    this.batchedExtrusionPath.points = [];
    this.batchedExtrusionPath.colors = [];
    this.batchedTravelPath.points = [];
    this.batchedTravelPath.colors = [];

    // Rimuovi mesh esistenti dalla scena prima di dispose
    if (this.extrusionMesh) {
      this.extrudedPaths.remove(this.extrusionMesh);
      if (this.extrusionMesh.geometry) {
        this.extrusionMesh.geometry.dispose();
      }
      if (this.extrusionMesh.material) {
        if (Array.isArray(this.extrusionMesh.material)) {
          this.extrusionMesh.material.forEach((material) => material.dispose());
        } else {
          this.extrusionMesh.material.dispose();
        }
      }
      this.extrusionMesh = null;
    }

    if (this.travelMesh) {
      this.travelPaths.remove(this.travelMesh);
      if (this.travelMesh.geometry) {
        this.travelMesh.geometry.dispose();
      }
      if (this.travelMesh.material) {
        if (Array.isArray(this.travelMesh.material)) {
          this.travelMesh.material.forEach((material) => material.dispose());
        } else {
          this.travelMesh.material.dispose();
        }
      }
      this.travelMesh = null;
    }

    // Pulisci i gruppi
    this.extrudedPaths.clear();
    this.travelPaths.clear();

    // Ricrea le mesh con geometrie vuote
    this.initializeOptimizedBatchedMeshes();

    // Reset path signals
    this._pathSegments.set([]);
    this._currentPath.set(null);

    // Reset contatori
    this.meshUpdateCounter = 0;

    console.log('✅ All paths cleared successfully');
  }

  /**
   * Visualize path segment (used during jump reconstruction)
   */
  visualizePath(segment: PathSegment, filamentColor: string): void {
    // Add to appropriate batch for visualization
    const targetBatch = segment.isExtrusion
      ? this.batchedExtrusionPath
      : this.batchedTravelPath;

    if (segment.segments && segment.segments.length > 1) {
      // Add curve segments
      for (let i = 0; i < segment.segments.length - 1; i++) {
        targetBatch.points.push(segment.segments[i], segment.segments[i + 1]);
        if (segment.isExtrusion) {
          const color = this.getExtrusionColor(
            segment.extrusionAmount,
            filamentColor
          );
          targetBatch.colors.push(color, color);
        }
      }
    } else {
      // Add simple line segment
      targetBatch.points.push(segment.startPoint, segment.endPoint);
      if (segment.isExtrusion) {
        const color = this.getExtrusionColor(
          segment.extrusionAmount,
          filamentColor
        );
        targetBatch.colors.push(color, color);
      }
    }
  }

  /**
   * Get scene for rendering
   */
  getScene(): THREE.Scene {
    return this.scene;
  }

  /**
   * Set various rendering options
   */
  setMaxPathPoints(maxPoints: number): void {
    this.maxPathPoints = Math.max(1000, Math.min(100000, maxPoints));
  }

  setBatchSize(batchSize: number): void {
    this.pathBatchSize = Math.max(10, Math.min(1000, batchSize));
  }

  /**
   * Metodo per ottenere informazioni sull'uso della memoria
   */
  getMemoryUsage(): { extrusionMB: number; travelMB: number; totalMB: number } {
    const extrusionPoints = this.batchedExtrusionPath.points.length;
    const travelPoints = this.batchedTravelPath.points.length;

    const extrusionMB =
      (extrusionPoints * 12 + this.batchedExtrusionPath.colors.length * 12) /
      (1024 * 1024);
    const travelMB = (travelPoints * 12) / (1024 * 1024);

    return {
      extrusionMB: Number(extrusionMB.toFixed(2)),
      travelMB: Number(travelMB.toFixed(2)),
      totalMB: Number((extrusionMB + travelMB).toFixed(2)),
    };
  }

  /**
   * Diagnostica completa dell'uso memoria
   */
  getDetailedMemoryUsage(): any {
    const extrusionPoints = this.batchedExtrusionPath.points.length;
    const extrusionColors = this.batchedExtrusionPath.colors.length;
    const travelPoints = this.batchedTravelPath.points.length;

    const extrusionPointsMB = (extrusionPoints * 12) / (1024 * 1024);
    const extrusionColorsMB = (extrusionColors * 12) / (1024 * 1024);
    const travelPointsMB = (travelPoints * 12) / (1024 * 1024);

    const totalMB = extrusionPointsMB + extrusionColorsMB + travelPointsMB;

    return {
      extrusion: {
        points: extrusionPoints,
        colors: extrusionColors,
        memoryMB: Number((extrusionPointsMB + extrusionColorsMB).toFixed(2)),
      },
      travel: {
        points: travelPoints,
        memoryMB: Number(travelPointsMB.toFixed(2)),
      },
      total: {
        points: extrusionPoints + travelPoints,
        memoryMB: Number(totalMB.toFixed(2)),
      },
      limits: {
        maxPathPoints: this.maxPathPoints,
        batchSize: this.pathBatchSize,
      },
    };
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    // Cleanup Three.js resources
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        if (Array.isArray(object.material)) {
          object.material.forEach((material) => material.dispose());
        } else {
          object.material.dispose();
        }
      }
    });
  }
}
