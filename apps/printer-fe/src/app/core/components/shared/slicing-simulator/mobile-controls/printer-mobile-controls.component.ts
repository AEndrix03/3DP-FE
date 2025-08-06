// src/app/printer-simulator/components/mobile-controls/printer-mobile-controls.component.ts

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { SliderModule } from 'primeng/slider';
import { ColorPickerModule } from 'primeng/colorpicker';
import { ToggleButtonModule } from 'primeng/togglebutton';
import { SidebarModule } from 'primeng/sidebar';
import { SpeedDialModule } from 'primeng/speeddial';
import { TabViewModule } from 'primeng/tabview';
import { TooltipModule } from 'primeng/tooltip';
import { OverlayPanelModule } from 'primeng/overlaypanel';
import { BadgeModule } from 'primeng/badge';
import { KnobModule } from 'primeng/knob';
import { PanelModule } from 'primeng/panel';
import { MenuItem } from 'primeng/api';
import {
  debounceTime,
  distinctUntilChanged,
  fromEvent,
  merge,
  Subject,
} from 'rxjs';
import {
  ControlActionType,
  DEFAULT_VIEWPORT_SETTINGS,
  PrinterState,
  SimulationState,
  ViewportSettings,
} from '../../../../models/simulator/simulator.models';
import {
  ControlAction,
  SettingsUpdate,
} from '../control-panel/printer-control-panel.component';
import { Tag } from 'primeng/tag';
import { ProgressBar } from 'primeng/progressbar';

interface MobileControlsState {
  readonly sidebarVisible: boolean;
  readonly quickActionsVisible: boolean;
  readonly isLandscape: boolean;
  readonly screenSize: 'xs' | 'sm' | 'md' | 'lg';
  readonly reducedMotion: boolean;
}

interface QuickAction {
  readonly type: ControlActionType;
  readonly icon: string;
  readonly label: string;
  readonly severity: 'success' | 'info' | 'warn' | 'danger' | 'secondary';
  readonly priority: number;
}

@Component({
  selector: 'printer-mobile-controls',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    SliderModule,
    ColorPickerModule,
    ToggleButtonModule,
    SidebarModule,
    SpeedDialModule,
    TabViewModule,
    TooltipModule,
    OverlayPanelModule,
    BadgeModule,
    KnobModule,
    PanelModule,
    Tag,
    ProgressBar,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Mobile Header -->
    <header
      class="mobile-header lg:hidden"
      [class.landscape]="mobileState().isLandscape"
    >
      <div class="header-content">
        <div class="header-left">
          <h1 class="header-title">G-Code Simulator</h1>
          <div class="header-status" *ngIf="!mobileState().isLandscape">
            <p-tag
              [value]="simulationStateDisplay()"
              [severity]="getStateSeverity()"
              [ngClass]="{ 'animate-pulse': isAnimating() }"
              size="small"
            />
            <span class="progress-indicator"
              >{{ printerState().printProgress.toFixed(1) }}%</span
            >
          </div>
        </div>

        <div class="header-actions">
          <p-button
            icon="pi pi-chart-line"
            (onClick)="actionButtonClick.emit('showHistory')"
            severity="info"
            [text]="true"
            size="small"
            pTooltip="Command history"
            tooltipPosition="bottom"
            [rounded]="true"
          />
          <p-button
            icon="pi pi-cog"
            (onClick)="toggleSidebar()"
            severity="secondary"
            [text]="true"
            size="small"
            pTooltip="Open controls"
            tooltipPosition="bottom"
            [rounded]="true"
            [badge]="hasActiveSettings() ? '!' : null"
            badgeClass="p-badge-warn"
          />
        </div>
      </div>

      <!-- Landscape Progress Bar -->
      <div class="landscape-progress" *ngIf="mobileState().isLandscape">
        <div class="progress-info">
          <span class="progress-text">
            {{ printerState().currentLayer }}/{{ printerState().totalLayers }}
            layers
          </span>
          <span class="progress-text">
            {{ printerState().printProgress.toFixed(1) }}%
          </span>
        </div>
        <p-progressBar
          [value]="printerState().printProgress"
          [showValue]="false"
          styleClass="landscape-progress-bar"
        />
      </div>
    </header>

    <!-- Quick Action Floating Buttons -->
    <div
      class="quick-actions lg:hidden"
      [class.landscape]="mobileState().isLandscape"
      *ngIf="showQuickActions()"
    >
      <!-- Primary Action Button -->
      <p-button
        [icon]="getPrimaryActionIcon()"
        (onClick)="handlePrimaryAction()"
        [severity]="getPrimaryActionSeverity()"
        [rounded]="true"
        size="large"
        class="primary-action-btn"
        [pTooltip]="getPrimaryActionTooltip()"
        tooltipPosition="left"
        [disabled]="!isPrimaryActionEnabled()"
        [loading]="isPrimaryActionLoading()"
      />

      <!-- Secondary Actions -->
      <div class="secondary-actions" [class.expanded]="expandedActions()">
        <p-button
          *ngFor="let action of getSecondaryActions(); trackBy: trackByAction"
          [icon]="action.icon"
          (onClick)="handleAction(action.type)"
          [severity]="action.severity"
          [rounded]="true"
          size="small"
          [pTooltip]="action.label"
          tooltipPosition="left"
          [disabled]="!isActionEnabled(action.type)"
          class="secondary-action-btn"
          [attr.data-priority]="action.priority"
        />
      </div>

      <!-- Expand/Collapse Toggle -->
      <p-button
        [icon]="expandedActions() ? 'pi pi-angle-down' : 'pi pi-angle-up'"
        (onClick)="toggleExpandedActions()"
        severity="secondary"
        [rounded]="true"
        size="small"
        class="expand-toggle-btn"
        pTooltip="More actions"
        tooltipPosition="left"
        *ngIf="getSecondaryActions().length > 0"
      />
    </div>

    <!-- Speed Dial (Alternative to Quick Actions) -->
    <div
      class="speed-dial-container lg:hidden"
      *ngIf="!showQuickActions() && !mobileState().reducedMotion"
    >
      <p-speedDial
        [model]="speedDialItems()"
        direction="up"
        [transitionDelay]="80"
        showIcon="pi pi-play"
        hideIcon="pi pi-times"
        buttonClassName="speed-dial-button"
        maskClassName="speed-dial-mask"
        [disabled]="simulationState() === 'loading'"
      />
    </div>

    <!-- Mobile Sidebar -->
    <p-sidebar
      [(visible)]="sidebarVisible"
      position="right"
      [styleClass]="getSidebarStyleClass()"
      [modal]="true"
      [dismissible]="true"
      [showCloseIcon]="true"
      [closeOnEscape]="true"
      [blockScroll]="true"
      [baseZIndex]="10000"
    >
      <ng-template pTemplate="header">
        <div class="sidebar-header">
          <div class="sidebar-title">
            <i class="pi pi-cog text-xl"></i>
            <h3 class="text-xl font-bold">Controls</h3>
          </div>
          <div class="sidebar-status">
            <span class="text-sm text-muted-color">
              {{ formatTime(printerState().executionTime) }} elapsed
            </span>
          </div>
        </div>
      </ng-template>

      <div class="sidebar-content">
        <p-tabView
          styleClass="mobile-tabs"
          [scrollable]="true"
          [activeIndex]="activeTabIndex()"
          (activeIndexChange)="setActiveTab($event)"
        >
          <!-- Controls Tab -->
          <p-tabPanel header="Controls" leftIcon="pi pi-play">
            <div class="tab-content controls-tab">
              <!-- Primary Controls Grid -->
              <p-panel
                header="Primary Controls"
                [toggleable]="false"
                styleClass="control-panel"
              >
                <div class="control-grid primary-grid">
                  <p-button
                    *ngFor="
                      let button of getPrimaryControlButtons();
                      trackBy: trackByButton
                    "
                    [label]="button.label"
                    [icon]="button.icon"
                    [disabled]="!isActionEnabled(button.type)"
                    (onClick)="handleActionWithFeedback(button.type)"
                    [severity]="button.severity"
                    size="small"
                    styleClass="control-btn"
                    [raised]="true"
                    [loading]="isActionLoading()"
                  />
                </div>
              </p-panel>

              <!-- Step Controls -->
              <p-panel
                header="Step Controls"
                [toggleable]="true"
                styleClass="control-panel"
              >
                <div class="step-controls">
                  <div class="step-info">
                    <span class="step-label">Command:</span>
                    <span class="step-value">
                      {{ printerState().currentCommandIndex + 1 }} /
                      {{ printerState().totalCommands }}
                    </span>
                  </div>

                  <div class="step-buttons">
                    <p-button
                      label="← 10"
                      [disabled]="!canStepBackMultiple()"
                      (onClick)="handleAction('stepBack', 10)"
                      severity="secondary"
                      size="small"
                      [text]="true"
                      styleClass="step-btn"
                    />
                    <p-button
                      label="← 1"
                      [disabled]="!canStepBack()"
                      (onClick)="handleAction('stepBack', 1)"
                      severity="secondary"
                      size="small"
                      [text]="true"
                      styleClass="step-btn"
                    />
                    <p-button
                      label="1 →"
                      [disabled]="!canStepForward()"
                      (onClick)="handleAction('stepForward', 1)"
                      severity="secondary"
                      size="small"
                      [text]="true"
                      styleClass="step-btn"
                    />
                    <p-button
                      label="10 →"
                      [disabled]="!canStepForwardMultiple()"
                      (onClick)="handleAction('stepForward', 10)"
                      severity="secondary"
                      size="small"
                      [text]="true"
                      styleClass="step-btn"
                    />
                  </div>
                </div>
              </p-panel>

              <!-- Speed Control -->
              <p-panel
                header="Animation Speed"
                [toggleable]="true"
                styleClass="control-panel"
              >
                <div class="speed-control">
                  <div class="speed-display">
                    <p-knob
                      [(ngModel)]="localAnimationSpeed"
                      [min]="0.1"
                      [max]="10"
                      [step]="0.1"
                      [size]="80"
                      [strokeWidth]="6"
                      valueColor="#3b82f6"
                      rangeColor="#e5e7eb"
                      textColor="#374151"
                      (onChange)="updateAnimationSpeed($event)"
                      [disabled]="simulationState() === 'running'"
                    />
                    <div class="speed-info">
                      <span class="speed-value"
                        >{{ localAnimationSpeed.toFixed(1) }}x</span
                      >
                      <div class="speed-presets">
                        <p-button
                          *ngFor="let preset of speedPresets"
                          [label]="preset.label"
                          (onClick)="setSpeedPreset(preset.value)"
                          [severity]="
                            localAnimationSpeed === preset.value
                              ? 'info'
                              : 'secondary'
                          "
                          size="small"
                          [text]="true"
                          [disabled]="simulationState() === 'running'"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </p-panel>
            </div>
          </p-tabPanel>

          <!-- Settings Tab -->
          <p-tabPanel header="Settings" leftIcon="pi pi-cog">
            <div class="tab-content settings-tab">
              <!-- Visual Settings -->
              <p-panel
                header="Visual Settings"
                [toggleable]="true"
                styleClass="settings-panel"
              >
                <div class="settings-group">
                  <!-- Filament Color -->
                  <div class="setting-item">
                    <label class="setting-label">Filament Color</label>
                    <div class="color-setting">
                      <p-colorPicker
                        [(ngModel)]="localFilamentColor"
                        format="hex"
                        (onChange)="updateFilamentColor($event)"
                        [inline]="false"
                      />
                      <div class="color-presets">
                        <button
                          *ngFor="let color of colorPresets"
                          class="color-preset-btn"
                          [style.backgroundColor]="color"
                          (click)="setColorPreset(color)"
                          [class.active]="localFilamentColor === color"
                        ></button>
                      </div>
                    </div>
                  </div>
                </div>
              </p-panel>

              <!-- Display Options -->
              <p-panel
                header="Display Options"
                [toggleable]="true"
                styleClass="settings-panel"
              >
                <div class="settings-group">
                  <div
                    class="toggle-setting"
                    *ngFor="
                      let toggle of displayToggles;
                      trackBy: trackByToggle
                    "
                  >
                    <label class="toggle-label">{{ toggle.label }}</label>
                    <p-toggleButton
                      [ngModel]="getToggleValue(toggle.key)"
                      (ngModelChange)="updateToggleSetting(toggle.key, $event)"
                      [onIcon]="toggle.onIcon"
                      [offIcon]="toggle.offIcon"
                      size="small"
                    />
                  </div>
                </div>
              </p-panel>

              <!-- Performance Settings -->
              <p-panel
                header="Performance"
                [toggleable]="true"
                [collapsed]="true"
                styleClass="settings-panel"
              >
                <div class="settings-group">
                  <div class="setting-item">
                    <label class="setting-label">
                      Max Path Points: {{ localMaxPathPoints.toLocaleString() }}
                    </label>
                    <p-slider
                      [(ngModel)]="localMaxPathPoints"
                      [min]="1000"
                      [max]="25000"
                      [step]="1000"
                      (onChange)="updateMaxPathPoints($event.value)"
                      styleClass="mobile-slider"
                    />
                    <div class="slider-labels">
                      <span class="slider-label">1K (Fast)</span>
                      <span class="slider-label">25K (Quality)</span>
                    </div>
                    <small class="setting-note">
                      Lower values improve performance on mobile devices
                    </small>
                  </div>
                </div>
              </p-panel>
            </div>
          </p-tabPanel>

          <!-- Status Tab -->
          <p-tabPanel header="Status" leftIcon="pi pi-info-circle">
            <div class="tab-content status-tab">
              <!-- Current Status -->
              <p-panel
                header="Current Status"
                [toggleable]="false"
                styleClass="status-panel"
              >
                <div class="status-grid">
                  <div class="status-item">
                    <span class="status-label">State</span>
                    <p-tag
                      [value]="simulationStateDisplay()"
                      [severity]="getStateSeverity()"
                      [ngClass]="{ 'animate-pulse': isAnimating() }"
                    />
                  </div>

                  <div class="status-item">
                    <span class="status-label">Progress</span>
                    <span class="status-value"
                      >{{ printerState().printProgress.toFixed(1) }}%</span
                    >
                  </div>

                  <div class="status-item">
                    <span class="status-label">Layer</span>
                    <span class="status-value">
                      {{ printerState().currentLayer }} /
                      {{ printerState().totalLayers }}
                    </span>
                  </div>
                </div>
              </p-panel>

              <!-- Position Info -->
              <p-panel
                header="Current Position"
                [toggleable]="true"
                styleClass="status-panel"
              >
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
                </div>
              </p-panel>

              <!-- Extruder Status -->
              <p-panel
                header="Extruder Status"
                [toggleable]="true"
                styleClass="status-panel"
              >
                <div class="extruder-info">
                  <div class="extruder-status">
                    <span class="extruder-label">Status</span>
                    <p-tag
                      [value]="
                        printerState().isExtruding ? 'EXTRUDING' : 'IDLE'
                      "
                      [severity]="
                        printerState().isExtruding ? 'success' : 'secondary'
                      "
                      [ngClass]="{
                        'animate-pulse': printerState().isExtruding
                      }"
                    />
                  </div>

                  <div class="extruder-details">
                    <div class="detail-item">
                      <span class="detail-label">E Position</span>
                      <span class="detail-value"
                        >{{
                          printerState().extruderPosition.toFixed(2)
                        }}mm</span
                      >
                    </div>
                    <div class="detail-item">
                      <span class="detail-label">Temperature</span>
                      <span class="detail-value"
                        >{{ printerState().temperature }}°C</span
                      >
                    </div>
                    <div class="detail-item">
                      <span class="detail-label">Bed Temperature</span>
                      <span class="detail-value"
                        >{{ printerState().bedTemperature }}°C</span
                      >
                    </div>
                  </div>
                </div>
              </p-panel>

              <!-- Timing Info -->
              <p-panel
                header="Time Information"
                [toggleable]="true"
                styleClass="status-panel"
              >
                <div class="timing-grid">
                  <div class="timing-item">
                    <span class="timing-label">Elapsed</span>
                    <span class="timing-value">{{
                      formatTime(printerState().executionTime)
                    }}</span>
                  </div>
                  <div class="timing-item">
                    <span class="timing-label">Remaining</span>
                    <span class="timing-value">{{
                      formatTime(printerState().estimatedTimeRemaining)
                    }}</span>
                  </div>
                  <div class="timing-item" *ngIf="estimatedCompletion()">
                    <span class="timing-label">ETA</span>
                    <span class="timing-value">{{
                      estimatedCompletion()
                    }}</span>
                  </div>
                </div>
              </p-panel>

              <!-- Camera Controls -->
              <p-panel
                header="Camera Controls"
                [toggleable]="true"
                styleClass="status-panel"
              >
                <div class="camera-controls">
                  <p-button
                    *ngFor="let camera of cameraActions"
                    [label]="camera.label"
                    [icon]="camera.icon"
                    (onClick)="cameraAction.emit(camera.action)"
                    severity="secondary"
                    size="small"
                    [text]="true"
                    styleClass="camera-btn"
                  />
                </div>
              </p-panel>
            </div>
          </p-tabPanel>
        </p-tabView>
      </div>
    </p-sidebar>
  `,
  styles: [
    `
      :host {
        @apply lg:hidden;
      }

      .mobile-header {
        @apply fixed top-0 left-0 right-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-lg;
      }

      .mobile-header.landscape {
        @apply h-16;
      }

      .header-content {
        @apply flex items-center justify-between p-3;
      }

      .header-left {
        @apply flex flex-col;
      }

      .header-title {
        @apply text-lg font-bold text-gray-900 dark:text-white;
      }

      .header-status {
        @apply flex items-center gap-2 mt-1;
      }

      .progress-indicator {
        @apply text-sm font-semibold text-blue-600 dark:text-blue-400;
      }

      .header-actions {
        @apply flex items-center gap-2;
      }

      .landscape-progress {
        @apply px-3 pb-2;
      }

      .progress-info {
        @apply flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1;
      }

      .landscape-progress-bar ::ng-deep .p-progressbar {
        @apply h-2;
      }

      .quick-actions {
        @apply fixed bottom-6 right-4 z-50 flex flex-col-reverse items-end gap-3;
      }

      .quick-actions.landscape {
        @apply right-6 bottom-4;
      }

      .primary-action-btn {
        @apply shadow-lg transform transition-all duration-200;
      }

      .primary-action-btn:hover {
        @apply scale-105;
      }

      .secondary-actions {
        @apply flex flex-col-reverse gap-2 overflow-hidden transition-all duration-300;
      }

      .secondary-actions:not(.expanded) {
        @apply max-h-0;
      }

      .secondary-actions.expanded {
        @apply max-h-96;
      }

      .secondary-action-btn {
        @apply shadow-md transform transition-all duration-200 opacity-90;
      }

      .expand-toggle-btn {
        @apply opacity-70;
      }

      .speed-dial-container {
        @apply fixed bottom-6 right-4 z-50;
      }

      .speed-dial-button {
        @apply shadow-lg bg-blue-600 hover:bg-blue-700 border-blue-600 hover:border-blue-700;
      }

      .speed-dial-mask {
        @apply bg-black/20 backdrop-blur-sm;
      }

      .sidebar-content {
        @apply h-full overflow-hidden;
      }

      .sidebar-header {
        @apply flex items-center justify-between w-full;
      }

      .sidebar-title {
        @apply flex items-center gap-3;
      }

      .sidebar-status {
        @apply text-right;
      }

      .mobile-tabs ::ng-deep .p-tabview-nav {
        @apply justify-center;
      }

      .mobile-tabs ::ng-deep .p-tabview-panels {
        @apply overflow-auto flex-1;
        max-height: calc(100vh - 200px);
      }

      .tab-content {
        @apply space-y-4 p-1;
      }

      .control-panel,
      .settings-panel,
      .status-panel {
        @apply mb-4;
      }

      .control-panel ::ng-deep .p-panel-header {
        @apply bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300;
      }

      .settings-panel ::ng-deep .p-panel-header {
        @apply bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300;
      }

      .status-panel ::ng-deep .p-panel-header {
        @apply bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300;
      }

      .primary-grid {
        @apply grid grid-cols-2 gap-3;
      }

      .control-btn {
        @apply h-12 font-semibold;
      }

      .step-controls {
        @apply space-y-4;
      }

      .step-info {
        @apply flex justify-between items-center text-sm;
      }

      .step-label {
        @apply font-medium text-gray-600 dark:text-gray-400;
      }

      .step-value {
        @apply font-semibold text-gray-900 dark:text-gray-100;
      }

      .step-buttons {
        @apply grid grid-cols-4 gap-2;
      }

      .step-btn {
        @apply text-xs;
      }

      .speed-control {
        @apply flex justify-center;
      }

      .speed-display {
        @apply flex flex-col items-center gap-4;
      }

      .speed-info {
        @apply text-center;
      }

      .speed-value {
        @apply text-lg font-bold text-gray-900 dark:text-gray-100 mb-2;
      }

      .speed-presets {
        @apply flex flex-wrap gap-1 justify-center;
      }

      .settings-group {
        @apply space-y-4;
      }

      .setting-item {
        @apply space-y-2;
      }

      .setting-label {
        @apply block text-sm font-semibold text-gray-700 dark:text-gray-300;
      }

      .color-setting {
        @apply flex items-center gap-3;
      }

      .color-presets {
        @apply flex gap-2;
      }

      .color-preset-btn {
        @apply w-8 h-8 rounded border-2 border-gray-300 dark:border-gray-600 cursor-pointer transition-all;
      }

      .color-preset-btn.active {
        @apply border-blue-500 scale-110;
      }

      .toggle-setting {
        @apply flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg;
      }

      .toggle-label {
        @apply text-sm font-semibold text-gray-700 dark:text-gray-300;
      }

      .mobile-slider ::ng-deep .p-slider {
        @apply mb-2;
      }

      .slider-labels {
        @apply flex justify-between;
      }

      .slider-label {
        @apply text-xs text-gray-500 dark:text-gray-400;
      }

      .setting-note {
        @apply text-xs text-gray-500 dark:text-gray-400 italic;
      }

      .status-grid {
        @apply space-y-3;
      }

      .status-item {
        @apply flex items-center justify-between;
      }

      .status-label {
        @apply text-sm font-medium text-gray-600 dark:text-gray-400;
      }

      .status-value {
        @apply text-sm font-semibold text-gray-900 dark:text-gray-100;
      }

      .position-grid {
        @apply grid grid-cols-3 gap-4 text-center;
      }

      .position-item {
        @apply space-y-1;
      }

      .position-label {
        @apply block text-sm font-bold text-gray-700 dark:text-gray-300;
      }

      .position-value {
        @apply block text-sm text-gray-600 dark:text-gray-400;
      }

      .extruder-info {
        @apply space-y-4;
      }

      .extruder-status {
        @apply flex items-center justify-between;
      }

      .extruder-label {
        @apply text-sm font-medium text-gray-600 dark:text-gray-400;
      }

      .extruder-details {
        @apply space-y-2;
      }

      .detail-item {
        @apply flex justify-between items-center;
      }

      .detail-label {
        @apply text-sm text-gray-600 dark:text-gray-400;
      }

      .detail-value {
        @apply text-sm font-semibold text-gray-900 dark:text-gray-100;
      }

      .timing-grid {
        @apply space-y-3;
      }

      .timing-item {
        @apply flex justify-between items-center;
      }

      .timing-label {
        @apply text-sm font-medium text-gray-600 dark:text-gray-400;
      }

      .timing-value {
        @apply text-sm font-semibold text-gray-900 dark:text-gray-100;
      }

      .camera-controls {
        @apply grid grid-cols-2 gap-3;
      }

      .camera-btn {
        @apply text-sm;
      }

      /* Responsive adjustments */
      @media (max-width: 480px) {
        .primary-grid {
          @apply grid-cols-1 gap-2;
        }

        .control-btn {
          @apply h-10 text-sm;
        }

        .step-buttons {
          @apply grid-cols-2 gap-1;
        }
      }

      @media (orientation: landscape) and (max-height: 500px) {
        .quick-actions {
          @apply flex-row gap-2 bottom-2;
        }

        .secondary-actions {
          @apply flex-row;
        }
      }

      /* Dark mode optimizations */
      @media (prefers-color-scheme: dark) {
        .mobile-header {
          @apply bg-gray-900 border-gray-700;
        }

        .quick-actions .p-button {
          @apply shadow-lg shadow-black/20;
        }
      }

      /* Reduced motion support */
      @media (prefers-reduced-motion: reduce) {
        .primary-action-btn,
        .secondary-action-btn,
        .expand-toggle-btn {
          @apply transition-none;
        }

        .secondary-actions {
          @apply transition-none;
        }

        .animate-pulse {
          @apply animate-none;
        }
      }
    `,
  ],
})
export class PrinterMobileControlsComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
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

  // Local state
  readonly sidebarVisible = signal<boolean>(false);
  readonly expandedActions = signal<boolean>(false);
  readonly activeTabIndex = signal<number>(0);
  readonly isActionLoading = signal<Record<ControlActionType, boolean>>({
    start: false,
    pause: false,
    stop: false,
    reset: false,
    stepBack: false,
    stepForward: false,
    jumpTo: false,
  });

  // Mobile-specific state
  readonly mobileState = signal<MobileControlsState>({
    sidebarVisible: false,
    quickActionsVisible: true,
    isLandscape: false,
    screenSize: 'md',
    reducedMotion: false,
  });

  // Local settings for immediate UI feedback
  readonly localAnimationSpeed = signal<number>(1.0);
  readonly localFilamentColor = signal<string>('#FF4444');
  readonly localMaxPathPoints = signal<number>(25000);

  // Configuration
  readonly speedPresets = [
    { label: '0.1x', value: 0.1 },
    { label: '0.5x', value: 0.5 },
    { label: '1x', value: 1.0 },
    { label: '2x', value: 2.0 },
    { label: '5x', value: 5.0 },
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

  readonly displayToggles = [
    {
      key: 'showTravelMoves' as const,
      label: 'Travel Moves',
      onIcon: 'pi pi-eye',
      offIcon: 'pi pi-eye-slash',
    },
    {
      key: 'showBuildPlate' as const,
      label: 'Build Plate',
      onIcon: 'pi pi-eye',
      offIcon: 'pi pi-eye-slash',
    },
    {
      key: 'antialiasing' as const,
      label: 'Anti-aliasing',
      onIcon: 'pi pi-check-circle',
      offIcon: 'pi pi-times-circle',
    },
  ];

  readonly cameraActions = [
    {
      action: 'reset' as const,
      icon: 'pi pi-home',
      label: 'Reset View',
    },
    {
      action: 'topView' as const,
      icon: 'pi pi-arrow-up',
      label: 'Top View',
    },
    {
      action: 'focus' as const,
      icon: 'pi pi-search-plus',
      label: 'Focus',
    },
    {
      action: 'isometric' as const,
      icon: 'pi pi-th-large',
      label: 'Isometric',
    },
  ];

  // Computed properties
  readonly simulationStateDisplay = computed(() => {
    const state = this.simulationState();
    return state.charAt(0).toUpperCase() + state.slice(1);
  });

  readonly isAnimating = computed(() => {
    return this.simulationState() === SimulationState.RUNNING;
  });

  readonly showQuickActions = computed(() => {
    return (
      this.simulationState() !== SimulationState.IDLE &&
      !this.mobileState().reducedMotion
    );
  });

  readonly hasActiveSettings = computed(() => {
    const settings = this.settings();
    const defaults = DEFAULT_VIEWPORT_SETTINGS;

    return (
      settings.animationSpeed !== defaults.animationSpeed ||
      settings.filamentColor !== defaults.filamentColor ||
      settings.maxPathPoints !== defaults.maxPathPoints ||
      settings.showTravelMoves !== defaults.showTravelMoves ||
      settings.showBuildPlate !== defaults.showBuildPlate
    );
  });

  readonly estimatedCompletion = computed(() => {
    const remaining = this.printerState().estimatedTimeRemaining;
    if (remaining <= 0) return null;

    const now = new Date();
    const eta = new Date(now.getTime() + remaining * 1000);
    return eta.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  });

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

  // Speed dial items
  readonly speedDialItems = computed<MenuItem[]>(() => [
    {
      icon: 'pi pi-play',
      command: () => {
        if (this.canStart()) this.handleAction('start');
      },
      disabled: !this.canStart(),
      tooltip: 'Start',
    },
    {
      icon: 'pi pi-pause',
      command: () => {
        if (this.canPause()) this.handleAction('pause');
      },
      disabled: !this.canPause(),
      tooltip: 'Pause',
    },
    {
      icon: 'pi pi-stop',
      command: () => {
        if (this.canStop()) this.handleAction('stop');
      },
      disabled: !this.canStop(),
      tooltip: 'Stop',
    },
    {
      icon: 'pi pi-refresh',
      command: () => {
        if (this.canReset()) this.handleAction('reset');
      },
      disabled: !this.canReset(),
      tooltip: 'Reset',
    },
  ]);

  constructor() {
    this.setupMobileDetection();
    this.setupSettingsSync();
    this.setupSettingsDebouncing();
  }

  // Event handlers
  toggleSidebar(): void {
    this.sidebarVisible.update((visible) => !visible);
  }

  toggleExpandedActions(): void {
    this.expandedActions.update((expanded) => !expanded);
  }

  setActiveTab(index: number): void {
    this.activeTabIndex.set(index);
  }

  handlePrimaryAction(): void {
    const state = this.simulationState();

    if (state === SimulationState.RUNNING) {
      this.handleAction('pause');
    } else if (state === SimulationState.PAUSED) {
      this.handleAction('pause'); // Resume
    } else if (this.canStart()) {
      this.handleAction('start');
    }
  }

  handleAction(type: ControlActionType, payload?: unknown): void {
    this.controlAction.emit({ type, payload });
  }

  handleActionWithFeedback(type: string, payload?: unknown): void {
    // Set loading state
    this.isActionLoading.update((current) => ({ ...current, [type]: true }));

    // Execute action
    this.handleAction(type, payload);

    // Clear loading state and potentially close sidebar
    setTimeout(() => {
      this.isActionLoading.update((current) => ({ ...current, [type]: false }));

      // Close sidebar for certain actions
      if (['start', 'stop', 'reset'].includes(type)) {
        this.sidebarVisible.set(false);
      }
    }, 1000);
  }

  // Settings handlers
  updateAnimationSpeed(speed: number): void {
    this.localAnimationSpeed.set(speed);
    this.debouncedSettingsUpdate('animationSpeed', speed);
  }

  updateFilamentColor(color: string): void {
    this.localFilamentColor.set(color);
    this.debouncedSettingsUpdate('filamentColor', color);
  }

  updateMaxPathPoints(points: number): void {
    this.localMaxPathPoints.set(points);
    this.debouncedSettingsUpdate('maxPathPoints', points);
  }

  updateToggleSetting(key: keyof ViewportSettings, value: boolean): void {
    this.settingsChange.emit({ setting: key, value });
  }

  setSpeedPreset(speed: number): void {
    this.updateAnimationSpeed(speed);
  }

  setColorPreset(color: string): void {
    this.updateFilamentColor(color);
  }

  // Utility methods
  getPrimaryActionIcon(): string {
    const state = this.simulationState();
    if (state === SimulationState.RUNNING) return 'pi pi-pause';
    if (state === SimulationState.PAUSED) return 'pi pi-play';
    return 'pi pi-play';
  }

  getPrimaryActionSeverity():
    | 'success'
    | 'info'
    | 'warn'
    | 'danger'
    | 'secondary' {
    const state = this.simulationState();
    if (state === SimulationState.RUNNING) return 'warn';
    if (state === SimulationState.PAUSED) return 'info';
    return 'success';
  }

  getPrimaryActionTooltip(): string {
    const state = this.simulationState();
    if (state === SimulationState.RUNNING) return 'Pause simulation';
    if (state === SimulationState.PAUSED) return 'Resume simulation';
    return 'Start simulation';
  }

  isPrimaryActionEnabled(): boolean {
    return this.canStart() || this.canPause();
  }

  isPrimaryActionLoading(): boolean {
    const state = this.simulationState();
    if (state === SimulationState.RUNNING || state === SimulationState.PAUSED) {
      return this.isActionLoading()['pause'];
    }
    return this.isActionLoading()['start'];
  }

  getSecondaryActions(): QuickAction[] {
    const actions: QuickAction[] = [];

    if (this.canStop()) {
      actions.push({
        type: 'stop',
        icon: 'pi pi-stop',
        label: 'Stop',
        severity: 'danger',
        priority: 1,
      });
    }

    if (this.canReset()) {
      actions.push({
        type: 'reset',
        icon: 'pi pi-refresh',
        label: 'Reset',
        severity: 'secondary',
        priority: 2,
      });
    }

    return actions.sort((a, b) => a.priority - b.priority);
  }

  getPrimaryControlButtons() {
    return [
      {
        type: 'start' as const,
        icon: 'pi pi-play',
        label: 'Start',
        severity: 'success' as const,
      },
      {
        type: 'pause' as const,
        icon:
          this.simulationState() === SimulationState.PAUSED
            ? 'pi pi-play'
            : 'pi pi-pause',
        label:
          this.simulationState() === SimulationState.PAUSED
            ? 'Resume'
            : 'Pause',
        severity:
          this.simulationState() === SimulationState.PAUSED ? 'info' : 'warn',
      },
      {
        type: 'stop' as const,
        icon: 'pi pi-stop',
        label: 'Stop',
        severity: 'danger' as const,
      },
      {
        type: 'reset' as const,
        icon: 'pi pi-refresh',
        label: 'Reset',
        severity: 'secondary' as const,
      },
    ];
  }

  isActionEnabled(type: string): boolean {
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
      default:
        return false;
    }
  }

  getStateSeverity(): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    switch (this.simulationState()) {
      case SimulationState.RUNNING:
        return 'success';
      case SimulationState.PAUSED:
        return 'warn';
      case SimulationState.COMPLETED:
        return 'info';
      case SimulationState.ERROR:
        return 'danger';
      default:
        return 'secondary';
    }
  }

  getToggleValue(key: keyof ViewportSettings): boolean {
    return this.settings()[key] as boolean;
  }

  getSidebarStyleClass(): string {
    const state = this.mobileState();
    const classes = ['mobile-sidebar'];

    if (state.isLandscape) {
      classes.push('landscape-sidebar');
    }

    if (state.screenSize === 'xs' || state.screenSize === 'sm') {
      classes.push('w-full');
    } else {
      classes.push('w-96');
    }

    return classes.join(' ');
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

  // Track by functions
  trackByAction = (index: number, action: QuickAction): string => action.type;
  trackByButton = (index: number, button: any): string => button.type;
  trackByToggle = (index: number, toggle: any): string => toggle.key;

  // Private methods
  private setupMobileDetection(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    // Initial detection
    this.updateMobileState();

    // Listen for orientation and resize changes
    const orientationChange$ = fromEvent(window, 'orientationchange');
    const resize$ = fromEvent(window, 'resize');

    merge(orientationChange$, resize$)
      .pipe(debounceTime(100), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.updateMobileState();
      });

    // Listen for reduced motion preference
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.mobileState.update((current) => ({
      ...current,
      reducedMotion: mediaQuery.matches,
    }));

    mediaQuery.addEventListener('change', (e) => {
      this.mobileState.update((current) => ({
        ...current,
        reducedMotion: e.matches,
      }));
    });
  }

  private updateMobileState(): void {
    const isLandscape = window.innerHeight < window.innerWidth;
    const width = window.innerWidth;

    let screenSize: 'xs' | 'sm' | 'md' | 'lg';
    if (width < 480) screenSize = 'xs';
    else if (width < 640) screenSize = 'sm';
    else if (width < 768) screenSize = 'md';
    else screenSize = 'lg';

    this.mobileState.update((current) => ({
      ...current,
      isLandscape,
      screenSize,
    }));
  }

  private setupSettingsSync(): void {
    // Sync local settings with input
    effect(() => {
      const settings = this.settings();
      this.localAnimationSpeed.set(settings.animationSpeed);
      this.localFilamentColor.set(settings.filamentColor);
      this.localMaxPathPoints.set(settings.maxPathPoints);
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

  private debouncedSettingsUpdate(
    setting: keyof ViewportSettings,
    value: unknown
  ): void {
    this.settingsUpdateSubject.next({ setting, value });
  }
}
