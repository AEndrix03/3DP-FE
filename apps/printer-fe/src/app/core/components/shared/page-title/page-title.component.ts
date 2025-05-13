import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FloatLineComponent } from '../float-line/float-line.component';

@Component({
  selector: 'printer-page-title',
  standalone: true,
  imports: [CommonModule, FloatLineComponent],
  templateUrl: './page-title.component.html',
})
export class PageTitleComponent {
  @Input() title: string = '';
}
