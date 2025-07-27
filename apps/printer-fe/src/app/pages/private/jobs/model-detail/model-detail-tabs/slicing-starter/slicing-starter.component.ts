import { Component, input, InputSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DynamicDialogRef } from 'primeng/dynamicdialog';
import { ButtonModule } from 'primeng/button';
import { SlicingProfileComponent } from './slicing-profile/slicing-profile.component';
import { SlicingPropertyDto } from '../../../../../../core/models/slicing/slicing-property.models';

@Component({
  selector: 'printer-slicing-starter',
  standalone: true,
  imports: [CommonModule, ButtonModule, SlicingProfileComponent],
  templateUrl: './slicing-starter.component.html',
})
export class SlicingStarterComponent {
  public readonly profiles: InputSignal<SlicingPropertyDto[]> =
    input.required();

  constructor(private ref: DynamicDialogRef) {}

  protected createProfile() {}

  protected openProfile(id: string): void {}
}
