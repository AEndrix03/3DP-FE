import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PageTitleComponent } from '../../../core/components/shared/page-title/page-title.component';
import { CarouselComponent } from '../../../core/components/shared/carousel/carousel.component';

@Component({
  selector: 'printer-printers',
  imports: [CommonModule, PageTitleComponent, CarouselComponent],
  templateUrl: './printers.component.html',
})
export class PrintersComponent {
  public slides = Array.from({ length: 10 }, (_, i) => `Slide ${i + 1}`);
}
