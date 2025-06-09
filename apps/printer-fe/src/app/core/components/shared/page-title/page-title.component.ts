import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FloatLineComponent } from '../float-line/float-line.component';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'printer-page-title',
  standalone: true,
  imports: [CommonModule, FloatLineComponent, ButtonModule],
  templateUrl: './page-title.component.html',
})
export class PageTitleComponent {
  @Input() title: string = '';
  @Input() showBack: boolean = false;

  @Output() back = new EventEmitter<void>();
}
