import { EnvironmentProviders, InjectionToken, Type, makeEnvironmentProviders } from '@angular/core';

import type { ToastComponent } from './toast.component';

/** A button in the toast, below the message. */
export interface ToastAction {
  /** The button's text. */
  label: string;
  /**
   * Classes next to `toast-action`; `toast-action-primary` is the emphasized look `toast.css`
   * has, anything else is for your own styles.
   */
  class?: string;
  /** What a screen reader reads instead of the label, e.g. for an icon-only label. */
  ariaLabel?: string;
  /** Runs on the click, before the toast closes. The click is also reported on `onAction`. */
  onClick?: () => void;
  /** Closes the toast after the click. Default `true`. */
  dismiss?: boolean;
}

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
  /**
   * Stops the timer while the page is in a background tab, so a toast is not gone before anyone
   * could see it. It runs on from where it stopped when the tab comes back.
   */
  pauseWhenHidden: boolean;
  /** Draws a × that closes the toast. */
  closeButton: boolean;
  /** Draws a bar along the bottom that runs down with the timer. */
  progressBar: boolean;
  /** `decreasing` empties the bar, `increasing` fills it. */
  progressAnimation: 'decreasing' | 'increasing';
  /** Buttons below the message, e.g. an Undo. A click on one is no tap. */
  actions: readonly ToastAction[];
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

/**
 * The options that are about all toasts together rather than one, so only {@link provideToast}
 * takes them.
 */
export interface ToastGlobalConfig extends ToastConfig {
  /**
   * How many toasts are on screen at once; `0` for no limit. The ones over it wait in line and
   * come up as the open ones go, unless {@link autoDismiss} makes room for them.
   */
  maxOpened: number;
  /** At {@link maxOpened}, a new toast closes the oldest one instead of waiting. */
  autoDismiss: boolean;
  /**
   * A toast with the type, title and message of one that is open or waiting does not open; the
   * call hands back the one that is there.
   */
  preventDuplicates: boolean;
  /** With {@link preventDuplicates}, shows how often the toast came, e.g. `Offline [3]`. */
  countDuplicates: boolean;
  /** With {@link preventDuplicates}, starts the timer of the toast that is there over. */
  resetTimeoutOnDuplicate: boolean;
  /**
   * Lays the toasts of each container on top of each other, newest in front and the older ones
   * peeking out behind it, like a deck. The pointer or focus on the deck spreads it into a list and
   * holds every timer in it. In a stack the newest is always in front, whatever `newestOnTop` says.
   */
  stacked: boolean;
}

/** What `ActiveToast.update` changes: the content, the type and the options that can change. */
export interface ToastUpdate
  extends Partial<Omit<ToastConfig, 'toastComponent' | 'positionClass' | 'newestOnTop'>> {
  message?: string;
  title?: string;
  /** The type class, e.g. `toast-success`. */
  type?: string;
}

/** The defaults every option starts from. */
export const DEFAULT_TOAST_CONFIG: ToastGlobalConfig = {
  timeOut: 5000,
  extendedTimeOut: 1000,
  disableTimeOut: false,
  pauseWhenHidden: true,
  closeButton: false,
  progressBar: false,
  progressAnimation: 'decreasing',
  actions: [],
  tapToDismiss: true,
  enableHtml: false,
  newestOnTop: true,
  positionClass: 'toast-top-right',
  toastClass: 'ng-toast',
  titleClass: 'toast-title',
  messageClass: 'toast-message',
  easeTime: 300,
  maxOpened: 0,
  autoDismiss: false,
  preventDuplicates: false,
  countDuplicates: false,
  resetTimeoutOnDuplicate: false,
  stacked: false
};

/**
 * The app-wide overrides of {@link DEFAULT_TOAST_CONFIG}. Optional: without
 * {@link provideToast} the service runs on the defaults, so a test needs no setup to toast.
 */
export const TOAST_CONFIG = new InjectionToken<Partial<ToastGlobalConfig>>('TOAST_CONFIG');

/**
 * Sets app-wide toast options.
 *
 * @example
 * bootstrapApplication(AppComponent, { providers: [provideToast({ timeOut: 3000, closeButton: true })] });
 */
export function provideToast(config: Partial<ToastGlobalConfig> = {}): EnvironmentProviders {
  return makeEnvironmentProviders([{ provide: TOAST_CONFIG, useValue: config }]);
}
