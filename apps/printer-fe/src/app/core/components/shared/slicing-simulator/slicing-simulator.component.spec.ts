import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SlicingSimulatorComponent } from './slicing-simulator.component';

describe('SlicingSimulatorComponent', () => {
  let component: SlicingSimulatorComponent;
  let fixture: ComponentFixture<SlicingSimulatorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SlicingSimulatorComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SlicingSimulatorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
