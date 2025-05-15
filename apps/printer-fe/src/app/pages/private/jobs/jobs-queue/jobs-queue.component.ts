import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { IconFieldModule } from 'primeng/iconfield';
import { InputTextModule } from 'primeng/inputtext';
import { InputIconModule } from 'primeng/inputicon';
import { CommonModule } from '@angular/common';
import { DropdownModule } from 'primeng/dropdown';
import { FormsModule } from '@angular/forms';

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
  ],
  templateUrl: './jobs-queue.component.html',
})
export class JobsQueueComponent {
  @Input() loading = false;
  @Input() jobs: JobDto[] = [
    {
      id: 'c0a80123-bb12-4a9e-9c55-d1e34a3bdf7f',
      name: 'Supporto Ventola',
      printer: 'Delta 3D-01',
      status: 'QUEUED',
      slicer: 'Cura',
      submittedAt: '2025-05-16 09:34',
      verified: true,
    },
    {
      id: 'a1c422ac-512e-4e33-9f90-37f36717215f',
      name: 'Case Raspberry Pi',
      printer: 'Creality Ender 3',
      status: 'RUNNING',
      slicer: 'PrusaSlicer',
      submittedAt: '2025-05-16 08:12',
      verified: true,
    },
    {
      id: '15d8a693-9f32-4a5e-89f2-097f688a5c99',
      name: 'Gearbox Support',
      printer: 'Anycubic Mega',
      status: 'ERROR',
      slicer: 'SuperSlicer',
      submittedAt: '2025-05-15 21:48',
      verified: false,
    },
  ];

  @Output() jobSelected = new EventEmitter<JobDto>();
  @Output() statusChanged = new EventEmitter<string>();

  selectedStatus: string | null = null;

  statuses = [
    { label: 'Queued', value: 'QUEUED' },
    { label: 'Running', value: 'RUNNING' },
    { label: 'Error', value: 'ERROR' },
    { label: 'Completed', value: 'COMPLETED' },
  ];

  getSeverity(status: string): string {
    switch (status) {
      case 'RUNNING':
        return 'info';
      case 'QUEUED':
        return 'warning';
      case 'ERROR':
        return 'danger';
      case 'COMPLETED':
        return 'success';
      default:
        return '';
    }
  }

  onStatusChange(value: string): void {
    this.selectedStatus = value;
    this.statusChanged.emit(value);
  }

  onJobSelect(job: JobDto): void {
    this.jobSelected.emit(job);
  }
}

// job.dto.ts
export interface JobDto {
  id: string;
  name: string;
  printer: string;
  status: 'QUEUED' | 'RUNNING' | 'ERROR' | 'COMPLETED';
  slicer: string;
  submittedAt: string;
  verified: boolean;
}
