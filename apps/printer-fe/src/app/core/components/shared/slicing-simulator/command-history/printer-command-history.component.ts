// src/app/printer-simulator/components/command-history/printer-command-history.component.ts

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { SkeletonModule } from 'primeng/skeleton';
import { InputNumberModule } from 'primeng/inputnumber';
import { DropdownModule } from 'primeng/dropdown';
import { BadgeModule } from 'primeng/badge';
import { PanelModule } from 'primeng/panel';
import { DividerModule } from 'primeng/divider';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';
import {
  CommandExecutionInfo,
  CommandType,
  GCodeCommand,
  getCommandType,
} from '../../../../models/simulator/simulator.models';

interface FilterCriteria {
  searchQuery: string;
  commandType: CommandType | 'all';
  showErrorsOnly: boolean;
  executionTimeThreshold: number;
}

interface SortConfig {
  field: string;
  order: 1 | -1;
}

interface PaginationConfig {
  page: number;
  pageSize: number;
  totalRecords: number;
}

interface CommandStats {
  total: number;
  executed: number;
  movement: number;
  errors: number;
  averageExecutionTime: number;
  slowestCommand: CommandExecutionInfo | null;
}

@Component({
  selector: 'printer-command-history',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DialogModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    TagModule,
    TooltipModule,
    ProgressSpinnerModule,
    SkeletonModule,
    InputNumberModule,
    DropdownModule,
    BadgeModule,
    PanelModule,
    DividerModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [(visible)]="visible"
      header="Command Execution History"
      [modal]="true"
      [responsive]="true"
      [style]="{ width: '95vw', maxWidth: '1400px', height: '90vh' }"
      [maximizable]="true"
      [resizable]="true"
      styleClass="command-history-dialog"
      [closable]="true"
      [dismissableMask]="true"
      [focusOnShow]="true"
    >
      <!-- Header Template -->
      <ng-template pTemplate="header">
        <div class="flex items-center justify-between w-full">
          <div class="flex items-center gap-3">
            <i class="pi pi-chart-line text-xl text-primary"></i>
            <div>
              <h2 class="text-xl font-bold m-0">Command Execution History</h2>
              <p class="text-sm text-muted-color m-0 mt-1">
                Analyze and navigate through executed commands
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <p-button
              icon="pi pi-refresh"
              [label]="refreshing() ? 'Refreshing...' : 'Refresh'"
              (onClick)="refreshHistory()"
              severity="secondary"
              size="small"
              [loading]="refreshing()"
              [text]="true"
              pTooltip="Refresh command history"
            />
            <p-button
              icon="pi pi-download"
              label="Export"
              (onClick)="exportHistory.emit()"
              severity="info"
              size="small"
              [text]="true"
              pTooltip="Export command history as CSV"
            />
            <span class="text-sm text-muted-color font-semibold">
              {{ filteredHistory().length }} /
              {{ commandHistory().length }} commands
            </span>
          </div>
        </div>
      </ng-template>

      <!-- Loading State -->
      <div
        *ngIf="isLoading()"
        class="flex flex-col items-center justify-center py-12"
      >
        <p-progressSpinner strokeWidth="3" animationDuration="1s" />
        <p class="text-lg font-semibold mt-4 mb-2">Loading Command History</p>
        <p class="text-muted-color text-sm">
          Processing {{ commandHistory().length }} commands...
        </p>
      </div>

      <!-- Main Content -->
      <div *ngIf="!isLoading()" class="command-history-content">
        <!-- Statistics Overview -->
        <p-panel
          header="Command Statistics"
          [toggleable]="true"
          styleClass="mb-4"
        >
          <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div class="stat-card bg-blue-50 dark:bg-blue-900/20">
              <div class="stat-number text-blue-600 dark:text-blue-400">
                {{ commandStats().total.toLocaleString() }}
              </div>
              <div class="stat-label">Total Commands</div>
            </div>

            <div class="stat-card bg-green-50 dark:bg-green-900/20">
              <div class="stat-number text-green-600 dark:text-green-400">
                {{ commandStats().executed.toLocaleString() }}
              </div>
              <div class="stat-label">Executed</div>
              <div class="stat-percentage text-green-500">
                {{
                  (
                    (commandStats().executed /
                      Math.max(1, commandStats().total)) *
                    100
                  ).toFixed(1)
                }}%
              </div>
            </div>

            <div class="stat-card bg-purple-50 dark:bg-purple-900/20">
              <div class="stat-number text-purple-600 dark:text-purple-400">
                {{ commandStats().movement.toLocaleString() }}
              </div>
              <div class="stat-label">Movement</div>
              <div class="stat-percentage text-purple-500">
                {{
                  (
                    (commandStats().movement /
                      Math.max(1, commandStats().total)) *
                    100
                  ).toFixed(1)
                }}%
              </div>
            </div>

            <div class="stat-card bg-red-50 dark:bg-red-900/20">
              <div class="stat-number text-red-600 dark:text-red-400">
                {{ commandStats().errors }}
              </div>
              <div class="stat-label">Errors/Warnings</div>
            </div>

            <div class="stat-card bg-yellow-50 dark:bg-yellow-900/20">
              <div class="stat-number text-yellow-600 dark:text-yellow-400">
                {{ commandStats().averageExecutionTime.toFixed(2) }}ms
              </div>
              <div class="stat-label">Avg Execution</div>
            </div>
          </div>
        </p-panel>

        <!-- Filters and Search -->
        <p-panel
          header="Filters & Search"
          [toggleable]="true"
          [collapsed]="false"
          styleClass="mb-4"
        >
          <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
            <!-- Search Query -->
            <div class="flex flex-col">
              <label class="font-semibold text-sm mb-2">Search Commands</label>
              <span class="p-input-icon-left w-full">
                <i class="pi pi-search"></i>
                <input
                  pInputText
                  type="text"
                  [(ngModel)]="searchQuery"
                  placeholder="Search G-code, parameters..."
                  class="w-full"
                  [value]="filterCriteria().searchQuery"
                  (input)="handleSearchInput($event)"
                />
              </span>
            </div>

            <!-- Command Type Filter -->
            <div class="flex flex-col">
              <label class="font-semibold text-sm mb-2">Command Type</label>
              <p-dropdown
                [options]="commandTypeOptions"
                [(ngModel)]="selectedCommandType"
                optionLabel="label"
                optionValue="value"
                placeholder="All Commands"
                class="w-full"
                (onChange)="updateCommandTypeFilter($event.value)"
              />
            </div>

            <!-- Execution Time Filter -->
            <div class="flex flex-col">
              <label class="font-semibold text-sm mb-2"
                >Min Execution Time (ms)</label
              >
              <p-inputNumber
                [(ngModel)]="executionTimeThreshold"
                [min]="0"
                [max]="1000"
                [step]="0.1"
                [showButtons]="true"
                [size]="3"
                class="w-full"
                (onInput)="updateExecutionTimeFilter($event.value || 0)"
              />
            </div>

            <!-- Quick Filters -->
            <div class="flex flex-col">
              <label class="font-semibold text-sm mb-2">Quick Filters</label>
              <div class="flex gap-2">
                <p-button
                  [label]="
                    filterCriteria().showErrorsOnly ? 'Show All' : 'Errors Only'
                  "
                  [icon]="
                    filterCriteria().showErrorsOnly
                      ? 'pi pi-eye'
                      : 'pi pi-exclamation-triangle'
                  "
                  (onClick)="toggleErrorsOnly()"
                  [severity]="
                    filterCriteria().showErrorsOnly ? 'secondary' : 'danger'
                  "
                  size="small"
                  [badge]="commandStats().errors.toString()"
                  [disabled]="commandStats().errors === 0"
                  [text]="true"
                />
                <p-button
                  label="Clear"
                  icon="pi pi-filter-slash"
                  (onClick)="clearAllFilters()"
                  severity="secondary"
                  size="small"
                  [text]="true"
                  [disabled]="!hasActiveFilters()"
                />
              </div>
            </div>
          </div>
        </p-panel>

        <!-- Command Table -->
        <p-panel header="Command List" styleClass="flex-1">
          <p-table
            [value]="paginatedHistory()"
            [paginator]="true"
            [rows]="pagination().pageSize"
            [totalRecords]="filteredHistory().length"
            [showCurrentPageReport]="true"
            currentPageReportTemplate="Showing {first} to {last} of {totalRecords} commands"
            [rowsPerPageOptions]="[10, 25, 50, 100]"
            [scrollable]="true"
            scrollHeight="400px"
            styleClass="command-table"
            [sortField]="sortConfig().field"
            [sortOrder]="sortConfig().order"
            (onSort)="handleSort($event)"
            [loading]="isLoading()"
            (onPage)="handlePageChange($event)"
            dataKey="index"
            [lazy]="false"
          >
            <ng-template pTemplate="header">
              <tr>
                <th pSortableColumn="index" style="width: 80px;">
                  <div class="flex items-center gap-2">
                    #
                    <p-sortIcon field="index" />
                  </div>
                </th>

                <th pSortableColumn="command.command" style="width: 100px;">
                  <div class="flex items-center gap-2">
                    Command
                    <p-sortIcon field="command.command" />
                  </div>
                </th>

                <th pSortableColumn="command.rawLine" style="min-width: 300px;">
                  <div class="flex items-center gap-2">
                    G-Code Line
                    <p-sortIcon field="command.rawLine" />
                  </div>
                </th>

                <th pSortableColumn="executionTime" style="width: 120px;">
                  <div class="flex items-center gap-2">
                    Exec Time
                    <p-sortIcon field="executionTime" />
                  </div>
                </th>

                <th pSortableColumn="cumulativeTime" style="width: 120px;">
                  <div class="flex items-center gap-2">
                    Total Time
                    <p-sortIcon field="cumulativeTime" />
                  </div>
                </th>

                <th style="width: 120px;">Actions</th>
              </tr>
            </ng-template>

            <ng-template pTemplate="body" let-item let-ri="rowIndex">
              <tr
                [class]="getRowClasses(item)"
                (click)="selectCommand(item)"
                [attr.aria-selected]="item.index === currentCommandIndex()"
              >
                <td class="text-center font-mono text-sm">
                  <div class="flex items-center justify-center gap-2">
                    <span>{{ item.index + 1 }}</span>
                    <i
                      *ngIf="item.index === currentCommandIndex()"
                      class="pi pi-arrow-right text-primary animate-pulse"
                      pTooltip="Currently executing"
                      aria-label="Current command"
                    />
                  </div>
                </td>

                <td>
                  <p-tag
                    [value]="item.command.command"
                    [severity]="getCommandSeverity(item.command.command)"
                    [pTooltip]="getCommandTooltip(item.command)"
                    tooltipPosition="top"
                    class="cursor-pointer hover:scale-105 transition-transform"
                    (click)="jumpToCommand(item.index, $event)"
                    [attr.aria-label]="
                      'Jump to command ' + item.command.command
                    "
                  />
                </td>

                <td>
                  <div class="command-line-container">
                    <div
                      class="command-line font-mono text-sm"
                      [title]="item.command.rawLine"
                    >
                      {{ item.command.rawLine }}
                    </div>
                    <div
                      *ngIf="getCommandParameters(item.command).length > 0"
                      class="command-params text-xs text-muted-color mt-1"
                    >
                      <span
                        *ngFor="
                          let param of getCommandParameters(item.command);
                          trackBy: trackByParameter
                        "
                        class="param-tag"
                      >
                        {{ param }}
                      </span>
                    </div>
                  </div>
                </td>

                <td class="text-center font-mono text-sm">
                  <span [class]="getExecutionTimeClass(item.executionTime)">
                    {{ formatExecutionTime(item.executionTime) }}
                  </span>
                </td>

                <td class="text-center font-mono text-sm">
                  <span class="text-muted-color">
                    {{ formatTime(item.cumulativeTime) }}
                  </span>
                </td>

                <td>
                  <div class="flex items-center justify-center gap-1">
                    <p-button
                      icon="pi pi-play"
                      (onClick)="jumpToCommand(item.index, $event)"
                      severity="info"
                      size="small"
                      [text]="true"
                      [rounded]="true"
                      pTooltip="Jump to this command"
                      ariaLabel="Jump to command"
                    />
                    <p-button
                      icon="pi pi-info-circle"
                      (onClick)="showCommandDetails(item, $event)"
                      severity="secondary"
                      size="small"
                      [text]="true"
                      [rounded]="true"
                      pTooltip="Show command details"
                      ariaLabel="Show command details"
                    />
                  </div>
                </td>
              </tr>
            </ng-template>

            <ng-template pTemplate="emptymessage">
              <tr>
                <td colspan="6" class="text-center py-12">
                  <div class="empty-state">
                    <i
                      class="pi pi-info-circle text-4xl text-muted-color mb-4"
                    ></i>
                    <h3 class="text-lg font-medium mb-2">
                      {{ getEmptyStateMessage() }}
                    </h3>
                    <p class="text-muted-color mb-4">
                      {{ getEmptyStateSubMessage() }}
                    </p>
                    <p-button
                      *ngIf="hasActiveFilters()"
                      label="Clear Filters"
                      icon="pi pi-filter-slash"
                      (onClick)="clearAllFilters()"
                      severity="secondary"
                      size="small"
                    />
                  </div>
                </td>
              </tr>
            </ng-template>

            <ng-template pTemplate="loadingbody">
              <tr>
                <td colspan="6">
                  <div class="flex items-center justify-center py-8">
                    <p-progressSpinner strokeWidth="3" />
                    <span class="ml-3">Loading command history...</span>
                  </div>
                </td>
              </tr>
            </ng-template>
          </p-table>
        </p-panel>
      </div>

      <!-- Footer -->
      <ng-template pTemplate="footer">
        <div class="flex items-center justify-between">
          <div class="text-sm text-muted-color">
            <div>Last updated: {{ lastUpdateTime().toLocaleString() }}</div>
            <div *ngIf="commandStats().slowestCommand as slowest">
              Slowest command: {{ slowest.command.command }} ({{
                formatExecutionTime(slowest.executionTime)
              }})
            </div>
          </div>
          <div class="flex gap-2">
            <p-button
              label="Close"
              icon="pi pi-times"
              (onClick)="visible.set(false)"
              severity="secondary"
              size="small"
            />
          </div>
        </div>
      </ng-template>
    </p-dialog>

    <!-- Command Details Dialog -->
    <p-dialog
      [(visible)]="showDetailsDialog"
      header="Command Details"
      [modal]="true"
      [style]="{ width: '700px', maxWidth: '95vw' }"
      styleClass="command-details-dialog"
      [closable]="true"
      [focusOnShow]="true"
    >
      <div *ngIf="selectedCommand()" class="command-details-content">
        <!-- Command Overview -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label class="detail-label">Command</label>
            <p-tag
              [value]="selectedCommand()!.command.command"
              [severity]="
                getCommandSeverity(selectedCommand()!.command.command)
              "
              class="text-lg"
            />
          </div>
          <div>
            <label class="detail-label">Line Number</label>
            <span class="detail-value font-mono">{{
              selectedCommand()!.command.lineNumber
            }}</span>
          </div>
          <div>
            <label class="detail-label">Command Type</label>
            <span class="detail-value capitalize">{{
              getCommandType(selectedCommand()!.command)
            }}</span>
          </div>
          <div>
            <label class="detail-label">Success</label>
            <p-tag
              [value]="selectedCommand()!.success ? 'Success' : 'Failed'"
              [severity]="selectedCommand()!.success ? 'success' : 'danger'"
            />
          </div>
        </div>

        <!-- Raw G-Code -->
        <div class="mb-6">
          <label class="detail-label">Raw G-Code</label>
          <div class="code-block">
            {{ selectedCommand()!.command.rawLine }}
          </div>
        </div>

        <!-- Parameters -->
        <div
          *ngIf="
            getCommandParameterDetails(selectedCommand()!.command).length > 0
          "
          class="mb-6"
        >
          <label class="detail-label">Parameters</label>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div
              *ngFor="
                let param of getCommandParameterDetails(
                  selectedCommand()!.command
                );
                trackBy: trackByParameterDetail
              "
              class="parameter-item"
            >
              <span class="parameter-name">{{ param.name }}</span>
              <span class="parameter-value font-mono">{{ param.value }}</span>
            </div>
          </div>
        </div>

        <!-- Execution Information -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label class="detail-label">Execution Time</label>
            <span
              class="detail-value font-mono text-lg"
              [class]="getExecutionTimeClass(selectedCommand()!.executionTime)"
            >
              {{ formatExecutionTime(selectedCommand()!.executionTime) }}
            </span>
          </div>
          <div>
            <label class="detail-label">Cumulative Time</label>
            <span class="detail-value font-mono text-lg">
              {{ formatTime(selectedCommand()!.cumulativeTime) }}
            </span>
          </div>
        </div>

        <!-- Timestamp -->
        <div class="mb-6">
          <label class="detail-label">Execution Timestamp</label>
          <span class="detail-value">{{
            selectedCommand()!.timestamp.toLocaleString()
          }}</span>
        </div>

        <!-- Error Information -->
        <div *ngIf="selectedCommand()!.error" class="mb-6">
          <label class="detail-label text-red-600">Error Details</label>
          <div class="error-block">
            {{ selectedCommand()!.error }}
          </div>
        </div>
      </div>

      <ng-template pTemplate="footer">
        <div class="flex gap-2">
          <p-button
            label="Jump to Command"
            icon="pi pi-play"
            (onClick)="jumpToSelectedCommand()"
            severity="info"
            size="small"
          />
          <p-button
            label="Copy Details"
            icon="pi pi-copy"
            (onClick)="copyCommandDetails()"
            severity="secondary"
            size="small"
            [text]="true"
          />
          <p-button
            label="Close"
            icon="pi pi-times"
            (onClick)="showDetailsDialog.set(false)"
            severity="secondary"
            size="small"
          />
        </div>
      </ng-template>
    </p-dialog>
  `,
  styles: [
    `
      .command-history-dialog ::ng-deep .p-dialog-header {
        @apply bg-gradient-to-r from-blue-500 to-blue-600 text-white;
      }

      .command-history-content {
        @apply space-y-4;
        min-height: 60vh;
      }

      .stat-card {
        @apply p-4 rounded-lg border border-gray-200 dark:border-gray-700;
      }

      .stat-number {
        @apply text-2xl font-bold;
      }

      .stat-label {
        @apply text-sm text-gray-600 dark:text-gray-400 mt-1;
      }

      .stat-percentage {
        @apply text-xs font-medium mt-1;
      }

      .command-table ::ng-deep .p-datatable-thead > tr > th {
        @apply bg-gray-50 dark:bg-gray-800 border-b-2 border-gray-200 dark:border-gray-600;
      }

      .command-table ::ng-deep .p-datatable-tbody > tr:hover {
        @apply bg-blue-50 dark:bg-blue-900/20;
      }

      .command-table ::ng-deep .p-datatable-tbody > tr.current-command {
        @apply bg-blue-100 dark:bg-blue-900/40 border-l-4 border-blue-500;
      }

      .command-table ::ng-deep .p-datatable-tbody > tr.error-command {
        @apply bg-red-50 dark:bg-red-900/20;
      }

      .command-line-container {
        @apply max-w-md;
      }

      .command-line {
        @apply truncate;
        max-width: 400px;
      }

      .command-params {
        @apply space-x-2;
      }

      .param-tag {
        @apply inline-block bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs;
      }

      .empty-state {
        @apply flex flex-col items-center;
      }

      .detail-label {
        @apply block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2;
      }

      .detail-value {
        @apply text-lg;
      }

      .code-block {
        @apply bg-gray-100 dark:bg-gray-800 p-4 rounded-lg font-mono text-sm border;
      }

      .parameter-item {
        @apply flex justify-between items-center bg-gray-50 dark:bg-gray-800 p-3 rounded-lg;
      }

      .parameter-name {
        @apply font-semibold text-gray-700 dark:text-gray-300;
      }

      .parameter-value {
        @apply text-gray-900 dark:text-gray-100;
      }

      .error-block {
        @apply bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-lg text-red-800 dark:text-red-200;
      }
    `,
  ],
})
export class PrinterCommandHistoryComponent {
  private readonly destroyRef = inject(DestroyRef);
  private searchSubject = new Subject<string>();

  // Inputs/Outputs
  readonly visible = model<boolean>(false);
  readonly commandHistory = input.required<CommandExecutionInfo[]>();
  readonly currentCommandIndex = input<number>(0);
  readonly isLoading = input<boolean>(false);

  readonly commandSelect = output<number>();
  readonly exportHistory = output<void>();
  readonly filterChange = output<string>();

  // Local state
  readonly searchQuery = signal<string>('');
  readonly selectedCommandType = signal<CommandType | 'all'>('all');
  readonly executionTimeThreshold = signal<number>(0);
  readonly refreshing = signal<boolean>(false);
  readonly selectedCommand = signal<CommandExecutionInfo | null>(null);
  readonly showDetailsDialog = signal<boolean>(false);
  readonly lastUpdateTime = signal<Date>(new Date());

  // Filter and pagination state
  readonly filterCriteria = signal<FilterCriteria>({
    searchQuery: '',
    commandType: 'all',
    showErrorsOnly: false,
    executionTimeThreshold: 0,
  });

  readonly sortConfig = signal<SortConfig>({
    field: 'index',
    order: 1,
  });

  readonly pagination = signal<PaginationConfig>({
    page: 0,
    pageSize: 25,
    totalRecords: 0,
  });

  // Command type options for dropdown
  readonly commandTypeOptions = [
    { label: 'All Commands', value: 'all' },
    { label: 'Movement', value: 'movement' },
    { label: 'Extrusion', value: 'extrusion' },
    { label: 'Temperature', value: 'temperature' },
    { label: 'Fan', value: 'fan' },
    { label: 'Positioning', value: 'positioning' },
    { label: 'Other', value: 'other' },
  ];

  // Computed properties with optimized filtering
  readonly filteredHistory = computed(() => {
    const history = this.commandHistory();
    const criteria = this.filterCriteria();

    return history.filter((item) => {
      // Search filter
      if (criteria.searchQuery) {
        const query = criteria.searchQuery.toLowerCase();
        const matchesCommand = item.command.command
          .toLowerCase()
          .includes(query);
        const matchesRawLine = item.command.rawLine
          .toLowerCase()
          .includes(query);
        const matchesParams = this.getCommandParameters(item.command).some(
          (param) => param.toLowerCase().includes(query)
        );

        if (!matchesCommand && !matchesRawLine && !matchesParams) {
          return false;
        }
      }

      // Command type filter
      if (criteria.commandType !== 'all') {
        const commandType = getCommandType(item.command);
        if (commandType !== criteria.commandType) {
          return false;
        }
      }

      // Execution time filter
      if (criteria.executionTimeThreshold > 0) {
        if (item.executionTime < criteria.executionTimeThreshold) {
          return false;
        }
      }

      // Errors only filter
      if (criteria.showErrorsOnly) {
        if (item.success && item.executionTime < 1.0) {
          return false;
        }
      }

      return true;
    });
  });

  readonly paginatedHistory = computed(() => {
    const filtered = this.filteredHistory();
    const config = this.sortConfig();

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      let aVal: any = a;
      let bVal: any = b;

      const fieldPath = config.field.split('.');
      for (const prop of fieldPath) {
        aVal = aVal?.[prop];
        bVal = bVal?.[prop];
      }

      if (aVal < bVal) return -1 * config.order;
      if (aVal > bVal) return 1 * config.order;
      return 0;
    });

    // Apply pagination
    const pag = this.pagination();
    const start = pag.page * pag.pageSize;
    const end = start + pag.pageSize;

    return sorted.slice(start, end);
  });

  readonly commandStats = computed((): CommandStats => {
    const history = this.commandHistory();

    if (history.length === 0) {
      return {
        total: 0,
        executed: 0,
        movement: 0,
        errors: 0,
        averageExecutionTime: 0,
        slowestCommand: null,
      };
    }

    const executed = history.filter((item) => item.executionTime > 0);
    const movement = history.filter((item) => {
      const cmd = item.command.command;
      return (
        cmd.startsWith('G0') ||
        cmd.startsWith('G1') ||
        cmd.startsWith('G2') ||
        cmd.startsWith('G3')
      );
    });
    const errors = history.filter(
      (item) => !item.success || item.executionTime > 10
    );

    const totalExecutionTime = executed.reduce(
      (sum, item) => sum + item.executionTime,
      0
    );
    const averageExecutionTime =
      executed.length > 0 ? totalExecutionTime / executed.length : 0;

    const slowestCommand = executed.reduce(
      (slowest, current) =>
        current.executionTime > (slowest?.executionTime || 0)
          ? current
          : slowest,
      null as CommandExecutionInfo | null
    );

    return {
      total: history.length,
      executed: executed.length,
      movement: movement.length,
      errors: errors.length,
      averageExecutionTime,
      slowestCommand,
    };
  });

  readonly hasActiveFilters = computed(() => {
    const criteria = this.filterCriteria();
    return (
      criteria.searchQuery.length > 0 ||
      criteria.commandType !== 'all' ||
      criteria.showErrorsOnly ||
      criteria.executionTimeThreshold > 0
    );
  });

  constructor() {
    this.setupSearchDebouncing();
    this.setupEffects();
  }

  // Event handlers
  handleSearchInput(event: Event): void {
    const query = (event.target as HTMLInputElement).value;
    this.searchSubject.next(query);
  }

  handleSort(event: any): void {
    this.sortConfig.set({
      field: event.field,
      order: event.order,
    });
  }

  handlePageChange(event: any): void {
    this.pagination.update((current) => ({
      ...current,
      page: event.first / event.rows,
      pageSize: event.rows,
    }));
  }

  updateCommandTypeFilter(type: CommandType | 'all'): void {
    this.filterCriteria.update((current) => ({
      ...current,
      commandType: type,
    }));
    this.resetPagination();
  }

  updateExecutionTimeFilter(threshold: number): void {
    this.filterCriteria.update((current) => ({
      ...current,
      executionTimeThreshold: threshold,
    }));
    this.resetPagination();
  }

  toggleErrorsOnly(): void {
    this.filterCriteria.update((current) => ({
      ...current,
      showErrorsOnly: !current.showErrorsOnly,
    }));
    this.resetPagination();
  }

  clearAllFilters(): void {
    this.searchQuery.set('');
    this.selectedCommandType.set('all');
    this.executionTimeThreshold.set(0);

    this.filterCriteria.set({
      searchQuery: '',
      commandType: 'all',
      showErrorsOnly: false,
      executionTimeThreshold: 0,
    });

    this.resetPagination();
    this.filterChange.emit('');
  }

  selectCommand(command: CommandExecutionInfo): void {
    this.selectedCommand.set(command);
  }

  jumpToCommand(index: number, event?: Event): void {
    event?.stopPropagation();
    this.commandSelect.emit(index);
  }

  showCommandDetails(command: CommandExecutionInfo, event?: Event): void {
    event?.stopPropagation();
    this.selectedCommand.set(command);
    this.showDetailsDialog.set(true);
  }

  jumpToSelectedCommand(): void {
    const selected = this.selectedCommand();
    if (selected) {
      this.jumpToCommand(selected.index);
      this.showDetailsDialog.set(false);
    }
  }

  copyCommandDetails(): void {
    const selected = this.selectedCommand();
    if (selected && navigator.clipboard) {
      const details = {
        command: selected.command.command,
        rawLine: selected.command.rawLine,
        lineNumber: selected.command.lineNumber,
        executionTime: selected.executionTime,
        timestamp: selected.timestamp.toISOString(),
        success: selected.success,
        error: selected.error,
      };

      navigator.clipboard
        .writeText(JSON.stringify(details, null, 2))
        .then(() => console.log('Command details copied to clipboard'))
        .catch((err) => console.error('Failed to copy details:', err));
    }
  }

  refreshHistory(): void {
    this.refreshing.set(true);

    // Simulate refresh delay
    setTimeout(() => {
      this.lastUpdateTime.set(new Date());
      this.refreshing.set(false);
    }, 1000);
  }

  // Utility methods
  getRowClasses(item: CommandExecutionInfo): string {
    const classes = [
      'cursor-pointer',
      'hover:bg-gray-50',
      'dark:hover:bg-gray-800',
    ];

    if (item.index === this.currentCommandIndex()) {
      classes.push('current-command', 'bg-blue-100', 'dark:bg-blue-900/40');
    }

    if (!item.success) {
      classes.push('error-command');
    }

    return classes.join(' ');
  }

  getCommandSeverity(
    command: string
  ): 'success' | 'info' | 'warning' | 'danger' | 'secondary' {
    if (command.startsWith('G0') || command.startsWith('G1')) return 'success';
    if (command.startsWith('G2') || command.startsWith('G3')) return 'info';
    if (command.startsWith('G5') || command.startsWith('G6')) return 'warning';
    if (command.startsWith('M')) return 'secondary';
    return 'secondary';
  }

  getCommandTooltip(command: GCodeCommand): string {
    const type = getCommandType(command);
    return `${type.charAt(0).toUpperCase()}${type.slice(
      1
    )} command - Click to jump`;
  }

  getCommandParameters(command: GCodeCommand): string[] {
    return Array.from(command.parameters.entries()).map(
      ([key, value]) => `${key}${value}`
    );
  }

  getCommandParameterDetails(
    command: GCodeCommand
  ): { name: string; value: string }[] {
    return Array.from(command.parameters.entries()).map(([key, value]) => ({
      name: this.getParameterName(key),
      value: value.toString(),
    }));
  }

  getExecutionTimeClass(time: number): string {
    if (time > 10) return 'text-red-600 font-bold';
    if (time > 1) return 'text-yellow-600 font-semibold';
    return 'text-green-600';
  }

  formatExecutionTime(time: number): string {
    if (time < 0.001) return '< 1μs';
    if (time < 1) return `${time.toFixed(2)}ms`;
    return `${time.toFixed(3)}s`;
  }

  formatTime(seconds: number): string {
    if (seconds < 60) {
      return `${seconds.toFixed(1)}s`;
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

  getEmptyStateMessage(): string {
    if (this.hasActiveFilters()) {
      return 'No commands match your search';
    }
    return 'No commands executed yet';
  }

  getEmptyStateSubMessage(): string {
    if (this.hasActiveFilters()) {
      return 'Try adjusting your filters or clearing them to see more results';
    }
    return 'Start the simulation to begin tracking command execution';
  }

  // Track by functions for performance
  trackByParameter = (index: number, param: string): string => param;

  trackByParameterDetail = (
    index: number,
    param: { name: string; value: string }
  ): string => `${param.name}-${param.value}`;

  private getParameterName(key: string): string {
    const paramNames: Record<string, string> = {
      X: 'X Position',
      Y: 'Y Position',
      Z: 'Z Position',
      E: 'Extruder',
      F: 'Feed Rate',
      S: 'Speed/Temperature',
      T: 'Tool Number',
      P: 'Parameter/Dwell',
      I: 'Arc Center X',
      J: 'Arc Center Y',
      K: 'Arc Center Z',
      R: 'Radius',
    };
    return paramNames[key] || key;
  }

  private setupSearchDebouncing(): void {
    this.searchSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((query) => {
        this.searchQuery.set(query);
        this.filterCriteria.update((current) => ({
          ...current,
          searchQuery: query,
        }));
        this.resetPagination();
        this.filterChange.emit(query);
      });
  }

  private setupEffects(): void {
    // Update pagination total when filtered results change
    effect(() => {
      const filteredLength = this.filteredHistory().length;
      this.pagination.update((current) => ({
        ...current,
        totalRecords: filteredLength,
      }));
    });
  }

  private resetPagination(): void {
    this.pagination.update((current) => ({
      ...current,
      page: 0,
    }));
  }

  protected readonly getCommandType = getCommandType;
  protected readonly Math = Math;
}
