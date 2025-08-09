import {
  Component,
  computed,
  EventEmitter,
  Input,
  input,
  InputSignal,
  Output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModelDto } from '../../../../core/models/model.models';
import { ModelViewerComponent } from '../../../../core/components/shared/three/model-viewer/model-viewer.component';
import { ModelLoadResult } from '../../../../core/services/three/three-js-model.service';

interface ModelState {
  loading: boolean;
  error: string | null;
  loaded: boolean;
}

@Component({
  selector: 'printer-jobs-models-grid',
  standalone: true,
  imports: [CommonModule, ModelViewerComponent],
  templateUrl: './jobs-models-grid.component.html',
})
export class JobsModelsGridComponent {
  @Input() models: ModelDto[] = [];
  public readonly modelsGlb: InputSignal<Record<string, Blob>> = input({});
  @Input() showDebugInfo: boolean = false;

  @Output() selectedModel = new EventEmitter<string>();
  @Output() modelStateChanged = new EventEmitter<{
    modelId: string;
    state: ModelState;
  }>();

  // Signal per tracciare lo stato di ciascun modello
  private readonly modelStates = signal<Record<string, ModelState>>({});

  // Computed signals per l'UI
  protected readonly isLoadingAny = computed(() => {
    const states = this.modelStates();
    return Object.values(states).some((state) => state.loading);
  });

  /**
   * Track by function for ngFor optimization
   */
  protected trackByModelId(index: number, model: ModelDto): string {
    return model.id;
  }

  /**
   * Format date for display with improved formatting
   */
  protected formatDate(date: Date | string): string {
    if (!date) return '';

    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();

    // Check if date is valid
    if (isNaN(dateObj.getTime())) return 'Invalid date';

    // Show relative time for recent dates
    const diffMs = now.getTime() - dateObj.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffMinutes < 1) {
      return 'Just now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `${weeks}w ago`;
    } else {
      return dateObj.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year:
          dateObj.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      });
    }
  }

  /**
   * Format resource ID for display with improved truncation
   */
  protected formatResourceId(resourceId: string): string {
    if (!resourceId) return 'No ID';

    // Mostra i primi 8 caratteri, poi ellipsis, poi gli ultimi 8
    if (resourceId.length > 20) {
      return `${resourceId.substring(0, 8)}...${resourceId.slice(-8)}`;
    }
    return resourceId;
  }

  /**
   * Copy resource ID to clipboard with improved feedback
   */
  protected async copyToClipboard(text: string): Promise<void> {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }

      // Optional: Emit success event or show toast
      console.log('Resource ID copied to clipboard:', text);
    } catch (err) {
      console.error('Failed to copy text:', err);
      // Optional: Emit error event or show error toast
    }
  }

  /**
   * Check if model was updated after creation (with improved logic)
   */
  protected isUpdated(model: ModelDto): boolean {
    if (!model.createdAt || !model.updatedAt) return false;

    const created = new Date(model.createdAt);
    const updated = new Date(model.updatedAt);

    // Check if dates are valid
    if (isNaN(created.getTime()) || isNaN(updated.getTime())) return false;

    // Consider updated if more than 5 minutes difference
    return Math.abs(updated.getTime() - created.getTime()) > 5 * 60 * 1000;
  }

  /**
   * Check if model has preview available
   */
  protected hasPreview(model: ModelDto): boolean {
    const blob = this.modelsGlb()[model.resourceId];
    return !!blob && blob.size > 0;
  }

  /**
   * Get model age in days
   */
  protected getModelAge(createdAt: Date | string): number {
    if (!createdAt) return 0;

    const created =
      typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
    const now = new Date();

    if (isNaN(created.getTime())) return 0;

    return Math.floor(
      (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)
    );
  }

  /**
   * Check if model is recent (created within last 7 days)
   */
  protected isRecent(model: ModelDto): boolean {
    return this.getModelAge(model.createdAt) <= 7;
  }

  /**
   * Get description preview with intelligent truncation
   */
  protected getDescriptionPreview(
    description: string,
    maxLength: number = 80
  ): string {
    if (!description) return '';

    if (description.length <= maxLength) return description;

    // Try to break at word boundary
    const truncated = description.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');

    if (lastSpace > maxLength * 0.7) {
      return `${truncated.substring(0, lastSpace)}...`;
    }

    return `${truncated}...`;
  }

  /**
   * Format model name with improved cleaning
   */
  protected formatModelName(name: string): string {
    if (!name) return 'Untitled Model';

    // Remove common file extensions and clean up the name
    let cleanName = name.replace(/\.(stl|obj|3mf|ply|glb|gltf)$/i, '');

    // Replace underscores and hyphens with spaces
    cleanName = cleanName.replace(/[_-]/g, ' ');

    // Capitalize first letter of each word
    cleanName = cleanName.replace(/\b\w/g, (char) => char.toUpperCase());

    // Trim and collapse multiple spaces
    cleanName = cleanName.replace(/\s+/g, ' ').trim();

    return cleanName || 'Untitled Model';
  }

  /**
   * Handle model loading success
   */
  protected onModelLoaded(modelId: string, result: ModelLoadResult): void {
    this.updateModelState(modelId, {
      loading: false,
      error: null,
      loaded: true,
    });

    console.log(`Model ${modelId} loaded successfully:`, result);
  }

  /**
   * Handle model loading error
   */
  protected onModelError(modelId: string, error: string): void {
    this.updateModelState(modelId, {
      loading: false,
      error,
      loaded: false,
    });

    console.error(`Model ${modelId} failed to load:`, error);
  }

  /**
   * Check if a specific model is loading
   */
  protected isModelLoading(modelId: string): boolean {
    return this.modelStates()[modelId]?.loading ?? false;
  }

  /**
   * Check if a specific model has an error
   */
  protected hasModelError(modelId: string): boolean {
    return !!this.modelStates()[modelId]?.error;
  }

  /**
   * Get error message for a specific model
   */
  protected getModelError(modelId: string): string | null {
    return this.modelStates()[modelId]?.error ?? null;
  }

  /**
   * Update the state of a specific model
   */
  private updateModelState(modelId: string, state: Partial<ModelState>): void {
    const currentStates = this.modelStates();
    const currentState = currentStates[modelId] || {
      loading: false,
      error: null,
      loaded: false,
    };

    const newState = { ...currentState, ...state };

    this.modelStates.set({
      ...currentStates,
      [modelId]: newState,
    });

    this.modelStateChanged.emit({ modelId, state: newState });
  }

  /**
   * Initialize model loading state
   */
  protected initializeModelLoading(modelId: string): void {
    this.updateModelState(modelId, {
      loading: true,
      error: null,
      loaded: false,
    });
  }

  /**
   * Get formatted file size from blob
   */
  protected getModelSize(model: ModelDto): string {
    const blob = this.modelsGlb()[model.resourceId];
    if (!blob) return 'Unknown';

    return this.formatBytes(blob.size);
  }

  /**
   * Format bytes to human readable format
   */
  protected formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  /**
   * Get model statistics
   */
  protected getModelStats(): {
    total: number;
    loading: number;
    loaded: number;
    errors: number;
  } {
    const states = Object.values(this.modelStates());
    return {
      total: this.models.length,
      loading: states.filter((s) => s.loading).length,
      loaded: states.filter((s) => s.loaded).length,
      errors: states.filter((s) => !!s.error).length,
    };
  }

  /**
   * Retry loading a specific model
   */
  protected retryModel(modelId: string): void {
    this.updateModelState(modelId, {
      loading: false,
      error: null,
      loaded: false,
    });

    // The model viewer will automatically retry when the state changes
    setTimeout(() => {
      this.initializeModelLoading(modelId);
    }, 100);
  }

  /**
   * Retry loading all failed models
   */
  protected retryAllFailed(): void {
    const currentStates = this.modelStates();
    const updatedStates = { ...currentStates };

    Object.keys(updatedStates).forEach((modelId) => {
      if (updatedStates[modelId].error) {
        updatedStates[modelId] = {
          loading: false,
          error: null,
          loaded: false,
        };
      }
    });

    this.modelStates.set(updatedStates);
  }
}
