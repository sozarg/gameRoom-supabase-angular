import { Directive, ElementRef, HostListener, inject } from '@angular/core';

@Directive({
  selector: '[appInteraction]',
  standalone: true
})
export class InteractionDirective {
  private el = inject(ElementRef);

  @HostListener('mouseenter') onMouseEnter() {
    this.transform('scale(1.02)');
  }

  @HostListener('mouseleave') onMouseLeave() {
    this.transform('scale(1)');
  }

  @HostListener('mousedown') onMouseDown() {
    this.transform('scale(0.98)');
  }

  @HostListener('mouseup') onMouseUp() {
    this.transform('scale(1.02)');
  }

  private transform(value: string) {
    this.el.nativeElement.style.transform = value;
    this.el.nativeElement.style.transition = 'transform 0.2s ease-in-out';
  }
}
