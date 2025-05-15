import { Directive, ElementRef, HostListener } from '@angular/core';

@Directive({
  selector: '[printerScrollHorizontal]',
  standalone: true,
})
export class ScrollHorizontalDirective {
  constructor(private el: ElementRef<HTMLElement>) {}

  @HostListener('wheel', ['$event'])
  onWheel(event: WheelEvent) {
    if (event.deltaY === 0) return;

    event.preventDefault();
    this.el.nativeElement.scrollLeft += event.deltaY;
  }
}
