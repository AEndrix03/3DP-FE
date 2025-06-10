import { Component, effect, input, InputSignal } from '@angular/core';
import {
  ModelDto,
  ModelSaveDto,
} from 'apps/printer-fe/src/app/core/models/model.models';
import { InputTextModule } from 'primeng/inputtext';
import { IftaLabelModule } from 'primeng/iftalabel';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { TextareaModule } from 'primeng/textarea';
import { DatePickerModule } from 'primeng/datepicker';
import { NgIf } from '@angular/common';

@Component({
  selector: 'printer-model-detail-info',
  imports: [
    InputTextModule,
    IftaLabelModule,
    ReactiveFormsModule,
    TextareaModule,
    DatePickerModule,
    NgIf,
  ],
  templateUrl: './model-detail-info.component.html',
})
export class ModelDetailInfoComponent {
  public readonly model: InputSignal<ModelDto> = input.required();

  protected readonly fg: FormGroup<ModelForm>;

  constructor(private readonly _fb: FormBuilder) {
    this.fg = this._fb.group({
      name: new FormControl<string>(null, Validators.required),
      description: new FormControl<string>(null),
      id: new FormControl<string>({ value: null, disabled: true }),
      resourceId: new FormControl<string>({ value: null, disabled: true }),
      createdAt: new FormControl<Date>({ value: null, disabled: true }),
      updatedAt: new FormControl<Date>({ value: null, disabled: true }),
    });

    effect(() => {
      const model = this.model();
      this.fg.patchValue(model);
    });
  }

  public get data(): ModelSaveDto {
    return {
      id: this.idFc.value,
      name: this.nameFc.value,
      description: this.descriptionFc.value,
    };
  }

  protected get nameFc(): FormControl<string> {
    return this.fg.get('name') as FormControl<string>;
  }

  protected get descriptionFc(): FormControl<string> {
    return this.fg.get('description') as FormControl<string>;
  }

  protected get idFc(): FormControl<string> {
    return this.fg.get('id') as FormControl<string>;
  }

  protected get resourceIdFc(): FormControl<string> {
    return this.fg.get('resourceId') as FormControl<string>;
  }

  protected get createdAtFc(): FormControl<Date> {
    return this.fg.get('createdAt') as FormControl<Date>;
  }

  protected get updatedAtFc(): FormControl<Date> {
    return this.fg.get('updatedAt') as FormControl<Date>;
  }
}

interface ModelForm {
  name: FormControl<string>;
  description: FormControl<string>;
  id: FormControl<string>;
  resourceId: FormControl<string>;
  createdAt: FormControl<Date>;
  updatedAt: FormControl<Date>;
}
