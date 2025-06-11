import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SlicingResultInfoComponent } from './slicing-result-info.component';

describe('SlicingResultInfoComponent', () => {
  let component: SlicingResultInfoComponent;
  let fixture: ComponentFixture<SlicingResultInfoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SlicingResultInfoComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SlicingResultInfoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
