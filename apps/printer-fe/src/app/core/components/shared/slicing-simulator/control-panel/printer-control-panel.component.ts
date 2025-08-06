// src/app/printer-simulator/components/control-panel/printer-control-panel.component.ts

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { SliderModule } from 'primeng/slider';
import { ProgressBarModule } from 'primeng/progressbar';
import { InputNumberModule } from 'primeng/inputnumber';
import { ColorPickerModule } from 'primeng/colorpicker';
import { ToggleButtonModule } from 'primeng/togglebutton';
import { PanelModule } from 'primeng/panel';
import { AccordionModule } from 'primeng/accordion';
import { TooltipModule } from 'primeng/tooltip';
import { DividerModule } from 'primeng/divider';
import { DropdownModule } from 'primeng/dropdown';
import { BadgeModule } from 'primeng/badge';
import { KnobModule } from 'primeng/knob';
import { SpeedDialModule } from 'primeng/speeddial';
import { ConfirmationService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';
import {
  ControlActionType,
  PrinterState,
  QUALITY_PROFILES,
  QualityProfile,
  SimulationState,
  ViewportSettings,
} from '../../../../models/simulator/simulator.models';

export interface ControlAction {
  readonly type: ControlActionType;
  readonly payload?: unknown;
}

export interface SettingsUpdate {
  readonly setting: keyof ViewportSettings;
  readonly value: unknown;
}

interface ControlButtonConfig {
  readonly type: ControlActionType;
  readonly icon: string;
  readonly label: string;
  readonly severity: 'success' | 'info' | 'warning' | 'danger' | 'secondary';
  readonly tooltip: string;
  readonly shortcut?: string;
}

interface ValidationResult {
  readonly isValid: boolean;
  readonly message?: string;
}

@Component({
  selector: 'printer-control-panel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ButtonModule,
    SliderModule,
    ProgressBarModule,
    InputNumberModule,
    ColorPickerModule,
    ToggleButtonModule,
    PanelModule,
    AccordionModule,
    TooltipModule,
    DividerModule,
    DropdownModule,
    BadgeModule,
    KnobModule,
    SpeedDialModule,
    ConfirmDialogModule,
  ],
  providers: [ConfirmationService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="control-panel">
      <!-- Panel Header -->
      <div class="panel-header">
        <h2 class="panel-title">
          <i class="pi pi-cog mr-2"></i>
          Simulation Control
        </h2>
        <p-button
          icon="pi pi-question-circle"
          severity="secondary"
          [text]="true"
          size="small"
          pTooltip="Show keyboard shortcuts"
          (onClick)="showShortcuts()"
        />
      </div>

      <!-- Quick Status Bar -->
      <div class="status-bar">
        <div class="status-item">
          <span class="status-label">State:</span>
          <p-tag
            [value]="simulationStateDisplay()"
            [severity]="getStateSeverity()"
            [ngClass]="{ 'animate-pulse': isAnimating() }"
          />
        </div>
        <div class="status-item">
          <span class="status-label">Progress:</span>
          <span class="status-value"
            >{{ printerState().printProgress.toFixed(1) }}%</span
          >
        </div>
      </div>

      <!-- Main Controls -->
      <p-panel
        header="Primary Controls"
        [toggleable]="false"
        styleClass="control-section"
      >
        <div class="control-grid primary-controls">
          <p-button
            *ngFor="let btn of primaryControlButtons(); trackBy: trackByButton"
            [icon]="btn.icon"
            [label]="btn.label"
            [disabled]="!isButtonEnabled(btn.type)"
            (onClick)="handleAction(btn.type)"
            [severity]="btn.severity"
            size="small"
            [pTooltip]="getButtonTooltip(btn)"
            tooltipPosition="bottom"
            [rounded]="true"
            [raised]="true"
            [loading]="isButtonLoading(btn.type)"
            [class]="getButtonClass(btn.type)"
          />
        </div>

        <!-- Step Controls -->
        <p-divider />
        <div class="step-controls">
          <h4 class="section-title">Step Controls</h4>
          <div class="control-grid step-grid">
            <p-button
              icon="pi pi-step-backward"
              [disabled]="!canStepBack()"
              (onClick)="handleAction('stepBack', 1)"
              severity="secondary"
              size="small"
              pTooltip="Step back 1 command (←)"
              [text]="true"
              [rounded]="true"
            />
            <p-button
              icon="pi pi-backward"
              [disabled]="!canStepBackMultiple()"
              (onClick)="handleAction('stepBack', 10)"
              severity="secondary"
              size="small"
              pTooltip="Step back 10 commands (Shift+←)"
              [text]="true"
              [rounded]="true"
            />
            <p-button
              icon="pi pi-forward"
              [disabled]="!canStepForwardMultiple()"
              (onClick)="handleAction('stepForward', 10)"
              severity="secondary"
              size="small"
              pTooltip="Step forward 10 commands (Shift+→)"
              [text]="true"
              [rounded]="true"
            />
            <p-button
              icon="pi pi-step-forward"
              [disabled]="!canStepForward()"
              (onClick)="handleAction('stepForward', 1)"
              severity="secondary"
              size="small"
              pTooltip="Step forward 1 command (→)"
              [text]="true"
              [rounded]="true"
            />
          </div>
        </div>

        <!-- Jump Controls -->
        <p-divider />
        <div class="jump-controls">
          <h4 class="section-title">Navigation</h4>
          <div class="flex gap-2 items-end">
            <div class="flex-1">
              <label for="jumpInput" class="input-label">Jump to Command</label>
              <p-inputNumber
                [(ngModel)]="jumpTarget"
                [min]="1"
                [max]="maxJumpTarget() + 1"
                [showButtons]="true"
                [step]="1"
                size="small"
                styleClass="w-full"
                id="jumpInput"
                placeholder="Command #"
                [useGrouping]="false"
                (ngModelChange)="validateJumpTarget($event)"
              />
              <small class="input-hint">
                Current: {{ printerState().currentCommandIndex + 1 }} /
                {{ printerState().totalCommands }}
              </small>
            </div>
            <p-button
              label="Jump"
              icon="pi pi-arrow-right"
              (onClick)="handleJump()"
              severity="info"
              size="small"
              [disabled]="!isValidJumpTarget()"
              [raised]="true"
            />
          </div>
        </div>
      </p-panel>

      <!-- Progress Section -->
      <p-panel
        header="Progress Information"
        [toggleable]="true"
        styleClass="control-section"
      >
        <!-- Overall Progress -->
        <div class="progress-section">
          <div class="progress-header">
            <span class="progress-label">Overall Progress</span>
            <span class="progress-value"
              >{{ printerState().printProgress.toFixed(1) }}%</span
            >
          </div>
          <p-progressBar
            [value]="printerState().printProgress"
            [showValue]="false"
            styleClass="custom-progress"
          />
        </div>

        <!-- Layer Progress -->
        <div class="progress-section">
          <div class="progress-header">
            <span class="progress-label">Layer Progress</span>
            <span class="progress-value">
              {{ printerState().currentLayer }} /
              {{ printerState().totalLayers }}
            </span>
          </div>
          <p-progressBar
            [value]="layerProgress()"
            [showValue]="false"
            styleClass="custom-progress-green"
          />
        </div>

        <!-- Time Information -->
        <div class="time-grid">
          <div class="time-item">
            <span class="time-label">Elapsed</span>
            <span class="time-value">{{
              formatTime(printerState().executionTime)
            }}</span>
          </div>
          <div class="time-item">
            <span class="time-label">Remaining</span>
            <span class="time-value">{{
              formatTime(printerState().estimatedTimeRemaining)
            }}</span>
          </div>
          <div class="time-item" *ngIf="estimatedCompletion()">
            <span class="time-label">ETA</span>
            <span class="time-value">{{ estimatedCompletion() }}</span>
          </div>
        </div>
      </p-panel>

      <!-- Settings Accordion -->
      <p-accordion [multiple]="true" styleClass="settings-accordion">
        <!-- Simulation Settings -->
        <p-accordionTab header="Simulation Settings" [selected]="true">
          <div class="settings-content">
            <!-- Animation Speed with Knob -->
            <div class="setting-item">
              <label class="setting-label">Animation Speed</label>
              <div class="flex items-center gap-4">
                <p-knob
                  [(ngModel)]="currentAnimationSpeed"
                  [min]="0.1"
                  [max]="10"
                  [step]="0.1"
                  [size]="80"
                  [strokeWidth]="6"
                  valueColor="#3b82f6"
                  rangeColor="#e5e7eb"
                  textColor="#374151"
                  (onChange)="updateAnimationSpeed($event)"
                />
                <div class="speed-info">
                  <div class="speed-value">
                    {{ currentAnimationSpeed.toFixed(1) }}x
                  </div>
                  <div class="speed-presets">
                    <p-button
                      *ngFor="let preset of speedPresets"
                      [label]="preset.label"
                      (onClick)="setSpeedPreset(preset.value)"
                      [severity]="
                        currentAnimationSpeed === preset.value
                          ? 'info'
                          : 'secondary'
                      "
                      size="small"
                      [text]="true"
                    />
                  </div>
                </div>
              </div>
            </div>

            <!-- Quality Profile -->
            <div class="setting-item">
              <label class="setting-label">Quality Profile</label>
              <p-dropdown
                [options]="qualityProfileOptions"
                [(ngModel)]="selectedQualityProfile"
                optionLabel="name"
                optionValue="name"
                placeholder="Select Quality Profile"
                class="w-full"
                (onChange)="applyQualityProfile($event.value)"
                [showClear]="false"
              />
              <small class="setting-hint" *ngIf="getSelectedProfile()">
                {{ getSelectedProfile()?.description }}
              </small>
            </div>

            <!-- Filament Color -->
            <div class="setting-item">
              <label class="setting-label">Filament Color</label>
              <div class="color-picker-container">
                <p-colorPicker
                  [(ngModel)]="currentFilamentColor"
                  format="hex"
                  (onChange)="updateFilamentColor($event)"
                  [inline]="false"
                />
                <div class="color-presets">
                  <button
                    *ngFor="let color of colorPresets"
                    class="color-preset"
                    [style.backgroundColor]="color"
                    (click)="setColorPreset(color)"
                    [attr.aria-label]="'Set color to ' + color"
                  ></button>
                </div>
              </div>
            </div>

            <!-- Layer Height -->
            <div class="setting-item">
              <label class="setting-label">Layer Height</label>
              <p-inputNumber
                [(ngModel)]="currentLayerHeight"
                [min]="0.05"
                [max]="1"
                [step]="0.05"
                suffix="mm"
                size="small"
                styleClass="w-full"
                (onInput)="updateLayerHeight($event.value)"
                [showButtons]="true"
                [buttonLayout]="'horizontal'"
              />
            </div>
          </div>
        </p-accordionTab>

        <!-- Display Settings -->
        <p-accordionTab header="Display Settings">
          <div class="settings-content">
            <div class="toggle-grid">
              <div
                class="toggle-item"
                *ngFor="let toggle of displayToggles; trackBy: trackByToggle"
              >
                <label class="toggle-label">{{ toggle.label }}</label>
                <p-toggleButton
                  [ngModel]="getToggleValue(toggle.key)"
                  (ngModelChange)="updateToggleSetting(toggle.key, $event)"
                  [onIcon]="toggle.onIcon"
                  [offIcon]="toggle.offIcon"
                  size="small"
                  [pTooltip]="toggle.tooltip"
                />
              </div>
            </div>
          </div>
        </p-accordionTab>

        <!-- Advanced Settings -->
        <p-accordionTab header="Advanced Settings">
          <div class="settings-content">
            <!-- Performance Settings -->
            <div class="setting-item">
              <label class="setting-label">
                Max Path Points:
                {{ currentSettings().maxPathPoints.toLocaleString() }}
              </label>
              <p-slider
                [(ngModel)]="currentMaxPathPoints"
                [min]="1000"
                [max]="100000"
                [step]="1000"
                (onChange)="updateMaxPathPoints($event.value)"
                styleClass="performance-slider"
              />
              <div class="slider-labels">
                <span>1K (Fast)</span>
                <span>100K (Detailed)</span>
              </div>
              <small
                class="setting-warning"
                *ngIf="currentMaxPathPoints > 50000"
              >
                ⚠️ High values may impact performance
              </small>
            </div>

            <!-- Curve Resolution -->
            <div class="setting-item">
              <label class="setting-label">
                Curve Resolution:
                {{ currentSettings().curveResolution }} segments
              </label>
              <p-slider
                [(ngModel)]="currentCurveResolution"
                [min]="5"
                [max]="50"
                [step]="1"
                (onChange)="updateCurveResolution($event.value)"
                styleClass="performance-slider"
              />
              <div class="slider-labels">
                <span>5 (Fast)</span>
                <span>50 (Smooth)</span>
              </div>
            </div>

            <!-- Build Volume -->
            <div class="setting-item">
              <label class="setting-label">Build Volume (mm)</label>
              <div class="build-volume-grid">
                <div class="volume-input">
                  <label>X</label>
                  <p-inputNumber
                    [(ngModel)]="currentBuildVolume.x"
                    [min]="50"
                    [max]="500"
                    [step]="10"
                    size="small"
                    (onInput)="updateBuildVolume('x', $event.value)"
                  />
                </div>
                <div class="volume-input">
                  <label>Y</label>
                  <p-inputNumber
                    [(ngModel)]="currentBuildVolume.y"
                    [min]="50"
                    [max]="500"
                    [step]="10"
                    size="small"
                    (onInput)="updateBuildVolume('y', $event.value)"
                  />
                </div>
                <div class="volume-input">
                  <label>Z</label>
                  <p-inputNumber
                    [(ngModel)]="currentBuildVolume.z"
                    [min]="50"
                    [max]="500"
                    [step]="10"
                    size="small"
                    (onInput)="updateBuildVolume('z', $event.value)"
                  />
                </div>
              </div>
            </div>
          </div>
        </p-accordionTab>

        <!-- Camera Controls -->
        <p-accordionTab header="Camera Controls">
          <div class="settings-content">
            <div class="camera-grid">
              <p-button
                *ngFor="
                  let camera of cameraActions;
                  trackBy: trackByCameraAction
                "
                [label]="camera.label"
                [icon]="camera.icon"
                (onClick)="handleCameraAction(camera.action)"
                severity="secondary"
                size="small"
                [text]="true"
                [pTooltip]="camera.tooltip"
              />
            </div>
          </div>
        </p-accordionTab>
      </p-accordion>

      <!-- Action Buttons -->
      <div class="action-buttons">
        <p-button
          label="Command History"
          icon="pi pi-chart-line"
          (onClick)="actionButtonClick.emit('showHistory')"
          severity="info"
          size="small"
          styleClass="w-full action-button"
          [raised]="true"
        />

        <p-button
          label="Export Settings"
          icon="pi pi-download"
          (onClick)="handleExportSettings()"
          severity="secondary"
          size="small"
          styleClass="w-full action-button"
          [text]="true"
        />
      </div>
    </div>

    <!-- Confirmation Dialog -->
    <p-confirmDialog
      header="Confirm Action"
      icon="pi pi-exclamation-triangle"
      acceptButtonStyleClass="p-button-danger p-button-sm"
      rejectButtonStyleClass="p-button-secondary p-button-sm"
    />
  `,
  styles: [
    `
      .control-panel {
        @apply w-96 min-h-screen bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 overflow-y-auto shadow-xl;
      }

      .panel-header {
        @apply flex items-center justify-between p-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white;
      }

      .panel-title {
        @apply text-lg font-bold flex items-center;
      }

      .status-bar {
        @apply flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700;
      }

      .status-item {
        @apply flex items-center gap-2;
      }

      .status-label {
        @apply text-sm text-gray-600 dark:text-gray-400;
      }

      .status-value {
        @apply text-sm font-semibold text-gray-900 dark:text-gray-100;
      }

      .control-section ::ng-deep .p-panel-header {
        @apply bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700;
      }

      .control-grid {
        @apply grid gap-2;
      }

      .primary-controls {
        @apply grid-cols-2;
      }

      .step-grid {
        @apply grid-cols-4;
      }

      .section-title {
        @apply text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3;
      }

      .input-label {
        @apply block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1;
      }

      .input-hint {
        @apply text-xs text-gray-500 dark:text-gray-400 mt-1;
      }

      .progress-section {
        @apply mb-4;
      }

      .progress-header {
        @apply flex justify-between items-center mb-2;
      }

      .progress-label {
        @apply text-sm font-medium text-gray-700 dark:text-gray-300;
      }

      .progress-value {
        @apply text-sm font-bold text-blue-600 dark:text-blue-400;
      }

      .custom-progress ::ng-deep .p-progressbar-value {
        @apply bg-gradient-to-r from-blue-500 to-blue-600;
      }

      .custom-progress-green ::ng-deep .p-progressbar-value {
        @apply bg-gradient-to-r from-green-500 to-green-600;
      }

      .time-grid {
        @apply grid grid-cols-2 gap-4 mt-4;
      }

      .time-item {
        @apply text-center;
      }

      .time-label {
        @apply block text-sm text-gray-600 dark:text-gray-400;
      }

      .time-value {
        @apply block text-lg font-bold text-gray-900 dark:text-gray-100;
      }

      .settings-accordion ::ng-deep .p-accordion-header {
        @apply bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700;
      }

      .settings-content {
        @apply space-y-6;
      }

      .setting-item {
        @apply space-y-2;
      }

      .setting-label {
        @apply block text-sm font-semibold text-gray-700 dark:text-gray-300;
      }

      .setting-hint {
        @apply text-xs text-gray-500 dark:text-gray-400;
      }

      .setting-warning {
        @apply text-xs text-yellow-600 dark:text-yellow-400;
      }

      .speed-info {
        @apply text-center;
      }

      .speed-value {
        @apply text-lg font-bold text-gray-900 dark:text-gray-100 mb-2;
      }

      .speed-presets {
        @apply flex gap-1;
      }

      .color-picker-container {
        @apply flex items-center gap-3;
      }

      .color-presets {
        @apply flex gap-1;
      }

      .color-preset {
        @apply w-6 h-6 rounded border-2 border-gray-300 dark:border-gray-600 cursor-pointer hover:scale-110 transition-transform;
      }

      .toggle-grid {
        @apply space-y-4;
      }

      .toggle-item {
        @apply flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg;
      }

      .toggle-label {
        @apply text-sm font-semibold text-gray-700 dark:text-gray-300;
      }

      .slider-labels {
        @apply flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1;
      }

      .performance-slider ::ng-deep .p-slider-range {
        @apply bg-gradient-to-r from-blue-500 to-blue-600;
      }

      .build-volume-grid {
        @apply grid grid-cols-3 gap-3;
      }

      .volume-input {
        @apply text-center;
      }

      .volume-input label {
        @apply block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1;
      }

      .camera-grid {
        @apply grid grid-cols-2 gap-2;
      }

      .action-buttons {
        @apply p-4 space-y-3 border-t border-gray-200 dark:border-gray-700;
      }

      .action-button ::ng-deep {
        @apply shadow-lg hover:shadow-xl transition-all duration-300;
      }

      @media (max-width: 1024px) {
        .control-panel {
          @apply hidden;
        }
      }
    `,
  ],
})
export class PrinterControlPanelComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly confirmationService = inject(ConfirmationService);
  private settingsUpdateSubject = new Subject<SettingsUpdate>();

  // Inputs
  readonly printerState = input.required<PrinterState>();
  readonly simulationState = input.required<SimulationState>();
  readonly settings = input.required<ViewportSettings>();

  // Outputs
  readonly controlAction = output<ControlAction>();
  readonly settingsChange = output<SettingsUpdate>();
  readonly cameraAction = output<'reset' | 'focus' | 'topView' | 'isometric'>();
  readonly actionButtonClick = output<'showHistory' | 'exportSettings'>();

  // Local state signals
  readonly jumpTarget = signal<number>(1);
  readonly selectedQualityProfile = signal<string>('Medium Quality');
  readonly isLoading = signal<Record<ControlActionType, boolean>>({
    start: false,
    pause: false,
    stop: false,
    reset: false,
    stepBack: false,
    stepForward: false,
    jumpTo: false,
  });

  // Local settings state for immediate UI updates
  readonly currentAnimationSpeed = signal<number>(1.0);
  readonly currentFilamentColor = signal<string>('#FF4444');
  readonly currentLayerHeight = signal<number>(0.2);
  readonly currentMaxPathPoints = signal<number>(50000);
  readonly currentCurveResolution = signal<number>(20);
  readonly currentBuildVolume = signal({ x: 200, y: 200, z: 200 });

  // Configuration
  readonly speedPresets = [
    { label: '0.1x', value: 0.1 },
    { label: '0.5x', value: 0.5 },
    { label: '1x', value: 1.0 },
    { label: '2x', value: 2.0 },
    { label: '5x', value: 5.0 },
    { label: '10x', value: 10.0 },
  ];

  readonly colorPresets = [
    '#FF4444',
    '#44FF44',
    '#4444FF',
    '#FFFF44',
    '#FF44FF',
    '#44FFFF',
    '#FF8844',
    '#8844FF',
  ];

  readonly qualityProfileOptions = QUALITY_PROFILES;

  readonly displayToggles = [
    {
      key: 'showTravelMoves' as const,
      label: 'Travel Moves',
      onIcon: 'pi pi-eye',
      offIcon: 'pi pi-eye-slash',
      tooltip: 'Show non-printing travel moves',
    },
    {
      key: 'showBuildPlate' as const,
      label: 'Build Plate',
      onIcon: 'pi pi-eye',
      offIcon: 'pi pi-eye-slash',
      tooltip: 'Show the printer build plate',
    },
    {
      key: 'showBezierControls' as const,
      label: 'Bezier Controls',
      onIcon: 'pi pi-eye',
      offIcon: 'pi pi-eye-slash',
      tooltip: 'Show Bezier curve control points',
    },
    {
      key: 'enableShadows' as const,
      label: 'Shadows',
      onIcon: 'pi pi-sun',
      offIcon: 'pi pi-moon',
      tooltip: 'Enable realistic shadows (may impact performance)',
    },
    {
      key: 'antialiasing' as const,
      label: 'Anti-aliasing',
      onIcon: 'pi pi-check-circle',
      offIcon: 'pi pi-times-circle',
      tooltip: 'Enable anti-aliasing for smoother edges',
    },
  ];

  readonly cameraActions = [
    {
      action: 'reset' as const,
      icon: 'pi pi-home',
      label: 'Reset View',
      tooltip: 'Reset camera to default position',
    },
    {
      action: 'focus' as const,
      icon: 'pi pi-search-plus',
      label: 'Focus Object',
      tooltip: 'Focus camera on the printed object',
    },
    {
      action: 'topView' as const,
      icon: 'pi pi-arrow-up',
      label: 'Top View',
      tooltip: 'Switch to top-down view',
    },
    {
      action: 'isometric' as const,
      icon: 'pi pi-th-large',
      label: 'Isometric',
      tooltip: 'Switch to isometric view',
    },
  ];

  // Computed properties
  readonly currentSettings = computed(() => this.settings());

  readonly simulationStateDisplay = computed(() => {
    const state = this.simulationState();
    return state.charAt(0).toUpperCase() + state.slice(1);
  });

  readonly layerProgress = computed(() => {
    const current = this.printerState().currentLayer;
    const total = Math.max(1, this.printerState().totalLayers);
    return Math.round((current / total) * 100);
  });

  readonly maxJumpTarget = computed(() => {
    return Math.max(0, this.printerState().totalCommands - 1);
  });

  readonly estimatedCompletion = computed(() => {
    const remaining = this.printerState().estimatedTimeRemaining;
    if (remaining <= 0) return null;

    const now = new Date();
    const eta = new Date(now.getTime() + remaining * 1000);
    return eta.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  });

  readonly isAnimating = computed(() => {
    return this.simulationState() === SimulationState.RUNNING;
  });

  readonly primaryControlButtons = computed((): ControlButtonConfig[] => [
    {
      type: 'start',
      icon: 'pi pi-play',
      label: 'Start',
      severity: 'success',
      tooltip: 'Start simulation (Space)',
      shortcut: 'Space',
    },
    {
      type: 'pause',
      icon:
        this.simulationState() === SimulationState.PAUSED
          ? 'pi pi-play'
          : 'pi pi-pause',
      label:
        this.simulationState() === SimulationState.PAUSED ? 'Resume' : 'Pause',
      severity:
        this.simulationState() === SimulationState.PAUSED ? 'info' : 'warning',
      tooltip:
        this.simulationState() === SimulationState.PAUSED
          ? 'Resume simulation (P)'
          : 'Pause simulation (P)',
      shortcut: 'P',
    },
    {
      type: 'stop',
      icon: 'pi pi-stop',
      label: 'Stop',
      severity: 'danger',
      tooltip: 'Stop simulation (S)',
      shortcut: 'S',
    },
    {
      type: 'reset',
      icon: 'pi pi-refresh',
      label: 'Reset',
      severity: 'secondary',
      tooltip: 'Reset to beginning (R)',
      shortcut: 'R',
    },
  ]);

  // Control state computed properties
  readonly canStart = computed(() => {
    const state = this.simulationState();
    return (
      state === SimulationState.IDLE || state === SimulationState.COMPLETED
    );
  });

  readonly canPause = computed(() => {
    const state = this.simulationState();
    return (
      state === SimulationState.RUNNING || state === SimulationState.PAUSED
    );
  });

  readonly canStop = computed(() => {
    const state = this.simulationState();
    return (
      state === SimulationState.RUNNING || state === SimulationState.PAUSED
    );
  });

  readonly canReset = computed(() => {
    return this.simulationState() !== SimulationState.RUNNING;
  });

  readonly canStepBack = computed(() => {
    return this.printerState().currentCommandIndex > 0 && this.canReset();
  });

  readonly canStepForward = computed(() => {
    const current = this.printerState().currentCommandIndex;
    const total = this.printerState().totalCommands;
    return current < total - 1 && this.canReset();
  });

  readonly canStepBackMultiple = computed(() => {
    return this.printerState().currentCommandIndex >= 10 && this.canReset();
  });

  readonly canStepForwardMultiple = computed(() => {
    const current = this.printerState().currentCommandIndex;
    const total = this.printerState().totalCommands;
    return current < total - 10 && this.canReset();
  });

  readonly isValidJumpTarget = computed(() => {
    const target = this.jumpTarget();
    const max = this.maxJumpTarget();
    return target >= 1 && target <= max + 1 && this.canReset();
  });

  constructor() {
    this.setupEffects();
    this.setupSettingsDebouncing();
    this.syncLocalSettingsWithInput();
  }

  // Event handlers
  handleAction(type: ControlActionType, payload?: unknown): void {
    if (type === 'reset' || type === 'stop') {
      this.confirmationService.confirm({
        message: `Are you sure you want to ${type} the simulation?`,
        header: `Confirm ${type.charAt(0).toUpperCase() + type.slice(1)}`,
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: type.charAt(0).toUpperCase() + type.slice(1),
        rejectLabel: 'Cancel',
        accept: () => {
          this.executeAction(type, payload);
        },
      });
    } else {
      this.executeAction(type, payload);
    }
  }

  handleJump(): void {
    if (this.isValidJumpTarget()) {
      const targetIndex = this.jumpTarget() - 1; // Convert to 0-based index
      this.executeAction('jumpTo', targetIndex);
    }
  }

  handleCameraAction(
    action: 'reset' | 'focus' | 'topView' | 'isometric'
  ): void {
    this.cameraAction.emit(action);
  }

  handleExportSettings(): void {
    this.actionButtonClick.emit('exportSettings');
  }

  // Settings update handlers
  updateAnimationSpeed(speed: number): void {
    this.currentAnimationSpeed.set(speed);
    this.debouncedSettingsUpdate('animationSpeed', speed);
  }

  updateFilamentColor(color: string): void {
    this.currentFilamentColor.set(color);
    this.debouncedSettingsUpdate('filamentColor', color);
  }

  updateLayerHeight(height: number | null): void {
    if (height !== null) {
      this.currentLayerHeight.set(height);
      this.debouncedSettingsUpdate('layerHeight', height);
    }
  }

  updateMaxPathPoints(points: number): void {
    this.currentMaxPathPoints.set(points);
    this.debouncedSettingsUpdate('maxPathPoints', points);
  }

  updateCurveResolution(resolution: number): void {
    this.currentCurveResolution.set(resolution);
    this.debouncedSettingsUpdate('curveResolution', resolution);
  }

  updateBuildVolume(dimension: 'x' | 'y' | 'z', value: number | null): void {
    if (value !== null) {
      this.currentBuildVolume.update((current) => ({
        ...current,
        [dimension]: value,
      }));
      this.debouncedSettingsUpdate('buildVolume', this.currentBuildVolume());
    }
  }

  updateToggleSetting(key: keyof ViewportSettings, value: boolean): void {
    this.settingsChange.emit({ setting: key, value });
  }

  // Preset handlers
  setSpeedPreset(speed: number): void {
    this.updateAnimationSpeed(speed);
  }

  setColorPreset(color: string): void {
    this.updateFilamentColor(color);
  }

  applyQualityProfile(profileName: string): void {
    const profile = this.qualityProfileOptions.find(
      (p) => p.name === profileName
    );
    if (!profile) return;

    const settings = profile.settings;

    this.currentCurveResolution.set(settings.curveResolution);
    this.currentMaxPathPoints.set(settings.maxPathPoints);

    // Apply multiple settings
    this.settingsChange.emit({
      setting: 'curveResolution',
      value: settings.curveResolution,
    });
    this.settingsChange.emit({
      setting: 'maxPathPoints',
      value: settings.maxPathPoints,
    });
    this.settingsChange.emit({
      setting: 'antialiasing',
      value: settings.antialiasing,
    });
    this.settingsChange.emit({
      setting: 'enableShadows',
      value: settings.shadows,
    });

    console.log(`Applied quality profile: ${profileName}`);
  }

  // Validation
  validateJumpTarget(target: number | null): ValidationResult {
    if (target === null) {
      return { isValid: false, message: 'Please enter a valid command number' };
    }

    const max = this.maxJumpTarget() + 1;
    if (target < 1 || target > max) {
      return {
        isValid: false,
        message: `Command number must be between 1 and ${max}`,
      };
    }

    return { isValid: true };
  }

  // Utility methods
  isButtonEnabled(type: ControlActionType): boolean {
    switch (type) {
      case 'start':
        return this.canStart();
      case 'pause':
        return this.canPause();
      case 'stop':
        return this.canStop();
      case 'reset':
        return this.canReset();
      case 'stepBack':
        return this.canStepBack();
      case 'stepForward':
        return this.canStepForward();
      case 'jumpTo':
        return this.isValidJumpTarget();
      default:
        return false;
    }
  }

  isButtonLoading(type: ControlActionType): boolean {
    return this.isLoading()[type];
  }

  getButtonClass(type: ControlActionType): string {
    const classes = ['transition-all', 'duration-200'];

    if (type === 'start' && this.canStart()) {
      classes.push('animate-pulse');
    }

    return classes.join(' ');
  }

  getButtonTooltip(button: ControlButtonConfig): string {
    let tooltip = button.tooltip;
    if (!this.isButtonEnabled(button.type)) {
      tooltip += ' (disabled)';
    }
    return tooltip;
  }

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

  getToggleValue(key: keyof ViewportSettings): boolean {
    return this.currentSettings()[key] as boolean;
  }

  getSelectedProfile(): QualityProfile | undefined {
    return this.qualityProfileOptions.find(
      (p) => p.name === this.selectedQualityProfile()
    );
  }

  formatTime(seconds: number): string {
    if (seconds < 60) {
      return `${seconds.toFixed(0)}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = Math.floor(seconds % 60);
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
  }

  showShortcuts(): void {
    // Implementation for showing keyboard shortcuts
    console.log('Keyboard shortcuts modal would be shown here');
  }

  // Track by functions
  trackByButton = (index: number, button: ControlButtonConfig): string =>
    button.type;
  trackByToggle = (index: number, toggle: any): string => toggle.key;
  trackByCameraAction = (index: number, action: any): string => action.action;

  // Private methods
  private executeAction(type: ControlActionType, payload?: unknown): void {
    // Set loading state
    this.isLoading.update((current) => ({ ...current, [type]: true }));

    // Execute action
    this.controlAction.emit({ type, payload });

    // Clear loading state after a delay
    setTimeout(() => {
      this.isLoading.update((current) => ({ ...current, [type]: false }));
    }, 500);
  }

  private debouncedSettingsUpdate(
    setting: keyof ViewportSettings,
    value: unknown
  ): void {
    this.settingsUpdateSubject.next({ setting, value });
  }

  private setupEffects(): void {
    // Update jump target when command index changes
    effect(() => {
      const currentIndex = this.printerState().currentCommandIndex;
      this.jumpTarget.set(currentIndex + 1);
    });
  }

  private setupSettingsDebouncing(): void {
    this.settingsUpdateSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged(
          (prev, curr) =>
            prev.setting === curr.setting && prev.value === curr.value
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((update) => {
        this.settingsChange.emit(update);
      });
  }

  private syncLocalSettingsWithInput(): void {
    // Sync local state with input settings when they change
    effect(() => {
      const settings = this.currentSettings();

      this.currentAnimationSpeed.set(settings.animationSpeed);
      this.currentFilamentColor.set(settings.filamentColor);
      this.currentLayerHeight.set(settings.layerHeight);
      this.currentMaxPathPoints.set(settings.maxPathPoints);
      this.currentCurveResolution.set(settings.curveResolution);
      this.currentBuildVolume.set(settings.buildVolume);
    });
  }
}
