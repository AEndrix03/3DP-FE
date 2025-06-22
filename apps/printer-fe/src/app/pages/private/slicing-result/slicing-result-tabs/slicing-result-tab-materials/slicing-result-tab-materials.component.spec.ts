import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SlicingResultTabMaterialsComponent } from './slicing-result-tab-materials.component';

describe('SlicingResultTabMaterialsComponent', () => {
  let component: SlicingResultTabMaterialsComponent;
  let fixture: ComponentFixture<SlicingResultTabMaterialsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SlicingResultTabMaterialsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SlicingResultTabMaterialsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
