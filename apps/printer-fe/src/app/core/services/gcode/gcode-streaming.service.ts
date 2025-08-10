import { Injectable, signal } from '@angular/core';
import { GCodeCommand, StreamingBuffer } from '../../types/gcode/gcode.types';
import { GCodeParserService } from './gcode-parser.service';

@Injectable({
  providedIn: 'root',
})
export class GCodeStreamingService {
  // File streaming
  private fileReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private textDecoder = new TextDecoder();
  private lineBuffer = '';
  private totalFileSize = 0;
  private loadedBytes = 0;

  // Streaming optimizations
  private streamingBuffer: StreamingBuffer = {
    commands: [],
    maxSize: 1000,
    currentIndex: 0,
    processedLines: 0,
  };

  // Signals
  private readonly _loadingProgress = signal<number>(0);

  readonly loadingProgress = this._loadingProgress.asReadonly();

  constructor(private parserService: GCodeParserService) {}

  /**
   * Enhanced streaming G-code blob loader with better completion detection
   */
  async loadGCodeBlob(blob: Blob): Promise<GCodeCommand[]> {
    this._loadingProgress.set(0);
    this.totalFileSize = blob.size;
    this.loadedBytes = 0;
    this.streamingBuffer.processedLines = 0;

    const commands: GCodeCommand[] = [];

    try {
      const stream = blob.stream();
      this.fileReader = stream.getReader();

      await this.processStreamingBlob(commands);

      this._loadingProgress.set(100);

      const totalCommands = commands.length;
      const processedLines = this.streamingBuffer.processedLines;

      console.log(`🎉 Streaming completed successfully:`);
      console.log(`- Total lines processed: ${processedLines}`);
      console.log(`- Commands in buffer: ${totalCommands}`);
      console.log(`- File size: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);

      return commands;
    } catch (error) {
      console.error('G-code loading failed:', error);
      throw error;
    }
  }

  /**
   * Process streaming blob in optimized chunks
   */
  private async processStreamingBlob(commands: GCodeCommand[]): Promise<void> {
    const CHUNK_SIZE = 64 * 1024; // 64KB chunks for optimal performance
    let buffer = '';

    while (true) {
      const { done, value } = await this.fileReader!.read();

      if (done) break;

      this.loadedBytes += value.length;
      const chunk = this.textDecoder.decode(value, { stream: true });
      buffer += chunk;

      // Process complete lines
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      // Batch process lines for better performance
      const batchedCommands = this.processBatchedLines(lines);

      if (batchedCommands.length > 0) {
        commands.push(...batchedCommands);
      }

      // Update progress
      const progress = (this.loadedBytes / this.totalFileSize) * 100;
      this._loadingProgress.set(Math.min(progress, 100));

      // Allow UI updates
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    // Process remaining buffer
    if (buffer.trim()) {
      const finalCommands = this.processBatchedLines([buffer]);
      if (finalCommands.length > 0) {
        commands.push(...finalCommands);
      }
    }
  }

  /**
   * Process multiple lines in batch for better performance
   * Made public so it can be used by other services
   */
  processBatchedLines(lines: string[]): GCodeCommand[] {
    const commands: GCodeCommand[] = [];

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith(';') && !trimmed.startsWith('%')) {
        const command = this.parserService.parseLineOptimized(
          trimmed,
          this.streamingBuffer.processedLines++
        );
        if (command) {
          commands.push(command);
        }
      }
    });

    return commands;
  }

  /**
   * Load G-code file with streaming (fallback method)
   */
  async loadGCodeFile(file: File): Promise<GCodeCommand[]> {
    return this.loadGCodeBlob(file);
  }

  /**
   * Set buffer size for streaming
   */
  setBufferSize(size: number): void {
    this.streamingBuffer.maxSize = Math.max(100, Math.min(10000, size));
  }

  /**
   * Get streaming buffer info
   */
  getStreamingBuffer(): StreamingBuffer {
    return this.streamingBuffer;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    if (this.fileReader) {
      this.fileReader.cancel().catch(() => {}); // Ignora errori di cancellazione
      this.fileReader = null;
    }
    this.lineBuffer = '';
    this.totalFileSize = 0;
    this.loadedBytes = 0;
  }
}
