import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Button } from 'primeng/button';
import { PrinterDto } from '../../../../core/models/printer.models';
import { UriCostants } from '../../../../core/costants/uri-costants';

@Component({
  selector: 'printer-printers-grid',
  standalone: true,
  imports: [CommonModule, Button],
  templateUrl: './printers-grid.component.html',
})
export class PrintersGridComponent {
  @Input() items: PrinterDto[] = [];

  @Output() viewDetail = new EventEmitter<string>();
  @Output() delete = new EventEmitter<string>();

  /**
   * Get image URL from image ID
   */
  protected getImageUrl(imageId: string): string {
    return `${UriCostants.filesUrl}/download?id=${imageId}`;
  }

  /**
   * Check if printer has an image
   */
  protected hasImage(item: PrinterDto): boolean {
    return !!item.image;
  }

  /**
   * Get CSS classes for printer status badge
   */
  protected getPrinterStatusBadgeClass(statusCode: string): string {
    const statusClassMap: { [key: string]: string } = {
      ONLINE: 'bg-green-500 text-white',
      OFFLINE: 'bg-gray-500 text-white',
      PRINTING: 'bg-blue-500 text-white',
      PAUSED: 'bg-yellow-500 text-white',
      ERROR: 'bg-red-500 text-white',
      MAINTENANCE: 'bg-orange-500 text-white',
      IDLE: 'bg-cyan-500 text-white',
      CONNECTED: 'bg-green-500 text-white',
      DISCONNECTED: 'bg-gray-500 text-white',
    };

    return (
      statusClassMap[statusCode?.toUpperCase()] || 'bg-gray-500 text-white'
    );
  }

  /**
   * Get CSS classes for printer status text
   */
  protected getPrinterStatusTextClass(statusCode: string): string {
    const statusTextClassMap: { [key: string]: string } = {
      ONLINE: 'text-green-600',
      OFFLINE: 'text-gray-600',
      PRINTING: 'text-blue-600',
      PAUSED: 'text-yellow-600',
      ERROR: 'text-red-600',
      MAINTENANCE: 'text-orange-600',
      IDLE: 'text-cyan-600',
      CONNECTED: 'text-green-600',
      DISCONNECTED: 'text-gray-600',
    };

    return statusTextClassMap[statusCode?.toUpperCase()] || 'text-gray-600';
  }

  /**
   * Get printer status icon
   */
  protected getPrinterStatusIcon(statusCode: string): string {
    const statusIconMap: { [key: string]: string } = {
      ONLINE: 'pi pi-circle-fill',
      OFFLINE: 'pi pi-circle',
      PRINTING: 'pi pi-play-circle',
      PAUSED: 'pi pi-pause-circle',
      ERROR: 'pi pi-exclamation-circle',
      MAINTENANCE: 'pi pi-wrench',
      IDLE: 'pi pi-clock',
      CONNECTED: 'pi pi-circle-fill',
      DISCONNECTED: 'pi pi-circle',
    };

    return statusIconMap[statusCode?.toUpperCase()] || 'pi pi-circle';
  }

  /**
   * Format last seen date for display
   */
  protected formatLastSeen(lastSeen: Date): string {
    if (!lastSeen) return 'Never';

    const date = new Date(lastSeen);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) {
      return 'Just now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      });
    }
  }

  /**
   * Handle image loading errors
   */
  protected onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img) {
      img.style.display = 'none';
    }
  }

  /**
   * Check if printer is currently online/connected
   */
  protected isOnline(statusCode?: string): boolean {
    const onlineStatuses = [
      'ONLINE',
      'CONNECTED',
      'PRINTING',
      'PAUSED',
      'IDLE',
    ];
    return onlineStatuses.includes(statusCode?.toUpperCase() || '');
  }

  /**
   * Check if printer needs attention (error or maintenance)
   */
  protected needsAttention(statusCode?: string): boolean {
    const attentionStatuses = ['ERROR', 'MAINTENANCE'];
    return attentionStatuses.includes(statusCode?.toUpperCase() || '');
  }

  /**
   * Get driver display name (simplified)
   */
  protected getDriverDisplayName(driverId: string): string {
    if (!driverId) return 'Unknown Driver';

    // Simple formatting - you can expand this based on your driver naming convention
    return driverId
      .replace(/[_-]/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());
  }
}
