import { Component } from '@angular/core';
import { PrivateSidebarComponent } from './private-sidebar/private-sidebar.component';

@Component({
  selector: 'printer-layout-private',
  imports: [PrivateSidebarComponent],
  templateUrl: './layout-private.component.html',
})
export class LayoutPrivateComponent {}
