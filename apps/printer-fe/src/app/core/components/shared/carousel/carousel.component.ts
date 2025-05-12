import { Component, ContentChild, Input, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CarouselModule } from 'primeng/carousel';

@Component({
  selector: 'printer-carousel',
  standalone: true,
  imports: [CommonModule, CarouselModule],
  templateUrl: './carousel.component.html',
})
export class CarouselComponent<T> {
  /** Array di elementi da visualizzare */
  @Input() value: T[] = [];
  /** Intervallo di autoplay in ms */
  @Input() autoplayInterval: number = 0;
  @Input() numVisible: number = 3;
  /** Template per ogni elemento */
  @ContentChild(TemplateRef) template!: TemplateRef<any>;
}
