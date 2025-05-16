import {
  Component,
  effect,
  EventEmitter,
  Input,
  model,
  ModelSignal,
  Output,
} from '@angular/core';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { IconFieldModule } from 'primeng/iconfield';
import { InputTextModule } from 'primeng/inputtext';
import { InputIconModule } from 'primeng/inputicon';
import { CommonModule } from '@angular/common';
import { DropdownModule } from 'primeng/dropdown';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import {
  JobSimpleDto,
  JobStatusCode,
  JobStatusDto,
} from '../../../../core/models/job.models';

@Component({
  selector: 'printer-jobs-queue',
  imports: [
    CommonModule,
    TableModule,
    DropdownModule,
    TagModule,
    InputTextModule,
    IconFieldModule,
    InputIconModule,
    FormsModule,
    Button,
  ],
  templateUrl: './jobs-queue.component.html',
})
export class JobsQueueComponent {
  @Input() loading = false;
  @Input() jobs: JobSimpleDto[] = [];
  @Input() statuses: JobStatusDto[] = [];

  @Output() jobSelected = new EventEmitter<string>();
  @Output() statusChanged = new EventEmitter<string>();

  protected readonly selectedStatus: ModelSignal<string> = model(null);

  constructor() {
    effect(() => this.statusChanged.emit(this.selectedStatus()));
  }

  protected getSeverity(statusCode: JobStatusCode): string {
    switch (statusCode) {
      case 'CRE':
        return 'info';
      case 'QUE':
        return 'info';
      case 'RUN':
        return 'warning';
      case 'ERR':
        return 'danger';
      case 'STP':
        return 'help';
      case 'CMP':
        return 'success';
      default:
        return 'danger';
    }
  }

  protected openJob(jobId: string) {
    this.jobSelected.emit(jobId);
  }
}
