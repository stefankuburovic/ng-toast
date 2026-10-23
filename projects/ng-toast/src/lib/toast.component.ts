import { ChangeDetectionStrategy, Component, OnDestroy, inject, signal } from '@angular/core';

import { ToastPackage } from './toast-package';

/**
 * The toast itself: title, message and an optional ×, faded in and out with CSS.
 *
 * It runs its own timer: up for `timeOut`, paused while the pointer rests on it, and up for
 * `extendedTimeOut` more once the pointer leaves. Closing adds `toast-out` and leaves the element
 * in place for `easeTime`, so the fade can play; only then does it ask the service to remove it.
 *
 * Extend it for a toast with its own template (see `ToastConfig.toastComponent`). The subclass
 * inherits the host bindings, the timer and {@link close}; it must keep an attribute selector.
 *
 * Signals and plain timers only, no NgZone, so it works zoneless and with zone.js alike.
 */
@Component({
  // An attribute, so the host is a `div`: the service creates the host element from the selector.
  selector: '[ng-toast]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'toastClasses',
    '[class.toast-out]': 'closing()',
    '[style.--toast-ease-time]': 'options.easeTime + "ms"',
    'animate.enter': 'toast-in',
    '(mouseenter)': 'stickAround()',
    '(mouseleave)': 'delayedClose()',
    '(click)': 'tap()'
  },
  template: `
    @if (options.closeButton) {
      <button (click)="close()" type="button" class="toast-close-button" aria-label="Close">
        <span aria-hidden="true">&times;</span>
      </button>
    }
    @if (title) {
      <div [class]="options.titleClass" [attr.aria-label]="title">{{ title }}</div>
    }
    @if (message) {
      @if (options.enableHtml) {
        <div role="alert" [class]="options.messageClass" [innerHTML]="message"></div>
      } @else {
        <div role="alert" [class]="options.messageClass" [attr.aria-label]="message">{{ message }}</div>
      }
    }
  `
})
export class ToastComponent implements OnDestroy {
  /** This toast's data and the way back to the service. */
  protected readonly toastPackage = inject(ToastPackage);
  /** The options this toast was opened with. */
  readonly options = this.toastPackage.config;
  /** `''` when there is none. */
  readonly title = this.toastPackage.title;
  /** `''` when there is none; HTML when `enableHtml` is set. */
  readonly message = this.toastPackage.message;
  /** The type class next to the configured ones, e.g. `toast-success ng-toast`. */
  protected readonly toastClasses = `${this.toastPackage.toastType} ${this.options.toastClass}`;

  /**
   * Set once {@link close} has started the fade. It is also what keeps the × from counting as a
   * tap: the button's click runs first, and the bubbling click on the host then finds it set.
   */
  protected readonly closing = signal(false);

  /** The pending close: the timeout, the extended timeout or the end of the fade. */
  private timer?: ReturnType<typeof setTimeout>;

  constructor() {
    this.schedule(this.options.timeOut);
  }

  /** Fades the toast out and removes it. Does nothing a second time. */
  close(): void {
    if (this.closing()) {
      return;
    }
    clearTimeout(this.timer);
    this.closing.set(true);
    this.timer = setTimeout(() => this.toastPackage.remove(), this.options.easeTime);
  }

  /** A click on the toast: reported on `onTap`, and closes it when `tapToDismiss` is set. */
  protected tap(): void {
    if (this.closing()) {
      return;
    }
    this.toastPackage.tapped.next();
    if (this.options.tapToDismiss) {
      this.close();
    }
  }

  /** The pointer is on the toast: it stays until the pointer leaves. */
  protected stickAround(): void {
    if (!this.closing()) {
      clearTimeout(this.timer);
    }
  }

  /** The pointer left: the toast goes after `extendedTimeOut`. */
  protected delayedClose(): void {
    if (!this.closing()) {
      this.schedule(this.options.extendedTimeOut);
    }
  }

  /** Clears whatever timer is pending, so a toast removed mid-fade leaves nothing to fire. */
  ngOnDestroy(): void {
    clearTimeout(this.timer);
  }

  /** Closes the toast after `ms`, unless timeouts are off or `ms` is `0`. */
  private schedule(ms: number): void {
    clearTimeout(this.timer);
    if (!this.options.disableTimeOut && ms > 0) {
      this.timer = setTimeout(() => this.close(), ms);
    }
  }
}
