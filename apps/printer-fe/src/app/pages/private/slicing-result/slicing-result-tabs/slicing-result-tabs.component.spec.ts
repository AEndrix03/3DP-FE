import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SlicingResultTabsComponent } from './slicing-result-tabs.component';

describe('SlicingResultTabsComponent', () => {
  let component: SlicingResultTabsComponent;
  let fixture: ComponentFixture<SlicingResultTabsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SlicingResultTabsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SlicingResultTabsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
