import {
  computed,
  DestroyRef,
  inject,
  Injectable,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  BehaviorSubject,
  debounceTime,
  interval,
  Observable,
  Subject,
  throttleTime,
  timer,
} from 'rxjs';
import { distinctUntilChanged, map, shareReplay } from 'rxjs/operators';
import {
  CommandChunk,
  createGCodeCommand,
  createSimulatorError,
  DEFAULT_STREAMING_CONFIG,
  estimateCommandMemoryUsage,
  GCodeCommand,
  PERFORMANCE_THRESHOLDS,
  SimulatorError,
  StreamingConfig,
} from '../models/simulator/simulator.models';

interface StreamingState {
  readonly isLoading: boolean;
  readonly isProcessing: boolean;
  readonly canProcess: boolean;
  readonly bufferHealth: number;
  readonly memoryPressure: number;
  readonly processingSpeed: number;
}

interface CircularBuffer<T> {
  readonly items: T[];
  readonly capacity: number;
  readonly size: number;
  readonly head: number;
  readonly tail: number;
}

@Injectable({
  providedIn: 'root',
})
export class StreamingCommandService {
  private readonly destroyRef = inject(DestroyRef);

  // Configuration with immutable updates
  private readonly _config = signal<StreamingConfig>(DEFAULT_STREAMING_CONFIG);
  readonly config = this._config.asReadonly();

  // Core state management with better typing
  private readonly _commandBuffer = signal<ReadonlyArray<GCodeCommand>>([]);
  private readonly _currentChunk = signal<CommandChunk | null>(null);
  private readonly _totalCommands = signal<number>(0);
  private readonly _loadedCommands = signal<number>(0);
  private readonly _processedCommands = signal<number>(0);

  // Streaming state
  private readonly _streamingState = signal<StreamingState>({
    isLoading: false,
    isProcessing: false,
    canProcess: true,
    bufferHealth: 100,
    memoryPressure: 0,
    processingSpeed: 0,
  });

  // Memory and performance tracking
  private readonly _memoryUsage = signal<number>(0);
  private readonly _adaptiveDelay = signal<number>(10);

  // Flow control
  private readonly _pauseProcessing = signal<boolean>(false);
  private readonly canProcessSubject = new BehaviorSubject<boolean>(true);

  // Event streams with improved error handling
  private readonly commandChunkSubject = new Subject<CommandChunk>();
  private readonly processingCompleteSubject = new Subject<void>();
  private readonly errorSubject = new Subject<SimulatorError>();

  // Performance monitoring
  private performanceHistory: number[] = [];
  private lastProcessedCount = 0;
  private lastPerformanceCheck = Date.now();

  // Public readonly state
  readonly commandBuffer = this._commandBuffer.asReadonly();
  readonly currentChunk = this._currentChunk.asReadonly();
  readonly totalCommands = this._totalCommands.asReadonly();
  readonly loadedCommands = this._loadedCommands.asReadonly();
  readonly processedCommands = this._processedCommands.asReadonly();
  readonly streamingState = this._streamingState.asReadonly();
  readonly memoryUsage = this._memoryUsage.asReadonly();

  // Computed properties with memoization
  readonly loadProgress = computed(() => {
    const total = this.totalCommands();
    return total > 0 ? Math.round((this.loadedCommands() / total) * 100) : 0;
  });

  readonly bufferUtilization = computed(() => {
    const bufferSize = this.commandBuffer().length;
    const maxSize = this.config().maxBufferSize;
    return maxSize > 0 ? Math.round((bufferSize / maxSize) * 100) : 0;
  });

  readonly isHealthy = computed(() => {
    const state = this.streamingState();
    const bufferUtil = this.bufferUtilization();
    const memoryPressure = state.memoryPressure;

    return (
      bufferUtil < 90 &&
      memoryPressure < 0.8 &&
      state.processingSpeed > PERFORMANCE_THRESHOLDS.COMMANDS_PER_SECOND.SLOW
    );
  });

  // Observables with proper cleanup
  readonly commandChunks$ = this.commandChunkSubject.asObservable().pipe(
    throttleTime(16), // ~60fps throttling
    shareReplay(1),
    takeUntilDestroyed(this.destroyRef)
  );

  readonly processingComplete$ = this.processingCompleteSubject
    .asObservable()
    .pipe(takeUntilDestroyed(this.destroyRef));

  readonly errors$ = this.errorSubject
    .asObservable()
    .pipe(takeUntilDestroyed(this.destroyRef));

  constructor() {
    this.initializePerformanceMonitoring();
    this.setupMemoryManagement();
    this.initializeAdaptiveProcessing();
    this.setupErrorRecovery();
  }

  /**
   * Update configuration with validation and optimization
   */
  updateConfig(config: Partial<StreamingConfig>): void {
    try {
      this._config.update((current) =>
        this.validateAndOptimizeConfig({
          ...current,
          ...config,
        })
      );
    } catch (error) {
      this.handleError('system', `Configuration update failed: ${error}`);
    }
  }

  /**
   * Stream commands from G-code text with improved error handling
   */
  async streamCommands(gCodeText: string): Promise<void> {
    const startTime = performance.now();

    try {
      this.updateStreamingState({ isLoading: true });

      if (!gCodeText?.trim()) {
        throw new Error('Empty G-code text provided');
      }

      const lines = await this.preprocessGCodeText(gCodeText);
      this._totalCommands.set(lines.length);

      if (lines.length === 0) {
        this.handleError('parsing', 'No valid G-code lines found');
        return;
      }

      // Choose processing strategy based on content size
      if (lines.length > 50000) {
        await this.streamLargeContent(lines);
      } else {
        await this.processCommandsInChunks(lines);
      }

      const processingTime = performance.now() - startTime;
      console.log(`Streaming completed in ${processingTime.toFixed(2)}ms`);
    } catch (error) {
      this.handleStreamingError(error as Error);
    } finally {
      this.updateStreamingState({ isLoading: false });
    }
  }

  /**
   * Stream from file with optimized memory usage
   */
  async streamFromFile(file: File): Promise<void> {
    try {
      this.updateStreamingState({ isLoading: true });

      // Validate file
      if (!file || file.size === 0) {
        throw new Error('Invalid file provided');
      }

      if (file.size > 100 * 1024 * 1024) {
        // 100MB limit
        throw new Error('File too large. Maximum size is 100MB');
      }

      console.log(
        `Processing file: ${file.name} (${this.formatFileSize(file.size)})`
      );

      const { chunkSize, totalChunks } = this.calculateOptimalFileChunks(
        file.size
      );
      let processedBytes = 0;
      let buffer = '';
      let totalLines = 0;

      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        if (this._pauseProcessing()) {
          await this.waitForResume();
        }

        const start = chunkIndex * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);

        try {
          const text = await this.readFileChunk(chunk);
          buffer += text;

          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line

          if (lines.length > 0) {
            totalLines += lines.length;
            this._totalCommands.set(totalLines);

            await this.processLinesWithBackpressure(lines, processedBytes);
          }

          processedBytes += chunk.size;

          // Update progress
          const progress = Math.round((processedBytes / file.size) * 100);
          if (progress % 10 === 0) {
            // Log every 10%
            console.log(`File processing: ${progress}%`);
          }
        } catch (chunkError) {
          console.warn(`Error processing chunk ${chunkIndex}:`, chunkError);
          // Continue with next chunk
        }
      }

      // Process remaining buffer
      if (buffer.trim()) {
        await this.processLinesWithBackpressure([buffer], processedBytes);
      }
    } catch (error) {
      this.handleStreamingError(error as Error);
    } finally {
      this.updateStreamingState({ isLoading: false });
    }
  }

  /**
   * Get commands with bounds checking
   */
  getCommands(startIndex: number, count: number): ReadonlyArray<GCodeCommand> {
    const buffer = this.commandBuffer();
    const safeStart = Math.max(0, Math.min(startIndex, buffer.length - 1));
    const safeEnd = Math.min(safeStart + count, buffer.length);

    return buffer.slice(safeStart, safeEnd);
  }

  /**
   * Get single command safely
   */
  getCommand(index: number): GCodeCommand | undefined {
    const buffer = this.commandBuffer();
    return index >= 0 && index < buffer.length ? buffer[index] : undefined;
  }

  /**
   * Start processing with improved control flow
   */
  startProcessing(): Observable<GCodeCommand> {
    return new Observable<GCodeCommand>((subscriber) => {
      this.updateStreamingState({ isProcessing: true });

      const commands = this.commandBuffer();
      const config = this.config();
      let currentIndex = this._processedCommands();

      if (commands.length === 0) {
        subscriber.complete();
        return null;
      }

      const processNext = async () => {
        try {
          while (currentIndex < commands.length && !this._pauseProcessing()) {
            const command = commands[currentIndex];

            if (!command) {
              currentIndex++;
              continue;
            }

            subscriber.next(command);
            this._processedCommands.set(currentIndex + 1);
            currentIndex++;

            // Adaptive delay based on performance
            const delay = Math.max(1, 1000 / config.processingRate);
            if (delay > 1) {
              await new Promise((resolve) => setTimeout(resolve, delay));
            }
          }

          subscriber.complete();
          this.updateStreamingState({ isProcessing: false });
          this.processingCompleteSubject.next();
        } catch (error) {
          this.handleError('execution', `Processing failed: ${error}`);
          subscriber.error(error);
        }
      };

      processNext();

      return () => {
        this.updateStreamingState({ isProcessing: false });
      };
    }).pipe(takeUntilDestroyed(this.destroyRef));
  }

  /**
   * Pause processing
   */
  pauseProcessing(): void {
    this._pauseProcessing.set(true);
    this.updateStreamingState({ isProcessing: false });
  }

  /**
   * Resume processing from specific index
   */
  resumeProcessing(fromIndex: number = 0): Observable<GCodeCommand> {
    this._pauseProcessing.set(false);
    this._processedCommands.set(Math.max(0, fromIndex));
    return this.startProcessing();
  }

  /**
   * Reset all state
   */
  reset(): void {
    this._commandBuffer.set([]);
    this._currentChunk.set(null);
    this._totalCommands.set(0);
    this._loadedCommands.set(0);
    this._processedCommands.set(0);
    this._pauseProcessing.set(false);
    this._adaptiveDelay.set(10);
    this._memoryUsage.set(0);

    this.updateStreamingState({
      isLoading: false,
      isProcessing: false,
      canProcess: true,
      bufferHealth: 100,
      memoryPressure: 0,
      processingSpeed: 0,
    });

    this.performanceHistory = [];
    this.canProcessSubject.next(true);
  }

  /**
   * Get current memory usage estimate
   */
  getCurrentMemoryUsage(): number {
    const commands = this.commandBuffer();
    return commands.reduce(
      (total, cmd) => total + estimateCommandMemoryUsage(cmd),
      0
    );
  }

  // Private methods

  private validateAndOptimizeConfig(config: StreamingConfig): StreamingConfig {
    return {
      chunkSize: Math.min(Math.max(100, config.chunkSize), 5000),
      maxBufferSize: Math.min(Math.max(1000, config.maxBufferSize), 50000),
      processingRate: Math.min(Math.max(10, config.processingRate), 1000),
      adaptiveChunking: config.adaptiveChunking,
      memoryThreshold: Math.max(256 * 1024 * 1024, config.memoryThreshold),
      backpressureThreshold: Math.min(
        Math.max(0.5, config.backpressureThreshold),
        0.95
      ),
    };
  }

  private updateStreamingState(updates: Partial<StreamingState>): void {
    this._streamingState.update((current) => ({ ...current, ...updates }));
  }

  private async preprocessGCodeText(gCodeText: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      try {
        // Use setTimeout to prevent blocking
        setTimeout(() => {
          const lines = gCodeText
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(
              (line) =>
                line.length > 0 &&
                !line.startsWith(';') &&
                !line.startsWith('%')
            );

          resolve(lines);
        }, 0);
      } catch (error) {
        reject(error);
      }
    });
  }

  private calculateOptimalFileChunks(fileSize: number): {
    chunkSize: number;
    totalChunks: number;
  } {
    let chunkSize: number;

    if (fileSize < 1024 * 1024) {
      // < 1MB
      chunkSize = 256 * 1024; // 256KB
    } else if (fileSize < 10 * 1024 * 1024) {
      // < 10MB
      chunkSize = 1024 * 1024; // 1MB
    } else {
      chunkSize = 2 * 1024 * 1024; // 2MB
    }

    const totalChunks = Math.ceil(fileSize / chunkSize);
    return { chunkSize, totalChunks };
  }

  private async readFileChunk(chunk: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      const timeout = setTimeout(() => {
        reader.abort();
        reject(new Error('File read timeout'));
      }, 10000); // 10 second timeout

      reader.onload = () => {
        clearTimeout(timeout);
        resolve(reader.result as string);
      };

      reader.onerror = () => {
        clearTimeout(timeout);
        reject(new Error(`Failed to read file chunk: ${reader.error}`));
      };

      reader.onabort = () => {
        clearTimeout(timeout);
        reject(new Error('File read aborted'));
      };

      reader.readAsText(chunk);
    });
  }

  private async processLinesWithBackpressure(
    lines: string[],
    byteOffset: number
  ): Promise<void> {
    const bufferUtil = this.bufferUtilization();
    const config = this.config();

    // Apply backpressure if buffer is getting full
    if (bufferUtil > config.backpressureThreshold * 100) {
      await this.waitForBufferSpace();
    }

    const commands = this.parseCommandLines(lines, this._loadedCommands());

    if (commands.length === 0) return;

    // Check memory usage before adding
    const estimatedMemory = commands.reduce(
      (total, cmd) => total + estimateCommandMemoryUsage(cmd),
      0
    );

    const currentMemory = this.getCurrentMemoryUsage();
    if (currentMemory + estimatedMemory > config.memoryThreshold) {
      await this.performMemoryCleanup();
    }

    // Add commands to buffer
    this._commandBuffer.update((current) => [...current, ...commands]);
    this._loadedCommands.update((count) => count + lines.length);
    this._memoryUsage.set(this.getCurrentMemoryUsage());

    // Create and emit chunk
    const chunk: CommandChunk = {
      commands,
      chunkIndex: Math.floor(byteOffset / 1024), // Approximate chunk index
      totalChunks: -1, // Unknown at this point
      metadata: {
        layerStart: this.extractLayerNumber(commands[0]),
        layerEnd: this.extractLayerNumber(commands[commands.length - 1]),
        estimatedTime: commands.length * 0.1,
        byteOffset,
        byteLength: lines.join('\n').length,
      },
    };

    this._currentChunk.set(chunk);
    this.commandChunkSubject.next(chunk);
  }

  private async waitForBufferSpace(maxWaitTime = 5000): Promise<void> {
    const startTime = Date.now();

    while (
      this.bufferUtilization() > 85 &&
      Date.now() - startTime < maxWaitTime
    ) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    if (this.bufferUtilization() > 85) {
      throw new Error('Buffer overflow: Unable to clear buffer space in time');
    }
  }

  private async performMemoryCleanup(): Promise<void> {
    // Force garbage collection if available
    if ('gc' in window && typeof (window as any).gc === 'function') {
      (window as any).gc();
    }

    // Wait a bit for cleanup
    await new Promise((resolve) => setTimeout(resolve, 100));

    const newMemoryUsage = this.getCurrentMemoryUsage();
    this._memoryUsage.set(newMemoryUsage);

    console.log(
      `Memory cleanup completed. Usage: ${this.formatFileSize(newMemoryUsage)}`
    );
  }

  private parseCommandLines(
    lines: string[],
    startIndex: number
  ): GCodeCommand[] {
    const commands: GCodeCommand[] = [];
    const timestamp = Date.now();

    for (let i = 0; i < lines.length; i++) {
      try {
        const command = this.parseGCodeLine(
          lines[i],
          startIndex + i,
          timestamp
        );
        if (command) {
          commands.push(command);
        }
      } catch (error) {
        console.warn(
          `Failed to parse line ${startIndex + i}: ${lines[i]}`,
          error
        );
      }
    }

    return commands;
  }

  private parseGCodeLine(
    line: string,
    lineNumber: number,
    timestamp: number
  ): GCodeCommand | null {
    const trimmed = line.trim().toUpperCase();
    if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('%')) {
      return null;
    }

    const codePart = trimmed.split(';')[0].trim();
    if (!codePart) return null;

    const parts = codePart.split(/\s+/);
    const command = parts[0];
    const parameters: Record<string, number> = {};

    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      if (part.length > 1) {
        const letter = part[0];
        const valueStr = part.substring(1);
        const value = parseFloat(valueStr);

        if (!isNaN(value)) {
          parameters[letter] = value;
        }
      }
    }

    return createGCodeCommand(command, parameters, line, lineNumber, timestamp);
  }

  private async processCommandsInChunks(lines: string[]): Promise<void> {
    const config = this.config();
    const totalLines = lines.length;
    let processedLines = 0;

    for (let i = 0; i < totalLines; i += config.chunkSize) {
      if (this._pauseProcessing()) {
        await this.waitForResume();
      }

      const chunkLines = lines.slice(i, i + config.chunkSize);
      const commands = this.parseCommandLines(chunkLines, processedLines);

      if (commands.length > 0) {
        await this.addCommandsToBuffer(commands);

        const chunk: CommandChunk = {
          commands,
          chunkIndex: Math.floor(i / config.chunkSize),
          totalChunks: Math.ceil(totalLines / config.chunkSize),
          metadata: {
            layerStart: this.extractLayerNumber(commands[0]),
            layerEnd: this.extractLayerNumber(commands[commands.length - 1]),
            estimatedTime: commands.length * 0.1,
          },
        };

        this._currentChunk.set(chunk);
        this.commandChunkSubject.next(chunk);
      }

      processedLines += chunkLines.length;
      this._loadedCommands.set(processedLines);

      // Adaptive delay
      const delay = this._adaptiveDelay();
      if (delay > 1) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  private async addCommandsToBuffer(commands: GCodeCommand[]): Promise<void> {
    const bufferUtil = this.bufferUtilization();
    const config = this.config();

    if (bufferUtil > config.backpressureThreshold * 100) {
      await this.waitForBufferSpace();
    }

    this._commandBuffer.update((current) => [...current, ...commands]);
    this._memoryUsage.set(this.getCurrentMemoryUsage());
  }

  private async streamLargeContent(lines: string[]): Promise<void> {
    console.log(`Processing large content with ${lines.length} lines`);

    // Use smaller chunks for large content
    const originalChunkSize = this.config().chunkSize;
    this.updateConfig({ chunkSize: Math.min(originalChunkSize, 500) });

    try {
      await this.processCommandsInChunks(lines);
    } finally {
      this.updateConfig({ chunkSize: originalChunkSize });
    }
  }

  private async waitForResume(): Promise<void> {
    while (this._pauseProcessing()) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  private extractLayerNumber(command?: GCodeCommand): number | undefined {
    if (!command) return undefined;

    // Check for layer comment
    const layerMatch = command.rawLine.match(/LAYER[:\s]+(\d+)/i);
    if (layerMatch) {
      return parseInt(layerMatch[1]);
    }

    // Estimate from Z height
    if (command.command === 'G1' && command.parameters.has('Z')) {
      const z = command.parameters.get('Z')!;
      return Math.floor(z / 0.2); // Assuming 0.2mm layer height
    }

    return undefined;
  }

  private initializePerformanceMonitoring(): void {
    // Performance monitoring every second
    timer(1000, 1000)
      .pipe(
        map(() => {
          const currentCount = this.processedCommands();
          const currentTime = Date.now();
          const deltaCommands = currentCount - this.lastProcessedCount;
          const deltaTime = currentTime - this.lastPerformanceCheck;

          const speed = deltaTime > 0 ? (deltaCommands * 1000) / deltaTime : 0;

          this.lastProcessedCount = currentCount;
          this.lastPerformanceCheck = currentTime;

          // Keep performance history
          this.performanceHistory.push(speed);
          if (this.performanceHistory.length > 10) {
            this.performanceHistory.shift();
          }

          return Math.round(speed);
        }),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((speed) => {
        this.updateStreamingState({ processingSpeed: speed });
      });
  }

  private setupMemoryManagement(): void {
    // Monitor memory usage
    interval(2000)
      .pipe(
        map(() => {
          const usage = this.getCurrentMemoryUsage();
          const threshold = this.config().memoryThreshold;
          const pressure = usage / threshold;

          return { usage, pressure };
        }),
        distinctUntilChanged(
          (prev, curr) => Math.abs(prev.pressure - curr.pressure) < 0.05
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(({ usage, pressure }) => {
        this._memoryUsage.set(usage);
        this.updateStreamingState({ memoryPressure: pressure });

        if (pressure > 0.9) {
          this.handleError('memory', 'High memory usage detected');
        }
      });
  }

  private initializeAdaptiveProcessing(): void {
    // Adjust processing based on performance
    interval(1000)
      .pipe(debounceTime(100), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        const bufferUtil = this.bufferUtilization();
        const memoryPressure = this.streamingState().memoryPressure;
        const avgSpeed =
          this.performanceHistory.length > 0
            ? this.performanceHistory.reduce((a, b) => a + b) /
              this.performanceHistory.length
            : 0;

        let newDelay = 1;

        if (bufferUtil > 90 || memoryPressure > 0.9) {
          newDelay = 100; // High pressure
        } else if (bufferUtil > 70 || memoryPressure > 0.7) {
          newDelay = 50; // Medium pressure
        } else if (bufferUtil < 30 && memoryPressure < 0.3) {
          newDelay = 1; // Low pressure
        }

        // Adjust based on processing speed
        if (avgSpeed < PERFORMANCE_THRESHOLDS.COMMANDS_PER_SECOND.SLOW) {
          newDelay = Math.max(newDelay, 20);
        }

        this._adaptiveDelay.set(newDelay);
      });
  }

  private setupErrorRecovery(): void {
    // Monitor for error conditions and attempt recovery
    this.errors$
      .pipe(throttleTime(1000), takeUntilDestroyed(this.destroyRef))
      .subscribe((error) => {
        if (error.recoverable) {
          this.attemptErrorRecovery(error);
        }
      });
  }

  private attemptErrorRecovery(error: SimulatorError): void {
    console.log(`Attempting recovery from error: ${error.type}`);

    switch (error.type) {
      case 'memory':
        this.performMemoryCleanup();
        break;
      case 'parsing':
        // Skip problematic commands and continue
        break;
      case 'performance':
        // Reduce quality settings temporarily
        this.updateConfig({
          chunkSize: Math.floor(this.config().chunkSize * 0.8),
          processingRate: Math.floor(this.config().processingRate * 0.8),
        });
        break;
    }
  }

  private handleError(
    type: SimulatorError['type'],
    message: string,
    recoverable = true
  ): void {
    const error = createSimulatorError(type, message, undefined, recoverable);
    this.errorSubject.next(error);
  }

  private handleStreamingError(error: Error): void {
    console.error('Streaming error:', error);

    const simulatorError = createSimulatorError(
      'system',
      `Streaming failed: ${error.message}`,
      { originalError: error.name }
    );

    this.errorSubject.next(simulatorError);

    // Reset state on critical errors
    if (
      error.message.includes('overflow') ||
      error.message.includes('memory')
    ) {
      this.reset();
    }
  }

  private formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }
}
