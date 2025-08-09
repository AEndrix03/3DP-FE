import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Button } from 'primeng/button';
import { MaterialDto } from '../../../../core/models/material.models';

@Component({
  selector: 'printer-materials-grid',
  standalone: true,
  imports: [CommonModule, Button],
  templateUrl: './materials-grid.component.html',
})
export class MaterialsGridComponent {
  @Input() items: MaterialDto[] = [];

  @Output() viewDetail = new EventEmitter<MaterialDto>();
  @Output() delete = new EventEmitter<string>();

  /**
   * Get CSS classes for material type badge
   */
  protected getMaterialTypeBadgeClass(type: string): string {
    const typeClassMap: { [key: string]: string } = {
      PLA: 'bg-green-100 text-green-800',
      ABS: 'bg-blue-100 text-blue-800',
      PETG: 'bg-purple-100 text-purple-800',
      TPU: 'bg-orange-100 text-orange-800',
      ASA: 'bg-red-100 text-red-800',
      PC: 'bg-gray-100 text-gray-800',
      NYLON: 'bg-indigo-100 text-indigo-800',
      PVA: 'bg-cyan-100 text-cyan-800',
      HIPS: 'bg-yellow-100 text-yellow-800',
      WOOD: 'bg-amber-100 text-amber-800',
      METAL: 'bg-slate-100 text-slate-800',
      CARBON_FIBER: 'bg-stone-100 text-stone-800',
    };

    return typeClassMap[type?.toUpperCase()] || 'bg-gray-100 text-gray-800';
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
   * Get material type icon
   */
  protected getMaterialTypeIcon(type: string): string {
    const iconMap: { [key: string]: string } = {
      PLA: 'pi-leaf',
      ABS: 'pi-cog',
      PETG: 'pi-shield',
      TPU: 'pi-heart',
      ASA: 'pi-sun',
      PC: 'pi-desktop',
      NYLON: 'pi-wrench',
      PVA: 'pi-droplet',
      HIPS: 'pi-box',
      WOOD: 'pi-tree',
      METAL: 'pi-bolt',
      CARBON_FIBER: 'pi-diamond',
    };

    return iconMap[type?.toUpperCase()] || 'pi-circle';
  }

  /**
   * Format cost display
   */
  protected formatCost(cost: string | number): string {
    if (typeof cost === 'string') {
      const numCost = parseFloat(cost);
      return isNaN(numCost) ? cost : numCost.toFixed(2);
    }
    return cost.toFixed(2);
  }

  /**
   * Format temperature display
   */
  protected formatTemperature(temp: number): string {
    return temp ? `${temp}°C` : 'N/A';
  }

  /**
   * Check if material has specific property
   */
  protected hasProperty(property: string): boolean {
    return property === 'true';
  }
}
