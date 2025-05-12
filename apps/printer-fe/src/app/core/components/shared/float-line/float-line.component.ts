import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'printer-float-line',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './float-line.component.html',
})
export class FloatLineComponent {
  @Input() direction: 'row' | 'col' = 'row';

  get flexClass(): string {
    return this.direction === 'row' ? 'flex-row' : 'flex-col';
  }
}
