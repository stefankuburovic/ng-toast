import { ApplicationRef, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { provideToast } from './toast-config';
import { ToastComponent } from './toast.component';
import { ToastService } from './toast.service';

/** A custom toast the way a consumer writes one: extends the base, own template, attribute selector. */
@Component({
  selector: '[custom-toast]',
  template: `<p class="custom">{{ title() }}: {{ message() }}</p>`
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

  /** Sends the page to a background tab, or brings it back. */
  const setHidden = (hidden: boolean): void => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: hidden });
    document.dispatchEvent(new Event('visibilitychange'));
  };

  /** The text of each toast's message, top to bottom. */
  const messages = (): (string | undefined)[] =>
    shown().map(t => t.querySelector('.toast-message')?.textContent ?? undefined);

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    // Drops the own property setHidden put over the prototype's getter.
    delete (document as { hidden?: boolean }).hidden;
  });

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

  it('puts each positionClass into a container of its own, all in one overlay', () => {
    setup();
    toasts.success('top');
    toasts.success('bottom', '', { positionClass: 'toast-bottom-right' });
    render();

    expect(shown()).toHaveLength(1);
    expect(shown('toast-bottom-right')).toHaveLength(1);
    expect(document.querySelectorAll('.overlay-container')).toHaveLength(1);
  });

  it('announces an error as an alert and anything else as a status, once', () => {
    setup();
    toasts.error('Not saved');
    toasts.success('Saved');
    toasts.info('', 'Only a title');
    render();

    const [title, success, error] = shown();
    expect(error.querySelector('.toast-message')?.getAttribute('role')).toBe('alert');
    expect(success.querySelector('.toast-message')?.getAttribute('role')).toBe('status');
    expect(title.querySelector('.toast-title')?.getAttribute('role')).toBe('status');
    expect(
      document.querySelector('.overlay-container')?.hasAttribute('aria-live'),
      'no live region around the live regions'
    ).toBe(false);
  });

  it('turns the status into an alert when an update makes the toast an error', () => {
    setup();
    const toast = toasts.info('Saving');
    render();

    toast.update({ type: 'toast-error', message: 'Not saved' });
    render();
    expect(shown()[0].querySelector('.toast-message')?.getAttribute('role')).toBe('alert');
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

  describe('update', () => {
    it('changes content, type and options in place and starts the timer over', () => {
      setup();
      const toast = toasts.info('Uploading', 'File', { disableTimeOut: true });
      render();
      vi.advanceTimersByTime(60_000);

      toast.update({ message: 'Uploaded', type: 'toast-success', disableTimeOut: false });
      render();
      const [element] = shown();
      expect(element.classList).toContain('toast-success');
      expect(element.classList).not.toContain('toast-info');
      expect(element.querySelector('.toast-title')?.textContent).toBe('File');
      expect(toast.message()).toBe('Uploaded');

      vi.advanceTimersByTime(5000 + 300);
      expect(shown()).toEqual([]);
    });

    it('does nothing once the toast is gone', () => {
      setup();
      const toast = toasts.info('x');
      toasts.remove(toast.toastId);

      expect(() => toast.update({ message: 'y' })).not.toThrow();
      expect(toast.message()).toBe('x');
    });
  });

  describe('promise', () => {
    /** A promise and the hands that settle it. */
    const deferred = <T>() => {
      let resolve!: (value: T) => void;
      let reject!: (error: unknown) => void;
      const promise = new Promise<T>((res, rej) => ((resolve = res), (reject = rej)));
      return { promise, resolve, reject };
    };

    it('shows loading, which stays and ignores clicks, then success made from the result', async () => {
      setup();
      const { promise, resolve } = deferred<{ name: string }>();
      toasts.promise(promise, { loading: 'Saving', success: c => `Saved ${c.name}`, error: 'Failed' });
      render();

      const [element] = shown();
      expect(element.classList).toContain('toast-loading');
      element.click();
      vi.advanceTimersByTime(60_000);
      expect(shown()).toHaveLength(1);

      resolve({ name: 'Ana' });
      await Promise.resolve();
      render();
      expect(element.classList).toContain('toast-success');
      expect(messages()).toEqual(['Saved Ana']);

      vi.advanceTimersByTime(5000 + 300);
      expect(shown(), 'the settled toast has its timer back').toEqual([]);
    });

    it('turns into an error toast when the promise rejects', async () => {
      setup();
      const { promise, reject } = deferred<void>();
      toasts.promise(promise, {
        loading: { message: 'Saving', title: 'Customer' },
        success: 'Saved',
        error: e => ({ message: String(e), title: 'Not saved' })
      });

      reject('Offline');
      await Promise.resolve();
      render();
      const [element] = shown();
      expect(element.classList).toContain('toast-error');
      expect(element.querySelector('.toast-title')?.textContent).toBe('Not saved');
      expect(messages()).toEqual(['Offline']);
    });
  });

  describe('progress bar', () => {
    const bar = (): HTMLElement | null => shown()[0].querySelector('.toast-progress');

    it('runs for timeOut, goes while hovered and runs again for extendedTimeOut', () => {
      setup(provideToast({ progressBar: true }));
      toasts.success('x');
      render();
      const [element] = shown();
      expect(bar()?.style.animationDuration).toBe('5000ms');

      element.dispatchEvent(new MouseEvent('mouseenter'));
      render();
      expect(bar()).toBeNull();

      element.dispatchEvent(new MouseEvent('mouseleave'));
      render();
      expect(bar()?.style.animationDuration).toBe('1000ms');
    });

    it('fills instead of emptying with progressAnimation increasing, and is off by default', () => {
      setup();
      toasts.success('x', '', { progressBar: true, progressAnimation: 'increasing' });
      toasts.success('y');
      render();

      const [y, x] = shown();
      expect(x.querySelector('.toast-progress')?.classList).toContain('toast-progress-increasing');
      expect(y.querySelector('.toast-progress')).toBeNull();
    });
  });

  describe('background tab', () => {
    it('stops the timer while the tab is hidden and runs on from where it stopped', () => {
      setup();
      toasts.success('x');
      render();
      vi.advanceTimersByTime(3000);

      setHidden(true);
      render();
      expect(shown()[0].classList).toContain('toast-paused');
      vi.advanceTimersByTime(60_000);
      expect(shown()).toHaveLength(1);

      setHidden(false);
      vi.advanceTimersByTime(1999);
      render();
      expect(shown()[0].classList).not.toContain('toast-out');
      vi.advanceTimersByTime(1 + 300);
      expect(shown()).toEqual([]);
    });

    it('lets the timer run with pauseWhenHidden off', () => {
      setup();
      toasts.success('x', '', { pauseWhenHidden: false });
      setHidden(true);

      vi.advanceTimersByTime(5300);
      expect(shown()).toEqual([]);
    });
  });

  describe('maxOpened', () => {
    it('keeps the toasts over the limit waiting and brings them up as the open ones go', () => {
      setup(provideToast({ maxOpened: 2, newestOnTop: false }));
      const first = toasts.success('1');
      toasts.success('2');
      const third = toasts.success('3');
      render();
      expect(messages()).toEqual(['1', '2']);
      expect(third.componentRef.location.nativeElement.isConnected).toBe(false);

      toasts.clear(first.toastId);
      vi.advanceTimersByTime(300);
      render();
      expect(messages()).toEqual(['2', '3']);
    });

    it('starts the timer of a waiting toast only when it comes up', () => {
      setup(provideToast({ maxOpened: 1 }));
      const first = toasts.success('1', '', { disableTimeOut: true });
      toasts.success('2');
      vi.advanceTimersByTime(60_000);

      toasts.remove(first.toastId);
      render();
      expect(messages()).toEqual(['2']);
      vi.advanceTimersByTime(5300);
      expect(shown()).toEqual([]);
    });

    it('clear takes the waiting toasts away without bringing them up', () => {
      setup(provideToast({ maxOpened: 1 }));
      toasts.success('1');
      const waiting = toasts.success('2');
      const hidden = vi.fn();
      waiting.onHidden.subscribe(hidden);

      toasts.clear();
      expect(hidden).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(300);
      expect(shown()).toEqual([]);
    });

    it('reports onShown when a toast comes up: at once, to a late subscriber too, or once there is room', () => {
      setup(provideToast({ maxOpened: 1 }));
      const first = toasts.success('1');
      const second = toasts.success('2');
      const third = toasts.success('3');
      const [firstShown, secondShown, thirdShown] = [vi.fn(), vi.fn(), vi.fn()];
      const thirdDone = vi.fn();
      first.onShown.subscribe(firstShown);
      second.onShown.subscribe(secondShown);
      third.onShown.subscribe({ next: thirdShown, complete: thirdDone });

      expect(firstShown).toHaveBeenCalledTimes(1);
      expect(secondShown).not.toHaveBeenCalled();

      toasts.remove(first.toastId);
      expect(secondShown).toHaveBeenCalledTimes(1);

      toasts.remove(third.toastId);
      expect(thirdShown, 'it went while still waiting').not.toHaveBeenCalled();
      expect(thirdDone).toHaveBeenCalledTimes(1);
    });

    it('closes the oldest instead of waiting with autoDismiss', () => {
      setup(provideToast({ maxOpened: 2, autoDismiss: true, newestOnTop: false }));
      toasts.success('1');
      toasts.success('2');
      toasts.success('3');
      render();
      expect(shown()[0].classList).toContain('toast-out');

      vi.advanceTimersByTime(300);
      expect(messages()).toEqual(['2', '3']);
    });
  });

  describe('preventDuplicates', () => {
    it('hands back the toast that is up instead of opening the same again', () => {
      setup(provideToast({ preventDuplicates: true }));
      const first = toasts.error('Offline');
      const again = toasts.error('Offline');
      toasts.warning('Offline');
      toasts.error('Offline', 'Network');
      render();

      expect(again).toBe(first);
      expect(shown(), 'another type or title is another toast').toHaveLength(3);
    });

    it('counts the duplicates with countDuplicates', () => {
      setup(provideToast({ preventDuplicates: true, countDuplicates: true }));
      toasts.error('Offline');
      toasts.error('Offline');
      toasts.error('Offline');
      render();

      expect(messages()).toEqual(['Offline [3]']);
    });

    it('starts the timer over with resetTimeoutOnDuplicate, and not without', () => {
      setup(provideToast({ preventDuplicates: true, resetTimeoutOnDuplicate: true }));
      toasts.error('Offline');
      vi.advanceTimersByTime(4000);
      toasts.error('Offline');

      vi.advanceTimersByTime(4000);
      expect(shown()).toHaveLength(1);
      vi.advanceTimersByTime(1000 + 300);
      expect(shown()).toEqual([]);
    });

    it('opens a new one when the one that was up is already closing', () => {
      setup(provideToast({ preventDuplicates: true }));
      const first = toasts.error('Offline');
      toasts.clear();

      expect(toasts.error('Offline')).not.toBe(first);
    });
  });

  describe('stacked', () => {
    const index = (toast: HTMLElement): string => toast.style.getPropertyValue('--toast-index');
    const pane = (): HTMLElement => document.querySelector('.toast-container.toast-top-right')!;

    it('marks the container and numbers its toasts newest first, whatever newestOnTop says', () => {
      setup(provideToast({ stacked: true, newestOnTop: false }));
      toasts.success('1');
      toasts.success('2');
      toasts.success('3');
      render();

      expect(pane().classList).toContain('toast-stacked');
      expect(pane().style.getPropertyValue('--toast-count')).toBe('3');
      expect(shown().map(t => [t.textContent?.trim(), index(t)])).toEqual([
        ['1', '2'],
        ['2', '1'],
        ['3', '0']
      ]);
    });

    it('numbers the stack again when a toast goes', () => {
      setup(provideToast({ stacked: true }));
      toasts.success('1');
      const front = toasts.success('2');

      toasts.remove(front.toastId);
      expect(index(shown()[0])).toBe('0');
      expect(pane().style.getPropertyValue('--toast-count')).toBe('1');
    });

    it('holds every timer while the pointer is on the stack, and lets them run out after', () => {
      setup(provideToast({ stacked: true }));
      toasts.success('1');
      vi.advanceTimersByTime(4000);
      toasts.success('2');

      pane().dispatchEvent(new MouseEvent('mouseenter'));
      // The pointer is on the front toast; in a stack that does not decide alone.
      shown()[0].dispatchEvent(new MouseEvent('mouseleave'));
      vi.advanceTimersByTime(60_000);
      expect(shown()).toHaveLength(2);

      toasts.success('3');
      vi.advanceTimersByTime(60_000);
      expect(shown(), 'one that comes up while the stack is held waits too').toHaveLength(3);

      pane().dispatchEvent(new MouseEvent('mouseleave'));
      vi.advanceTimersByTime(1000 + 300);
      expect(shown()).toEqual([]);
    });

    it('leaves a container alone without stacked', () => {
      setup();
      toasts.success('1');

      expect(pane().classList).not.toContain('toast-stacked');
      expect(index(shown()[0])).toBe('');
    });
  });

  describe('actions', () => {
    it('runs the action, reports it on onAction and closes, without counting as a tap', () => {
      setup();
      const undo = vi.fn();
      const action = { label: 'Undo', onClick: undo };
      const toast = toasts.info('Deleted', '', { actions: [action], tapToDismiss: false });
      const tapped = vi.fn();
      const acted = vi.fn();
      toast.onTap.subscribe(tapped);
      toast.onAction.subscribe(acted);
      render();

      const button = shown()[0].querySelector<HTMLElement>('.toast-action');
      expect(button?.textContent).toBe('Undo');
      button?.click();
      vi.advanceTimersByTime(300);

      expect(undo).toHaveBeenCalledTimes(1);
      expect(acted).toHaveBeenCalledWith(action);
      expect(tapped).not.toHaveBeenCalled();
      expect(shown()).toEqual([]);
    });

    it('puts the action class next to toast-action, and its aria-label on the button', () => {
      setup();
      toasts.info('x', '', {
        actions: [{ label: '↺', class: 'toast-action-primary undo', ariaLabel: 'Undo' }]
      });
      render();

      const button = shown()[0].querySelector<HTMLElement>('button.toast-action');
      expect(button?.classList).toContain('toast-action-primary');
      expect(button?.classList).toContain('undo');
      expect(button?.getAttribute('aria-label')).toBe('Undo');
    });

    it('stays up after an action with dismiss false', () => {
      setup();
      toasts.info('x', '', { actions: [{ label: 'Details', dismiss: false }], disableTimeOut: true });
      render();

      shown()[0].querySelector<HTMLElement>('.toast-action')?.click();
      vi.advanceTimersByTime(1000);
      expect(shown()).toHaveLength(1);
    });
  });

  it('takes its toasts and the live region away when the app is destroyed', () => {
    setup();
    const toast = toasts.success('x');
    const hidden = vi.fn();
    toast.onHidden.subscribe(hidden);
    render();

    const warn = vi.spyOn(console, 'warn');

    TestBed.resetTestingModule();

    expect(hidden).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.overlay-container')).toBeNull();
    expect(warn, 'no NG0406 for a destroyed ApplicationRef').not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
