import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SlicingResultTabInfoComponent } from './slicing-result-tab-info.component';

describe('SlicingResultTabInfoComponent', () => {
  let component: SlicingResultTabInfoComponent;
  let fixture: ComponentFixture<SlicingResultTabInfoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SlicingResultTabInfoComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SlicingResultTabInfoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
