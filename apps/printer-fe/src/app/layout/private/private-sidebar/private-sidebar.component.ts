import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Observable } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';

@Component({
  selector: 'printer-private-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, ButtonModule, TooltipModule],
  templateUrl: './private-sidebar.component.html',
})
export class PrivateSidebarComponent implements OnInit {
  private breakpointObserver = inject(BreakpointObserver);

  // Track if sidebar is visible on smaller screens
  isSidebarVisible = true;

  // Track screen size for responsive behavior
  isHandset$: Observable<boolean> = this.breakpointObserver
    .observe(Breakpoints.Handset)
    .pipe(
      map((result) => result.matches),
      shareReplay()
    );

  ngOnInit(): void {
    // Subscribe to screen size changes for responsive behavior
    this.isHandset$.subscribe((isHandset) => {
      // On small screens, hide sidebar by default
      this.isSidebarVisible = !isHandset;
    });
  }

  /**
   * Toggle sidebar visibility on mobile
   */
  toggleSidebar(): void {
    this.isSidebarVisible = !this.isSidebarVisible;
  }

  /**
   * Navigation shortcut handler (keyboard navigation)
   * @param event Keyboard event
   */
  handleKeyboardShortcut(event: KeyboardEvent): void {
    // Implement keyboard shortcuts (g + d -> Dashboard, etc.)
    if (event.key === 'd' && event.altKey) {
      // Navigate to dashboard
    }
  }
}
