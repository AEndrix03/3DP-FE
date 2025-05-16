import { Component, effect, EventEmitter, Output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { PrinterFilterDto } from '../../../../core/models/printer.models';
import { toSignal } from '@angular/core/rxjs-interop';
import { DropdownModule } from 'primeng/dropdown';
import { InputText } from 'primeng/inputtext';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';

@Component({
  selector: 'printer-printers-filter',
  imports: [
    ReactiveFormsModule,
    DropdownModule,
    InputText,
    IconField,
    InputIcon,
  ],
  templateUrl: './printers-filter.component.html',
})
export class PrintersFilterComponent {
  @Output() filtersChanged = new EventEmitter<PrinterFilterDto>();

  protected readonly form = new FormGroup<PrinterFilterForm>({
    name: new FormControl<string>(''),
    driverId: new FormControl<string>(''),
  });

  constructor() {
    effect(() => {
      this.filtersChanged.emit({
        name: this.nameSignal(),
        driverId: this.driverIdSignal(),
      });
    });
  }

  protected nameFc(): FormControl<string> {
    return this.form.get('name') as FormControl;
  }

  protected driverIdFc(): FormControl<string> {
    return this.form.get('driverId') as FormControl;
  }

  private nameSignal = toSignal(this.nameFc().valueChanges, {
    initialValue: this.form.get('name')?.value,
  });

  private driverIdSignal = toSignal(this.driverIdFc().valueChanges, {
    initialValue: this.form.get('driverId')?.value,
  });
}

interface PrinterFilterForm {
  name: FormControl<string>;
  driverId: FormControl<string>;
}
