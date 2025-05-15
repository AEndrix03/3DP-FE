import { Component } from '@angular/core';
import { Button } from 'primeng/button';
import { PageTitleComponent } from '../../../core/components/shared/page-title/page-title.component';
import { JobsQueueComponent } from './jobs-queue/jobs-queue.component';

@Component({
  selector: 'printer-jobs',
  imports: [Button, PageTitleComponent, JobsQueueComponent],
  templateUrl: './jobs.component.html',
})
export class JobsComponent {
  protected addModel() {}
}
