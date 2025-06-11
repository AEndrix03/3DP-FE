import {
  Component,
  computed,
  signal,
  Signal,
  WritableSignal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { PageTitleComponent } from '../../../core/components/shared/page-title/page-title.component';
import { SlicingSimulatorComponent } from '../../../core/components/shared/slicing-simulator/slicing-simulator.component';
import { SlicingResultInfoComponent } from './slicing-result-info/slicing-result-info.component';
import { SlicingResultTabsComponent } from './slicing-result-tabs/slicing-result-tabs.component';
import { Router } from '@angular/router';

@Component({
  selector: 'printer-slicing-result',
  imports: [
    CommonModule,
    PageTitleComponent,
    SlicingSimulatorComponent,
    SlicingResultInfoComponent,
    SlicingResultTabsComponent,
  ],
  templateUrl: './slicing-result.component.html',
})
export class SlicingResultComponent {
  protected readonly back: Signal<() => void> = signal(null);
  protected readonly showBack: Signal<boolean> = computed(
    () => this.back() != null
  );

  private readonly fromRoute: WritableSignal<string | null> = signal(null);
  private readonly fromRouteId: WritableSignal<string | null> = signal(null);

  constructor(private readonly router: Router) {
    this.back = computed(() =>
      this.fromRoute() == null
        ? null
        : () =>
            this.router.navigate([this.fromRoute()], {
              queryParams: { id: this.fromRouteId() },
            })
    );

    const state = this.router.getCurrentNavigation()?.extras
      ?.state as unknown as any;

    this.fromRoute.set(state?.from as string | null);
    this.fromRouteId.set(state?.id as string | null);
  }
}
