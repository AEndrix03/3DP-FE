import { Component, effect, input, InputSignal } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
} from '@angular/forms';
import { SlicingResultDto } from 'apps/printer-fe/src/app/core/models/slicing.models';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DatePickerModule } from 'primeng/datepicker';
import { IftaLabelModule } from 'primeng/iftalabel';
import { InputTextModule } from 'primeng/inputtext';

@Component({
  selector: 'printer-slicing-result-info',
  imports: [
    CardModule,
    InputTextModule,
    ButtonModule,
    IftaLabelModule,
    DatePickerModule,
    ReactiveFormsModule,
  ],
  templateUrl: './slicing-result-info.component.html',
})
export class SlicingResultInfoComponent {
  public readonly info: InputSignal<SlicingResultDto> = input.required();

  protected readonly form: FormGroup<SlicingInfoForm>;

  constructor(private readonly _fb: FormBuilder) {
    this.form = this._fb.group({
      id: new FormControl<string>({ value: null, disabled: true }),
      sourceId: new FormControl<string>({ value: null, disabled: true }),
      generatedId: new FormControl<string>({ value: null, disabled: true }),
      lines: new FormControl<number>({ value: null, disabled: true }),
      createdAt: new FormControl<Date>({ value: null, disabled: true }),
    });

    effect(() => {
      const info = this.info();
      if (info) {
        this.form.patchValue(info);
      }
    });
  }

  protected get idFc(): FormControl<string> {
    return this.form.get('id') as FormControl<string>;
  }

  protected get sourceIdFc(): FormControl<string> {
    return this.form.get('sourceId') as FormControl<string>;
  }

  protected get generatedIdFc(): FormControl<string> {
    return this.form.get('generatedId') as FormControl<string>;
  }

  protected get linesFc(): FormControl<number> {
    return this.form.get('lines') as FormControl<number>;
  }

  protected get createdAtFc(): FormControl<Date> {
    return this.form.get('createdAt') as FormControl<Date>;
  }
}

interface SlicingInfoForm {
  id: FormControl<string>;
  sourceId: FormControl<string>;
  generatedId: FormControl<string>;
  lines: FormControl<number>;
  createdAt: FormControl<Date>;
}
