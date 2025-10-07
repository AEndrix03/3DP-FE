import { Injectable } from '@angular/core';
import { GCodeCommand } from '../../types/gcode/gcode.types';

@Injectable({
  providedIn: 'root',
})
export class GCodeParserService {
  // Optimized G-code patterns
  private readonly GCODE_PATTERNS = new Map([
    ['command', /^([GM]\d+)/],
    ['x', /X([-+]?\d*\.?\d+)/],
    ['y', /Y([-+]?\d*\.?\d+)/],
    ['z', /Z([-+]?\d*\.?\d+)/],
    ['e', /E([-+]?\d*\.?\d+)/],
    ['f', /F(\d*\.?\d+)/],
    ['i', /I([-+]?\d*\.?\d+)/],
    ['j', /J([-+]?\d*\.?\d+)/],
    ['k', /K([-+]?\d*\.?\d+)/],
    ['r', /R([-+]?\d*\.?\d+)/],
    ['p', /P(\d*\.?\d+)/],
    ['s', /S(\d*\.?\d+)/],
    ['t', /T(\d+)/],
  ]);

  /**
   * Optimized line parsing with caching
   */
  parseLineOptimized(line: string, lineNumber: number): GCodeCommand | null {
    const commandMatch = this.GCODE_PATTERNS.get('command')?.exec(line);
    if (!commandMatch) return null;

    const command: GCodeCommand = {
      command: commandMatch[1],
      lineNumber,
      rawLine: line,
    };

    // Optimized parameter extraction
    for (const [param, pattern] of this.GCODE_PATTERNS.entries()) {
      if (param === 'command') continue;

      const match = pattern.exec(line);
      if (match) {
        (command as any)[param] =
          param === 't' ? parseInt(match[1], 10) : parseFloat(match[1]);
      }
    }

    return command;
  }

  /**
   * Process multiple lines in batch for better performance
   */
  processBatchedLines(lines: string[]): GCodeCommand[] {
    const commands: GCodeCommand[] = [];
    let lineNumber = 0;

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith(';') && !trimmed.startsWith('%')) {
        const command = this.parseLineOptimized(trimmed, lineNumber++);
        if (command) {
          commands.push(command);
        }
      }
    });

    return commands;
  }
}
