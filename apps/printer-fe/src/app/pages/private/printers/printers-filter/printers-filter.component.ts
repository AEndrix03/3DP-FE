import { Component, effect, EventEmitter, Input, Output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import {
  PrinterFilterDto,
  PrinterStatusDto,
} from '../../../../core/models/printer.models';
import { toSignal } from '@angular/core/rxjs-interop';
import { DropdownModule } from 'primeng/dropdown';

@Component({
  selector: 'printer-printers-filter',
  imports: [ReactiveFormsModule, DropdownModule],
  templateUrl: './printers-filter.component.html',
})
export class PrintersFilterComponent {
  @Input() statusList: PrinterStatusDto[];

  @Output() filtersChanged = new EventEmitter<PrinterFilterDto>();

  protected readonly form = new FormGroup<PrinterFilterForm>({
    name: new FormControl<string>(''),
    driverId: new FormControl<string>(''),
    statusCode: new FormControl<string | null>(null),
  });

  constructor() {
    effect(() => {
      this.filtersChanged.emit({
        name: this.nameSignal(),
        driverId: this.driverIdSignal(),
        statusCode: this.statusSignal(),
      });
    });
  }

  protected nameFc(): FormControl<string> {
    return this.form.get('name') as FormControl;
  }

  protected driverIdFc(): FormControl<string> {
    return this.form.get('driverId') as FormControl;
  }

  protected statusCodeFc(): FormControl<string | null> {
    return this.form.get('statusCode') as FormControl;
  }

  protected get _statusList(): PrinterStatusDto[] {
    return [{ code: null, description: 'ALL' }, ...this.statusList];
  }

  private nameSignal = toSignal(this.nameFc().valueChanges, {
    initialValue: this.form.get('name')?.value,
  });

  private driverIdSignal = toSignal(this.driverIdFc().valueChanges, {
    initialValue: this.form.get('driverId')?.value,
  });

  private statusSignal = toSignal(this.statusCodeFc().valueChanges, {
    initialValue: this.form.get('statusCode')?.value,
  });
}

interface PrinterFilterForm {
  name: FormControl<string>;
  driverId: FormControl<string>;
  statusCode: FormControl<string | null>;
}
