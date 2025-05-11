import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';

@Component({
  selector: 'praetor-logout-confirm',
  standalone: true,
  imports: [CommonModule, ButtonModule, DialogModule],
  templateUrl: './logout-confirm.component.html',
})
export class LogoutConfirmComponent {
  visible = false;

  @Output() confirmLogout = new EventEmitter<void>();
  @Output() cancelLogout = new EventEmitter<void>();

  open(): void {
    this.visible = true;
  }

  close(): void {
    this.visible = false;
  }

  confirm(): void {
    this.confirmLogout.emit();
    this.close();
  }

  cancel(): void {
    this.cancelLogout.emit();
    this.close();
  }
}
