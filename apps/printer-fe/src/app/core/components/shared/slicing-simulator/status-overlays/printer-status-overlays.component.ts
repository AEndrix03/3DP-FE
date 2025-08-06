// src/app/printer-simulator/components/status-overlays/printer-status-overlays.component.ts

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  output,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  animate,
  query,
  stagger,
  state,
  style,
  transition,
  trigger,
} from '@angular/animations';
import { TagModule } from 'primeng/tag';
import { ProgressBarModule } from 'primeng/progressbar';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { BadgeModule } from 'primeng/badge';
import { OverlayPanelModule } from 'primeng/overlaypanel';
import { DividerModule } from 'primeng/divider';
import { interval } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';
import {
  formatDuration,
  formatFileSize,
  PERFORMANCE_THRESHOLDS,
  PerformanceMetrics,
  PrinterState,
  SimulationState,
} from '../../../../models/simulator/simulator.models';

interface OverlayConfig {
  readonly position:
    | 'top-left'
    | 'top-right'
    | 'bottom-left'
    | 'bottom-right'
    | 'center';
  readonly visible: boolean;
  readonly priority: number;
  readonly mobileHidden?: boolean;
}

interface StatusOverlay {
  readonly id: string;
  readonly component:
    | 'status'
    | 'progress'
    | 'position'
    | 'extruder'
    | 'timing'
    | 'performance';
  readonly config: OverlayConfig;
}

interface NotificationState {
  readonly id: string;
  readonly type: 'info' | 'warning' | 'error' | 'success';
  readonly title: string;
  readonly message: string;
  readonly dismissible: boolean;
  readonly autoHide: boolean;
  readonly duration: number;
  readonly timestamp: Date;
}

interface PerformanceState {
  readonly currentFPS: number;
  readonly averageFPS: number;
  readonly memoryUsage: number;
  readonly cpuUsage: number;
  readonly renderTime: number;
  readonly isHealthy: boolean;
  readonly warnings: string[];
}

@Component({
  selector: 'printer-status-overlays',
  standalone: true,
  imports: [
    CommonModule,
    TagModule,
    ProgressBarModule,
    ButtonModule,
    TooltipModule,
    BadgeModule,
    OverlayPanelModule,
    DividerModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Main Status Panel - Top Left -->
    <div
      class="status-overlay main-status"
      [class.mobile-hidden]="isMobile() && !forceShowOverlays()"
      [@slideInFromLeft]="overlayAnimationState()"
      *ngIf="isOverlayVisible('status')"
    >
      <div class="overlay-content">
        <div class="overlay-header">
          <h3 class="overlay-title">
            <i class="pi pi-info-circle mr-2"></i>
            Status
          </h3>
          <p-button
            icon="pi pi-times"
            (onClick)="hideOverlay('status')"
            severity="secondary"
            [text]="true"
            size="small"
            class="overlay-close"
            *ngIf="!isPersistentOverlay('status')"
          />
        </div>

        <div class="status-grid">
          <div class="status-item">
            <span class="status-label">State:</span>
            <p-tag
              [value]="simulationStateDisplay()"
              [severity]="getStateSeverity()"
              [ngClass]="{
                'animate-pulse': isSimulationActive(),
                'animate-bounce':
                  simulationState() === 'running' && !reduceMotion()
              }"
              size="small"
            />
          </div>

          <div class="status-item">
            <span class="status-label">Objects:</span>
            <span class="status-value highlight">{{
              performanceMetrics().pathObjects.toLocaleString()
            }}</span>
          </div>

          <div class="status-item">
            <span class="status-label">FPS:</span>
            <span
              class="status-value"
              [class]="getFPSClass(performanceMetrics().fps)"
            >
              {{ performanceMetrics().fps }}
            </span>
          </div>

          <div class="status-item">
            <span class="status-label">Layer:</span>
            <span class="status-value highlight large">
              {{ printerState().currentLayer }} /
              {{ printerState().totalLayers }}
            </span>
          </div>

          <div class="status-item">
            <span class="status-label">Progress:</span>
            <span class="status-value success large">
              {{ printerState().printProgress.toFixed(1) }}%
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Progress Bar - Top Left (below status) -->
    <div
      class="status-overlay progress-overlay"
      [class.mobile-hidden]="isMobile() && !forceShowOverlays()"
      [@slideInFromLeft]="overlayAnimationState()"
      *ngIf="isOverlayVisible('progress')"
    >
      <div class="overlay-content">
        <div class="progress-section">
          <div class="progress-header">
            <span class="progress-title">Overall Progress</span>
            <span class="progress-percentage"
              >{{ printerState().printProgress.toFixed(1) }}%</span
            >
          </div>
          <p-progressBar
            [value]="printerState().printProgress"
            [showValue]="false"
            styleClass="modern-progress"
          />
        </div>

        <div class="command-info">
          <div class="command-counter">
            <span class="counter-label">Commands:</span>
            <span class="counter-value">
              {{ printerState().currentCommandIndex.toLocaleString() }} /
              {{ printerState().totalCommands.toLocaleString() }}
            </span>
          </div>
          <div class="execution-rate" *ngIf="executionRate() > 0">
            <span class="rate-label">Rate:</span>
            <span class="rate-value">{{ executionRate() }}/s</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Position Info - Top Right -->
    <div
      class="status-overlay position-overlay"
      [class.mobile-hidden]="isMobile()"
      [@slideInFromRight]="overlayAnimationState()"
      *ngIf="isOverlayVisible('position')"
    >
      <div class="overlay-content">
        <div class="overlay-header">
          <h3 class="overlay-title">
            <i class="pi pi-map-marker mr-2"></i>
            Position
          </h3>
        </div>

        <div class="position-grid">
          <div class="position-item">
            <span class="position-label">X</span>
            <span class="position-value"
              >{{ printerState().position.x.toFixed(2) }}mm</span
            >
          </div>
          <div class="position-item">
            <span class="position-label">Y</span>
            <span class="position-value"
              >{{ printerState().position.y.toFixed(2) }}mm</span
            >
          </div>
          <div class="position-item">
            <span class="position-label">Z</span>
            <span class="position-value"
              >{{ printerState().position.z.toFixed(2) }}mm</span
            >
          </div>
          <div class="position-item">
            <span class="position-label">Feed</span>
            <span class="position-value"
              >{{ printerState().feedRate }}mm/min</span
            >
          </div>
        </div>
      </div>
    </div>

    <!-- Extruder Status - Bottom Left -->
    <div
      class="status-overlay extruder-overlay"
      [class.mobile-hidden]="isMobile()"
      [@slideInFromLeft]="overlayAnimationState()"
      *ngIf="isOverlayVisible('extruder')"
    >
      <div class="overlay-content">
        <div class="overlay-header">
          <h3 class="overlay-title">
            <i class="pi pi-cog mr-2"></i>
            Extruder
          </h3>
        </div>

        <div class="extruder-grid">
          <div class="extruder-item full-width">
            <span class="extruder-label">Status:</span>
            <p-tag
              [value]="printerState().isExtruding ? 'EXTRUDING' : 'IDLE'"
              [severity]="printerState().isExtruding ? 'success' : 'secondary'"
              [ngClass]="{
                'animate-pulse': printerState().isExtruding && !reduceMotion(),
                'extruding-indicator': printerState().isExtruding
              }"
              size="small"
            />
          </div>

          <div class="extruder-item">
            <span class="extruder-label">E-Pos:</span>
            <span class="extruder-value"
              >{{ printerState().extruderPosition.toFixed(2) }}mm</span
            >
          </div>

          <div class="extruder-item">
            <span class="extruder-label">Temp:</span>
            <span
              class="extruder-value"
              [class]="getTemperatureClass(printerState().temperature)"
            >
              {{ printerState().temperature }}°C
            </span>
          </div>

          <div class="extruder-item">
            <span class="extruder-label">Bed:</span>
            <span
              class="extruder-value"
              [class]="
                getTemperatureClass(printerState().bedTemperature, 'bed')
              "
            >
              {{ printerState().bedTemperature }}°C
            </span>
          </div>

          <div class="extruder-item">
            <span class="extruder-label">Fan:</span>
            <span class="extruder-value">{{ printerState().fanSpeed }}%</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Timing Info - Bottom Right -->
    <div
      class="status-overlay timing-overlay"
      [@slideInFromRight]="overlayAnimationState()"
      *ngIf="isOverlayVisible('timing')"
    >
      <div class="overlay-content">
        <div class="overlay-header">
          <h3 class="overlay-title">
            <i class="pi pi-clock mr-2"></i>
            Timing
          </h3>
        </div>

        <div class="timing-grid">
          <div class="timing-item">
            <span class="timing-label">Elapsed:</span>
            <span class="timing-value">{{
              formatTime(printerState().executionTime)
            }}</span>
          </div>

          <div class="timing-item">
            <span class="timing-label">Remaining:</span>
            <span class="timing-value">{{
              formatTime(printerState().estimatedTimeRemaining)
            }}</span>
          </div>

          <div class="timing-item" *ngIf="estimatedCompletion()">
            <span class="timing-label">ETA:</span>
            <span class="timing-value highlight">{{
              estimatedCompletion()
            }}</span>
          </div>

          <div class="timing-item" *ngIf="showDetailedMetrics()">
            <span class="timing-label">Rate:</span>
            <span class="timing-value"
              >{{ performanceMetrics().commandProcessingRate }}/s</span
            >
          </div>
        </div>
      </div>
    </div>

    <!-- Performance Warning -->
    <div
      class="status-overlay performance-warning"
      [@slideInFromTop]="showPerformanceWarning()"
      *ngIf="showPerformanceWarning()"
    >
      <div class="overlay-content warning-content">
        <div class="warning-header">
          <i class="pi pi-exclamation-triangle warning-icon animate-bounce"></i>
          <h3 class="warning-title">Performance Warning</h3>
          <p-button
            icon="pi pi-times"
            (onClick)="dismissPerformanceWarning()"
            severity="secondary"
            [text]="true"
            size="small"
            class="warning-close"
          />
        </div>
        <p class="warning-message">{{ getPerformanceWarningMessage() }}</p>
        <div class="warning-actions">
          <p-button
            label="Optimize"
            icon="pi pi-wrench"
            (onClick)="optimizePerformance.emit()"
            severity="warn"
            size="small"
          />
          <p-button
            label="Ignore"
            (onClick)="dismissPerformanceWarning()"
            severity="secondary"
            size="small"
            [text]="true"
          />
        </div>
      </div>
    </div>

    <!-- Error Display -->
    <div
      class="status-overlay error-display"
      [@slideInScale]="errorMessage() !== null"
      *ngIf="errorMessage()"
    >
      <div class="overlay-content error-content">
        <div class="error-header">
          <i class="pi pi-exclamation-triangle error-icon animate-bounce"></i>
          <h3 class="error-title">Simulation Error</h3>
        </div>
        <p class="error-message">{{ errorMessage() }}</p>
        <div class="error-actions">
          <p-button
            label="Retry"
            icon="pi pi-refresh"
            (onClick)="retryAction.emit()"
            severity="danger"
            size="small"
            *ngIf="canRetry()"
          />
          <p-button
            label="Dismiss"
            icon="pi pi-times"
            (onClick)="dismissError.emit()"
            severity="secondary"
            size="small"
          />
        </div>
      </div>
    </div>

    <!-- Loading Status -->
    <div
      class="status-overlay loading-display"
      [@slideInScale]="isLoading()"
      *ngIf="isLoading()"
    >
      <div class="overlay-content loading-content">
        <div class="loading-header">
          <div class="loading-spinner">
            <i class="pi pi-spin pi-spinner loading-icon"></i>
          </div>
          <h3 class="loading-title">{{ loadingMessage() }}</h3>
        </div>

        <div class="loading-progress">
          <p-progressBar
            [value]="loadingProgress()"
            [showValue]="false"
            styleClass="loading-progress-bar"
          />
          <div class="progress-details">
            <span class="progress-text"
              >{{ loadingProgress().toFixed(1) }}%</span
            >
            <span class="progress-subtext" *ngIf="loadingSubMessage()">
              {{ loadingSubMessage() }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Debug Info (Development) -->
    <div
      class="status-overlay debug-overlay"
      [class.mobile-hidden]="isMobile()"
      [@slideInFromTop]="overlayAnimationState()"
      *ngIf="isOverlayVisible('performance') && showDebugInfo()"
    >
      <div class="overlay-content debug-content">
        <div class="overlay-header">
          <h3 class="overlay-title">
            <i class="pi pi-code mr-2"></i>
            Debug Info
          </h3>
          <p-button
            icon="pi pi-copy"
            (onClick)="copyDebugInfo()"
            severity="secondary"
            [text]="true"
            size="small"
            pTooltip="Copy debug information"
          />
        </div>

        <div class="debug-grid">
          <div class="debug-item">
            <span class="debug-label">FPS:</span>
            <span class="debug-value">{{ performanceState().currentFPS }}</span>
          </div>
          <div class="debug-item">
            <span class="debug-label">Avg FPS:</span>
            <span class="debug-value">{{
              performanceState().averageFPS.toFixed(1)
            }}</span>
          </div>
          <div class="debug-item">
            <span class="debug-label">Memory:</span>
            <span class="debug-value">
              {{ formatMemoryUsage(performanceMetrics().memoryUsage) }}
            </span>
          </div>
          <div class="debug-item">
            <span class="debug-label">Render:</span>
            <span class="debug-value"
              >{{ performanceMetrics().renderTime.toFixed(2) }}ms</span
            >
          </div>
          <div class="debug-item">
            <span class="debug-label">Objects:</span>
            <span class="debug-value">{{
              performanceMetrics().pathObjects
            }}</span>
          </div>
          <div class="debug-item">
            <span class="debug-label">Buffer:</span>
            <span class="debug-value"
              >{{ performanceMetrics().bufferUtilization.toFixed(1) }}%</span
            >
          </div>
        </div>

        <div
          class="debug-warnings"
          *ngIf="performanceState().warnings.length > 0"
        >
          <p-divider />
          <div class="warning-list">
            <div
              class="warning-item"
              *ngFor="
                let warning of performanceState().warnings;
                trackBy: trackByWarning
              "
            >
              <i class="pi pi-exclamation-triangle text-yellow-500 mr-2"></i>
              <span class="warning-text">{{ warning }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Overlay Controls (Development/Demo) -->
    <div class="overlay-controls" *ngIf="showOverlayControls()">
      <p-button
        icon="pi pi-eye"
        (onClick)="toggleOverlaysVisible()"
        [severity]="overlaysVisible() ? 'success' : 'secondary'"
        size="small"
        [text]="true"
        pTooltip="Toggle overlays visibility"
      />
    </div>
  `,
  styles: [
    `
      :host {
        @apply pointer-events-none;
      }

      .status-overlay {
        @apply fixed z-30 pointer-events-auto;
      }

      .main-status {
        @apply top-4 left-4;
      }

      .progress-overlay {
        @apply top-40 left-4;
      }

      .position-overlay {
        @apply top-4 right-4;
      }

      .extruder-overlay {
        @apply bottom-20 left-4;
      }

      .timing-overlay {
        @apply bottom-4 right-4;
      }

      .performance-warning {
        @apply top-4 right-4;
      }

      .error-display,
      .loading-display {
        @apply top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2;
      }

      .debug-overlay {
        @apply top-4 left-1/2 transform -translate-x-1/2;
      }

      .overlay-controls {
        @apply fixed top-4 right-1/2 z-40;
      }

      /* Overlay Content Styling */
      .overlay-content {
        @apply bg-black/80 backdrop-blur-md border border-white/20 rounded-xl p-4 text-white shadow-2xl;
        min-width: 200px;
      }

      .overlay-header {
        @apply flex items-center justify-between mb-3;
      }

      .overlay-title {
        @apply text-sm font-bold flex items-center;
      }

      .overlay-close {
        @apply ml-2 opacity-70 hover:opacity-100;
      }

      /* Status Grid */
      .status-grid {
        @apply space-y-2;
      }

      .status-item {
        @apply flex items-center justify-between text-sm;
      }

      .status-label {
        @apply text-gray-300 font-medium;
      }

      .status-value {
        @apply font-bold text-white;
      }

      .status-value.highlight {
        @apply text-blue-400;
      }

      .status-value.success {
        @apply text-green-400;
      }

      .status-value.large {
        @apply text-base;
      }

      /* Progress Section */
      .progress-section {
        @apply mb-3;
      }

      .progress-header {
        @apply flex justify-between items-center mb-2;
      }

      .progress-title {
        @apply text-sm font-medium text-gray-300;
      }

      .progress-percentage {
        @apply text-sm font-bold text-green-400;
      }

      .modern-progress ::ng-deep .p-progressbar {
        @apply h-3 rounded-full bg-gray-700;
      }

      .modern-progress ::ng-deep .p-progressbar-value {
        @apply bg-gradient-to-r from-blue-500 to-blue-600 rounded-full;
      }

      .command-info {
        @apply text-xs text-gray-400 space-y-1;
      }

      .command-counter,
      .execution-rate {
        @apply flex justify-between;
      }

      .counter-value,
      .rate-value {
        @apply font-semibold text-gray-200;
      }

      /* Position Grid */
      .position-grid {
        @apply grid grid-cols-2 gap-3;
      }

      .position-item {
        @apply text-center;
      }

      .position-label {
        @apply block text-xs font-bold text-gray-300 mb-1;
      }

      .position-value {
        @apply block text-sm font-semibold text-white;
      }

      /* Extruder Grid */
      .extruder-grid {
        @apply grid grid-cols-2 gap-2 text-sm;
      }

      .extruder-item {
        @apply flex items-center justify-between;
      }

      .extruder-item.full-width {
        @apply col-span-2;
      }

      .extruder-label {
        @apply text-gray-300 font-medium;
      }

      .extruder-value {
        @apply font-bold text-white;
      }

      .extruding-indicator {
        @apply shadow-lg shadow-green-500/50;
      }

      /* Timing Grid */
      .timing-grid {
        @apply space-y-2 text-sm;
      }

      .timing-item {
        @apply flex items-center justify-between;
      }

      .timing-label {
        @apply text-gray-300 font-medium;
      }

      .timing-value {
        @apply font-bold text-white;
      }

      .timing-value.highlight {
        @apply text-green-400;
      }

      /* Warning Content */
      .warning-content {
        @apply bg-yellow-600/90 border-yellow-500/50;
      }

      .warning-header {
        @apply flex items-center justify-between mb-3;
      }

      .warning-icon {
        @apply text-yellow-200 mr-2;
      }

      .warning-title {
        @apply text-sm font-bold text-yellow-100 flex-1;
      }

      .warning-close {
        @apply text-yellow-200 hover:text-yellow-100;
      }

      .warning-message {
        @apply text-xs text-yellow-100 mb-3;
      }

      .warning-actions {
        @apply flex gap-2;
      }

      /* Error Content */
      .error-content {
        @apply bg-red-600/90 border-red-500/50;
      }

      .error-header {
        @apply flex items-center mb-3;
      }

      .error-icon {
        @apply text-red-200 mr-3 text-lg;
      }

      .error-title {
        @apply text-sm font-bold text-red-100;
      }

      .error-message {
        @apply text-xs text-red-100 mb-3 break-words;
      }

      .error-actions {
        @apply flex gap-2;
      }

      /* Loading Content */
      .loading-content {
        @apply bg-blue-600/90 border-blue-500/50;
      }

      .loading-header {
        @apply flex items-center mb-4;
      }

      .loading-spinner {
        @apply mr-3;
      }

      .loading-icon {
        @apply text-blue-200 text-xl;
      }

      .loading-title {
        @apply text-sm font-bold text-blue-100;
      }

      .loading-progress {
        @apply space-y-2;
      }

      .loading-progress-bar ::ng-deep .p-progressbar {
        @apply h-2 rounded-full bg-blue-800;
      }

      .loading-progress-bar ::ng-deep .p-progressbar-value {
        @apply bg-blue-200 rounded-full;
      }

      .progress-details {
        @apply flex justify-between items-center text-xs;
      }

      .progress-text {
        @apply font-bold text-blue-100;
      }

      .progress-subtext {
        @apply text-blue-200;
      }

      /* Debug Content */
      .debug-content {
        @apply bg-gray-800/90 border-gray-600/50;
      }

      .debug-grid {
        @apply grid grid-cols-2 gap-2 text-xs;
      }

      .debug-item {
        @apply flex justify-between;
      }

      .debug-label {
        @apply text-gray-400;
      }

      .debug-value {
        @apply font-bold text-gray-200;
      }

      .debug-warnings {
        @apply mt-3;
      }

      .warning-list {
        @apply space-y-1;
      }

      .warning-item {
        @apply flex items-center text-xs;
      }

      .warning-text {
        @apply text-gray-300;
      }

      /* Color Classes */
      .fps-good {
        @apply text-green-400;
      }

      .fps-acceptable {
        @apply text-yellow-400;
      }

      .fps-poor {
        @apply text-red-400;
      }

      .temp-cold {
        @apply text-blue-400;
      }

      .temp-warm {
        @apply text-yellow-400;
      }

      .temp-hot {
        @apply text-orange-400;
      }

      .temp-very-hot {
        @apply text-red-400;
      }

      /* Mobile Responsiveness */
      @media (max-width: 768px) {
        .mobile-hidden {
          @apply hidden;
        }

        .overlay-content {
          @apply text-sm;
          min-width: 150px;
        }

        .main-status {
          @apply top-2 left-2;
        }

        .progress-overlay {
          @apply top-32 left-2;
        }

        .timing-overlay {
          @apply bottom-2 right-2;
        }

        .debug-grid {
          @apply grid-cols-1;
        }
      }

      @media (max-width: 480px) {
        .overlay-content {
          @apply p-3;
        }

        .status-grid,
        .timing-grid {
          @apply space-y-1;
        }

        .position-grid,
        .extruder-grid {
          @apply grid-cols-1 gap-1;
        }

        .extruder-item.full-width {
          @apply col-span-1;
        }
      }

      /* Reduced Motion */
      @media (prefers-reduced-motion: reduce) {
        .animate-pulse,
        .animate-bounce {
          @apply animate-none;
        }

        .loading-icon {
          animation: none;
        }
      }

      /* High Contrast */
      @media (prefers-contrast: high) {
        .overlay-content {
          @apply bg-black border-white text-white;
        }

        .status-value.highlight {
          @apply text-white;
        }
      }
    `,
  ],
  animations: [
    trigger('slideInFromLeft', [
      state('void', style({ opacity: 0, transform: 'translateX(-100%)' })),
      state('*', style({ opacity: 1, transform: 'translateX(0)' })),
      transition('void => *', [
        animate('300ms cubic-bezier(0.25, 0.46, 0.45, 0.94)'),
      ]),
      transition('* => void', [
        animate(
          '200ms cubic-bezier(0.55, 0.055, 0.675, 0.19)',
          style({ opacity: 0, transform: 'translateX(-100%)' })
        ),
      ]),
    ]),

    trigger('slideInFromRight', [
      state('void', style({ opacity: 0, transform: 'translateX(100%)' })),
      state('*', style({ opacity: 1, transform: 'translateX(0)' })),
      transition('void => *', [
        animate('300ms cubic-bezier(0.25, 0.46, 0.45, 0.94)'),
      ]),
      transition('* => void', [
        animate(
          '200ms cubic-bezier(0.55, 0.055, 0.675, 0.19)',
          style({ opacity: 0, transform: 'translateX(100%)' })
        ),
      ]),
    ]),

    trigger('slideInFromTop', [
      state('void', style({ opacity: 0, transform: 'translateY(-100%)' })),
      state('*', style({ opacity: 1, transform: 'translateY(0)' })),
      transition('void => *', [
        animate('300ms cubic-bezier(0.25, 0.46, 0.45, 0.94)'),
      ]),
      transition('* => void', [
        animate(
          '200ms cubic-bezier(0.55, 0.055, 0.675, 0.19)',
          style({ opacity: 0, transform: 'translateY(-100%)' })
        ),
      ]),
    ]),

    trigger('slideInScale', [
      state(
        'void',
        style({
          opacity: 0,
          transform: 'translate(-50%, -50%) scale(0.8)',
        })
      ),
      state(
        '*',
        style({
          opacity: 1,
          transform: 'translate(-50%, -50%) scale(1)',
        })
      ),
      transition('void => *', [
        animate('300ms cubic-bezier(0.34, 1.56, 0.64, 1)'),
      ]),
      transition('* => void', [
        animate(
          '200ms cubic-bezier(0.55, 0.055, 0.675, 0.19)',
          style({
            opacity: 0,
            transform: 'translate(-50%, -50%) scale(0.9)',
          })
        ),
      ]),
    ]),

    trigger('overlayStagger', [
      transition('* => *', [
        query(
          ':enter',
          [
            style({ opacity: 0, transform: 'translateY(20px)' }),
            stagger(100, [
              animate(
                '300ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                style({ opacity: 1, transform: 'translateY(0)' })
              ),
            ]),
          ],
          { optional: true }
        ),
      ]),
    ]),
  ],
})
export class PrinterStatusOverlaysComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);

  // Inputs
  readonly printerState = input.required<PrinterState>();
  readonly simulationState = input.required<SimulationState>();
  readonly performanceMetrics = input.required<PerformanceMetrics>();
  readonly errorMessage = input<string | null>(null);
  readonly isLoading = input<boolean>(false);
  readonly loadingProgress = input<number>(0);
  readonly loadingMessage = input<string>('Loading...');
  readonly loadingSubMessage = input<string | null>(null);
  readonly isMobile = input<boolean>(false);
  readonly showDebugInfo = input<boolean>(false);
  readonly forceShowOverlays = input<boolean>(false);

  // Outputs
  readonly dismissError = output<void>();
  readonly retryAction = output<void>();
  readonly optimizePerformance = output<void>();

  // Local state
  readonly overlaysVisible = signal<boolean>(true);
  readonly performanceWarningDismissed = signal<boolean>(false);
  readonly executionRate = signal<number>(0);
  readonly notifications = signal<NotificationState[]>([]);
  readonly performanceState = signal<PerformanceState>({
    currentFPS: 60,
    averageFPS: 60,
    memoryUsage: 0,
    cpuUsage: 0,
    renderTime: 0,
    isHealthy: true,
    warnings: [],
  });

  // Configuration
  readonly defaultOverlays: StatusOverlay[] = [
    {
      id: 'status',
      component: 'status',
      config: { position: 'top-left', visible: true, priority: 1 },
    },
    {
      id: 'progress',
      component: 'progress',
      config: { position: 'top-left', visible: true, priority: 2 },
    },
    {
      id: 'position',
      component: 'position',
      config: {
        position: 'top-right',
        visible: true,
        priority: 3,
        mobileHidden: true,
      },
    },
    {
      id: 'extruder',
      component: 'extruder',
      config: {
        position: 'bottom-left',
        visible: true,
        priority: 4,
        mobileHidden: true,
      },
    },
    {
      id: 'timing',
      component: 'timing',
      config: { position: 'bottom-right', visible: true, priority: 5 },
    },
    {
      id: 'performance',
      component: 'performance',
      config: {
        position: 'top-right',
        visible: false,
        priority: 6,
        mobileHidden: true,
      },
    },
  ];

  // Computed properties
  readonly simulationStateDisplay = computed(() => {
    const state = this.simulationState();
    return state.charAt(0).toUpperCase() + state.slice(1);
  });

  readonly isSimulationActive = computed(() => {
    const state = this.simulationState();
    return (
      state === SimulationState.RUNNING || state === SimulationState.LOADING
    );
  });

  readonly showDetailedMetrics = computed(() => {
    return !this.isMobile() && this.printerState().totalCommands > 0;
  });

  readonly showPerformanceWarning = computed(() => {
    if (this.performanceWarningDismissed()) return false;

    const metrics = this.performanceMetrics();
    return (
      metrics.fps < PERFORMANCE_THRESHOLDS.FPS.ACCEPTABLE ||
      metrics.renderTime > PERFORMANCE_THRESHOLDS.RENDER_TIME.ACCEPTABLE ||
      metrics.memoryUsage > PERFORMANCE_THRESHOLDS.MEMORY.WARNING
    );
  });

  readonly estimatedCompletion = computed(() => {
    const remaining = this.printerState().estimatedTimeRemaining;
    if (remaining <= 0) return null;

    const now = new Date();
    const eta = new Date(now.getTime() + remaining * 1000);

    return eta.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  });

  readonly overlayAnimationState = computed(() => {
    return this.overlaysVisible() ? 'visible' : 'hidden';
  });

  readonly showOverlayControls = computed(() => {
    return this.showDebugInfo() && !this.isMobile();
  });

  readonly reduceMotion = signal<boolean>(false);

  constructor() {
    this.setupPerformanceMonitoring();
    this.setupAccessibilityDetection();
  }

  // Public methods
  isOverlayVisible(overlayId: string): boolean {
    if (!this.overlaysVisible()) return false;

    const overlay = this.defaultOverlays.find((o) => o.id === overlayId);
    if (!overlay) return false;

    // Check mobile visibility
    if (
      this.isMobile() &&
      overlay.config.mobileHidden &&
      !this.forceShowOverlays()
    ) {
      return false;
    }

    return overlay.config.visible;
  }

  hideOverlay(overlayId: string): void {
    console.log(`Hiding overlay: ${overlayId}`);
    // In a real implementation, this would update the overlay configuration
  }

  isPersistentOverlay(overlayId: string): boolean {
    // Status and timing overlays are considered persistent
    return ['status', 'timing'].includes(overlayId);
  }

  toggleOverlaysVisible(): void {
    this.overlaysVisible.update((visible) => !visible);
  }

  dismissPerformanceWarning(): void {
    this.performanceWarningDismissed.set(true);
  }

  copyDebugInfo(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const debugInfo = {
      performance: this.performanceMetrics(),
      printerState: {
        progress: this.printerState().printProgress,
        layer: `${this.printerState().currentLayer}/${
          this.printerState().totalLayers
        }`,
        command: `${this.printerState().currentCommandIndex}/${
          this.printerState().totalCommands
        }`,
        position: this.printerState().position,
      },
      system: {
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        simulationState: this.simulationState(),
      },
    };

    navigator.clipboard
      ?.writeText(JSON.stringify(debugInfo, null, 2))
      .then(() => console.log('Debug info copied to clipboard'))
      .catch((err) => console.error('Failed to copy debug info:', err));
  }

  canRetry(): boolean {
    return this.simulationState() === SimulationState.ERROR;
  }

  // Utility methods
  getStateSeverity(): 'success' | 'info' | 'warning' | 'danger' | 'secondary' {
    switch (this.simulationState()) {
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

  getFPSClass(fps: number): string {
    if (fps >= PERFORMANCE_THRESHOLDS.FPS.GOOD) return 'fps-good';
    if (fps >= PERFORMANCE_THRESHOLDS.FPS.ACCEPTABLE) return 'fps-acceptable';
    return 'fps-poor';
  }

  getTemperatureClass(temp: number, type: 'hotend' | 'bed' = 'hotend'): string {
    const thresholds =
      type === 'hotend'
        ? { cold: 50, warm: 180, hot: 220, veryHot: 250 }
        : { cold: 30, warm: 50, hot: 80, veryHot: 100 };

    if (temp <= thresholds.cold) return 'temp-cold';
    if (temp <= thresholds.warm) return 'temp-warm';
    if (temp <= thresholds.hot) return 'temp-hot';
    return 'temp-very-hot';
  }

  getPerformanceWarningMessage(): string {
    const metrics = this.performanceMetrics();

    if (metrics.fps < PERFORMANCE_THRESHOLDS.FPS.POOR) {
      return 'Very low FPS detected. Consider reducing quality settings or closing other applications.';
    } else if (metrics.fps < PERFORMANCE_THRESHOLDS.FPS.ACCEPTABLE) {
      return 'Low FPS detected. Performance may be degraded.';
    } else if (metrics.renderTime > PERFORMANCE_THRESHOLDS.RENDER_TIME.POOR) {
      return 'High render times detected. Consider optimizing visualization settings.';
    } else if (metrics.memoryUsage > PERFORMANCE_THRESHOLDS.MEMORY.CRITICAL) {
      return 'Critical memory usage detected. Large model may cause system instability.';
    } else if (metrics.memoryUsage > PERFORMANCE_THRESHOLDS.MEMORY.WARNING) {
      return 'High memory usage detected. Consider reducing model complexity.';
    }

    return 'Performance issues detected.';
  }

  formatTime(seconds: number): string {
    return formatDuration(seconds);
  }

  formatMemoryUsage(bytes: number): string {
    return formatFileSize(bytes);
  }

  trackByWarning = (index: number, warning: string): string => warning;

  // Private methods
  private setupPerformanceMonitoring(): void {
    // Monitor execution rate
    let lastCommandCount = 0;
    let lastTime = Date.now();

    interval(1000)
      .pipe(
        map(() => {
          const currentCount = this.printerState().currentCommandIndex;
          const currentTime = Date.now();
          const deltaCommands = currentCount - lastCommandCount;
          const deltaTime = currentTime - lastTime;

          const rate = deltaTime > 0 ? (deltaCommands * 1000) / deltaTime : 0;

          lastCommandCount = currentCount;
          lastTime = currentTime;

          return Math.round(rate);
        }),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((rate) => {
        this.executionRate.set(rate);
      });

    // Monitor performance state
    interval(1000)
      .pipe(
        map(() => {
          const metrics = this.performanceMetrics();
          const warnings: string[] = [];

          if (metrics.fps < PERFORMANCE_THRESHOLDS.FPS.ACCEPTABLE) {
            warnings.push('Low FPS detected');
          }

          if (
            metrics.renderTime > PERFORMANCE_THRESHOLDS.RENDER_TIME.ACCEPTABLE
          ) {
            warnings.push('High render times');
          }

          if (metrics.memoryUsage > PERFORMANCE_THRESHOLDS.MEMORY.WARNING) {
            warnings.push('High memory usage');
          }

          if (metrics.bufferUtilization > 90) {
            warnings.push('Buffer nearly full');
          }

          return {
            currentFPS: metrics.fps,
            averageFPS: metrics.fps, // In a real implementation, this would be calculated
            memoryUsage: metrics.memoryUsage,
            cpuUsage: 0, // Would need to be calculated from system metrics
            renderTime: metrics.renderTime,
            isHealthy: warnings.length === 0,
            warnings,
          };
        }),
        distinctUntilChanged(
          (prev, curr) =>
            prev.currentFPS === curr.currentFPS &&
            prev.warnings.length === curr.warnings.length
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((state) => {
        this.performanceState.set(state);
      });
  }

  private setupAccessibilityDetection(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    // Detect reduced motion preference
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.reduceMotion.set(mediaQuery.matches);

    mediaQuery.addEventListener('change', (e) => {
      this.reduceMotion.set(e.matches);
    });
  }
}
