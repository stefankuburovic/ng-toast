import { EnvironmentProviders, InjectionToken, Type, makeEnvironmentProviders } from '@angular/core';

import type { ToastComponent } from './toast.component';

/**
 * Everything a toast can be told, globally through {@link provideToast} or per call through the
 * `override` argument of every `ToastService` method.
 */
export interface ToastConfig {
  /** Milliseconds a toast stays up on its own. `0` keeps it up, like {@link disableTimeOut}. */
  timeOut: number;
  /**
   * Milliseconds a toast stays up after the pointer leaves it. Hovering a toast stops its timer;
   * without this grace period it would vanish the moment the pointer moved off. `0` keeps it up.
   */
  extendedTimeOut: number;
  /** Keeps the toast up until it is closed, clicked or removed, hover or not. */
  disableTimeOut: boolean;
  /** Draws a × that closes the toast. */
  closeButton: boolean;
  /** A click anywhere on the toast closes it. The click is reported on `onTap` either way. */
  tapToDismiss: boolean;
  /**
   * Renders the message as HTML. It goes through `[innerHTML]`, so Angular's sanitizer strips
   * scripts and `style` attributes; a message that needs its inline styles needs its own
   * {@link toastComponent}.
   */
  enableHtml: boolean;
  /** Puts a new toast above the open ones instead of below them. */
  newestOnTop: boolean;
  /**
   * The container a toast goes into, one per class. The class is also what positions the
   * container: `toast-top-right`, `toast-bottom-right`, `toast-top-center`, … (see `toast.css`).
   */
  positionClass: string;
  /** Classes of the toast element itself, next to the type class (`toast-success`, …). */
  toastClass: string;
  /** Classes of the title element. */
  titleClass: string;
  /** Classes of the message element. */
  messageClass: string;
  /** Milliseconds of the fade-in and fade-out; `toast.css` reads it as `--toast-ease-time`. */
  easeTime: number;
  /**
   * The component a toast is drawn with. A custom one extends {@link ToastComponent} and keeps an
   * attribute selector: the host is created from the selector, and only an attribute selector
   * gives the `div` the stylesheet is written for. Left out, the service uses ToastComponent;
   * the default is not named here so that this file stays free of runtime imports.
   */
  toastComponent?: Type<ToastComponent>;
}

/** The defaults every option starts from. */
export const DEFAULT_TOAST_CONFIG: ToastConfig = {
  timeOut: 5000,
  extendedTimeOut: 1000,
  disableTimeOut: false,
  closeButton: false,
  tapToDismiss: true,
  enableHtml: false,
  newestOnTop: true,
  positionClass: 'toast-top-right',
  toastClass: 'ng-toast',
  titleClass: 'toast-title',
  messageClass: 'toast-message',
  easeTime: 300
};

/**
 * The app-wide overrides of {@link DEFAULT_TOAST_CONFIG}. Optional: without
 * {@link provideToast} the service runs on the defaults, so a test needs no setup to toast.
 */
export const TOAST_CONFIG = new InjectionToken<Partial<ToastConfig>>('TOAST_CONFIG');

/**
 * Sets app-wide toast options.
 *
 * @example
 * bootstrapApplication(AppComponent, { providers: [provideToast({ timeOut: 3000, closeButton: true })] });
 */
export function provideToast(config: Partial<ToastConfig> = {}): EnvironmentProviders {
  return makeEnvironmentProviders([{ provide: TOAST_CONFIG, useValue: config }]);
}
