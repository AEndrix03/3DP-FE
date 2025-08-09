import { Component, effect, EventEmitter, Output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { DropdownModule } from 'primeng/dropdown';
import { InputText } from 'primeng/inputtext';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { MaterialFilterDto } from '../../../../core/models/material.models';

@Component({
  selector: 'printer-materials-filter',
  imports: [
    ReactiveFormsModule,
    DropdownModule,
    InputText,
    IconField,
    InputIcon,
  ],
  templateUrl: './materials-filter.component.html',
})
export class MaterialsFilterComponent {
  @Output() filtersChanged = new EventEmitter<MaterialFilterDto>();

  protected readonly form = new FormGroup<PrinterFilterForm>({
    name: new FormControl<string>(''),
    id: new FormControl<string>(''),
  });

  constructor() {
    effect(() => {
      this.filtersChanged.emit({
        name: this.nameSignal(),
        id: this.idSignal(),
      });
    });
  }

  protected nameFc(): FormControl<string> {
    return this.form.get('name') as FormControl;
  }

  protected idFc(): FormControl<string> {
    return this.form.get('id') as FormControl;
  }

  private nameSignal = toSignal(this.nameFc().valueChanges, {
    initialValue: this.form.get('name')?.value,
  });

  private idSignal = toSignal(this.idFc().valueChanges, {
    initialValue: this.form.get('id')?.value,
  });
}

interface PrinterFilterForm {
  name: FormControl<string>;
  id: FormControl<string>;
}
