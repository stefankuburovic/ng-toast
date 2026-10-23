import { ApplicationRef, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { provideToast } from './toast-config';
import { ToastComponent } from './toast.component';
import { ToastService } from './toast.service';

/** A custom toast the way a consumer writes one: extends the base, own template, attribute selector. */
@Component({
  selector: '[custom-toast]',
  template: `<p class="custom">{{ title }}: {{ message }}</p>`
})
class CustomToastComponent extends ToastComponent {}

describe('ToastService', () => {
  let toasts: ToastService;

  /** Runs change detection over the toasts, which belong to no view. */
  const render = (): void => TestBed.inject(ApplicationRef).tick();

  /** The toast elements in a container, top to bottom. */
  const shown = (position = 'toast-top-right'): HTMLElement[] =>
    Array.from(document.querySelectorAll<HTMLElement>(`.overlay-container .toast-container.${position} > div`));

  /** Sets up the test bed, optionally with app-wide options. */
  const setup = (...providers: ReturnType<typeof provideToast>[]): void => {
    TestBed.configureTestingModule({ providers });
    toasts = TestBed.inject(ToastService);
  };

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('opens a toast with its type class, title and message, without any provider', () => {
    setup();
    toasts.success('Gespeichert', 'Kunde');
    render();

    const [toast] = shown();
    expect(toast.tagName).toBe('DIV');
    expect(toast.classList).toContain('ng-toast');
    expect(toast.classList).toContain('toast-success');
    expect(toast.querySelector('.toast-title')?.textContent).toBe('Kunde');
    expect(toast.querySelector('.toast-message')?.textContent).toBe('Gespeichert');
    expect(toast.querySelector('.toast-close-button')).toBeNull();
  });

  it.each([
    ['error', 'toast-error'],
    ['info', 'toast-info'],
    ['warning', 'toast-warning']
  ] as const)('%s opens a %s toast', (method, type) => {
    setup();
    toasts[method]('x');
    render();

    expect(shown()[0].classList).toContain(type);
  });

  it('leaves out an absent title and message', () => {
    setup();
    toasts.info();
    render();

    expect(shown()[0].querySelector('.toast-title, .toast-message')).toBeNull();
  });

  it('goes after timeOut and the fade, and reports it on onHidden', async () => {
    setup();
    const toast = toasts.success('x');
    const hidden = firstValueFrom(toast.onHidden);
    render();

    vi.advanceTimersByTime(4999);
    render();
    expect(shown()[0].classList).not.toContain('toast-out');

    vi.advanceTimersByTime(1);
    render();
    expect(shown()[0].classList, 'the fade plays before the element goes').toContain('toast-out');

    vi.advanceTimersByTime(300);
    expect(shown()).toEqual([]);
    await expect(hidden).resolves.toBeUndefined();
  });

  it('stays while hovered and goes extendedTimeOut after the pointer leaves', () => {
    setup();
    toasts.success('x');
    render();
    const [toast] = shown();

    toast.dispatchEvent(new MouseEvent('mouseenter'));
    vi.advanceTimersByTime(60_000);
    expect(shown()).toHaveLength(1);

    toast.dispatchEvent(new MouseEvent('mouseleave'));
    vi.advanceTimersByTime(999);
    render();
    expect(toast.classList).not.toContain('toast-out');
    vi.advanceTimersByTime(1 + 300);
    expect(shown()).toEqual([]);
  });

  it('keeps a toast with disableTimeOut up, hover or not', () => {
    setup();
    toasts.error('x', '', { disableTimeOut: true });
    render();
    shown()[0].dispatchEvent(new MouseEvent('mouseleave'));

    vi.advanceTimersByTime(60_000);
    expect(shown()).toHaveLength(1);
  });

  it('reports a click on onTap and closes on it by default', () => {
    setup();
    const toast = toasts.success('x');
    const tapped = vi.fn();
    toast.onTap.subscribe(tapped);
    render();

    shown()[0].click();
    shown()[0].click();
    vi.advanceTimersByTime(300);

    expect(tapped, 'a second click on a closing toast is no tap').toHaveBeenCalledTimes(1);
    expect(shown()).toEqual([]);
  });

  it('reports a click but stays with tapToDismiss off', () => {
    setup();
    const toast = toasts.success('x', '', { tapToDismiss: false, disableTimeOut: true });
    const tapped = vi.fn();
    toast.onTap.subscribe(tapped);
    render();

    shown()[0].click();
    vi.advanceTimersByTime(1000);

    expect(tapped).toHaveBeenCalledTimes(1);
    expect(shown()).toHaveLength(1);
  });

  it('closes on the × without counting it as a tap', () => {
    setup();
    const toast = toasts.success('x', '', { closeButton: true, tapToDismiss: false });
    const tapped = vi.fn();
    toast.onTap.subscribe(tapped);
    render();

    shown()[0].querySelector<HTMLElement>('.toast-close-button')?.click();
    vi.advanceTimersByTime(300);

    expect(tapped).not.toHaveBeenCalled();
    expect(shown()).toEqual([]);
  });

  it('remove takes a toast out at once and answers false for one that is not open', async () => {
    setup();
    const toast = toasts.success('x');
    const hidden = firstValueFrom(toast.onHidden);
    render();

    expect(toasts.remove(toast.toastId)).toBe(true);
    expect(shown()).toEqual([]);
    await expect(hidden).resolves.toBeUndefined();
    expect(toasts.remove(toast.toastId)).toBe(false);
  });

  it('clear fades out one toast by id, or all of them', () => {
    setup();
    const first = toasts.success('1');
    toasts.success('2');
    toasts.success('3');
    render();

    toasts.clear(first.toastId);
    vi.advanceTimersByTime(300);
    expect(shown().map(t => t.textContent?.trim())).toEqual(['3', '2']);

    toasts.clear();
    vi.advanceTimersByTime(300);
    expect(shown()).toEqual([]);
  });

  it('stacks newest on top by default, below with newestOnTop off', () => {
    setup();
    toasts.success('1');
    toasts.success('2');
    toasts.success('3', '', { newestOnTop: false });
    render();

    expect(shown().map(t => t.textContent?.trim())).toEqual(['2', '1', '3']);
  });

  it('puts each positionClass into a container of its own, all in one live region', () => {
    setup();
    toasts.success('top');
    toasts.success('bottom', '', { positionClass: 'toast-bottom-right' });
    render();

    expect(shown()).toHaveLength(1);
    expect(shown('toast-bottom-right')).toHaveLength(1);
    expect(document.querySelectorAll('.overlay-container[aria-live="polite"]')).toHaveLength(1);
  });

  it('renders the message as HTML only with enableHtml', () => {
    setup();
    toasts.error('<ul><li>Name</li></ul>', '', { enableHtml: true });
    toasts.error('<b>plain</b>');
    render();

    const [plain, html] = shown();
    expect(html.querySelector('.toast-message li')?.textContent).toBe('Name');
    expect(plain.querySelector('.toast-message')?.textContent).toBe('<b>plain</b>');
  });

  it('applies the options given to provideToast, and a call overrides them', () => {
    setup(provideToast({ closeButton: true, toastClass: 'my-toast', timeOut: 1000 }));
    toasts.success('x');
    toasts.success('y', '', { closeButton: false });
    render();

    const [y, x] = shown();
    expect(x.classList).toContain('my-toast');
    expect(x.querySelector('.toast-close-button')).not.toBeNull();
    expect(y.querySelector('.toast-close-button')).toBeNull();
    vi.advanceTimersByTime(1300);
    expect(shown()).toEqual([]);
  });

  it('draws a toast with a custom component and hands back its instance', () => {
    setup();
    const toast = toasts.show<CustomToastComponent>('Text', 'Titel', { toastComponent: CustomToastComponent }, 'toast-info');
    render();

    expect(toast.componentRef.instance).toBeInstanceOf(CustomToastComponent);
    const element: HTMLElement = toast.componentRef.location.nativeElement;
    expect(element.tagName, 'an attribute selector gives the div the stylesheet is written for').toBe('DIV');
    expect(element.classList).toContain('toast-info');
    expect(element.querySelector('.custom')?.textContent).toBe('Titel: Text');
  });

  it('takes its toasts and the live region away when the app is destroyed', () => {
    setup();
    const toast = toasts.success('x');
    const hidden = vi.fn();
    toast.onHidden.subscribe(hidden);
    render();

    TestBed.resetTestingModule();

    expect(hidden).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.overlay-container')).toBeNull();
  });
});
