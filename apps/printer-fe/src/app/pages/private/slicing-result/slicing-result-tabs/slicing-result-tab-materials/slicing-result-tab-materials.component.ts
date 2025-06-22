import { Component, input, InputSignal } from '@angular/core';
import { CommonModule, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataViewModule } from 'primeng/dataview';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { ImageModule } from 'primeng/image';
import { DividerModule } from 'primeng/divider';
import { MaterialDto } from '../../../../../core/models/material.models';

@Component({
  selector: 'printer-slicing-result-tab-materials',
  imports: [
    CommonModule,
    FormsModule,
    DataViewModule,
    CardModule,
    TagModule,
    ImageModule,
    DividerModule,
    NgIf,
  ],
  templateUrl: './slicing-result-tab-materials.component.html',
})
export class SlicingResultTabMaterialsComponent {
  public readonly materials: InputSignal<MaterialDto[]> = input.required();

  /**
   * Determina il colore del tag basato sul tipo di materiale
   */
  getTypeTagSeverity(
    type: string
  ): 'success' | 'info' | 'warning' | 'danger' | 'secondary' | undefined {
    const typeMap: Record<
      string,
      'success' | 'info' | 'warning' | 'danger' | 'secondary'
    > = {
      PLA: 'success',
      ABS: 'info',
      PETG: 'warning',
      TPU: 'danger',
      ASA: 'secondary',
    };
    return typeMap[type.toUpperCase()] || 'secondary';
  }

  /**
   * Formatta la temperatura per la visualizzazione
   */
  formatTemperatureRange(min: number, max: number): string {
    return `${min}°C - ${max}°C`;
  }

  /**
   * Determina se il materiale richiede riscaldamento speciale
   */
  hasSpecialHeating(material: MaterialDto): boolean {
    return (
      material.requiresHeatedBed === 'true' ||
      material.requiresChamberHeating === 'true'
    );
  }

  /**
   * Crea l'URL dell'immagine dal base64
   */
  getImageUrl(image: string): string {
    const base64 = image;
    return !base64
      ? '/assets/placeholder-material.png'
      : `data:image/jpeg;base64,${base64}`;
  }

  protected trackById(index: number, item: MaterialDto): string {
    return item.id;
  }
}
