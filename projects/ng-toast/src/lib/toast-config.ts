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
 * How a toast leaves the screen, as `toast.css` draws it:
 *
 * - `fade`: fades out where it is (the default).
 * - `fade-up`, `fade-down`, `fade-left`, `fade-right`: fades out while drifting a little that way.
 * - `slide-up`, `slide-down`, `slide-left`, `slide-right`: slides off that way, fading at the end.
 * - `zoom`: shrinks as it fades.
 * - `flip`: folds away about its horizontal axis.
 * - `crash`: jolts, then falls off the bottom of the screen, tumbling.
 * - `destroy`: shakes, flares up and bursts into a blur.
 *
 * Any other name is yours: `toast.css` leaves it to a rule of your own, e.g.
 * `.toast-out[data-toast-hide='wobble'] { animation-name: my-wobble }`. Each plays for
 * `easeTime`; `crash` and `destroy` read best at 600 or so. With reduced motion asked for, every
 * one is a plain fade.
 */
export type ToastHideAnimation =
  | 'fade'
  | 'fade-up'
  | 'fade-down'
  | 'fade-left'
  | 'fade-right'
  | 'slide-up'
  | 'slide-down'
  | 'slide-left'
  | 'slide-right'
  | 'zoom'
  | 'flip'
  | 'crash'
  | 'destroy'
  // A name of your own; `& {}` keeps an editor suggesting the ones above.
  | (string & {});

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
  /**
   * A button that closes the toast: `true` or `'icon'` draws a × in the corner, `'text'` a button
   * with {@link closeLabel} next to the actions. `false` for none.
   */
  closeButton: boolean | 'icon' | 'text';
  /** The text of a `'text'` close button, and what a screen reader reads for the ×. */
  closeLabel: string;
  /** Draws a bar along the bottom that runs down with the timer. */
  progressBar: boolean;
  /** `decreasing` empties the bar, `increasing` fills it. */
  progressAnimation: 'decreasing' | 'increasing';
  /** Buttons below the message, e.g. an Undo. A click on one is no tap. */
  actions: readonly ToastAction[];
  /** A click anywhere on the toast closes it. The click is reported on `onTap` either way. */
  tapToDismiss: boolean;
  /** A finger (or pen) swiping the toast sideways closes it. A mouse does not swipe. */
  swipeToDismiss: boolean;
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
   * How the toast leaves: a fade, a slide or drift in a direction, a zoom, a flip, a crash or a
   * burst; see {@link ToastHideAnimation}. A toast swiped away just fades, where the finger left it.
   */
  hideAnimation: ToastHideAnimation;
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
  /**
   * A "Clear all" button by each container, below the toasts at the top of the screen and above
   * them at the bottom, that closes every toast and drops the waiting ones (`clear()`). `true`
   * shows it from two toasts in the container on, a number from that many on; `false` for none.
   * In a stack it shows while the deck is spread.
   */
  clearAllButton: boolean | number;
  /** The text of the {@link clearAllButton}. */
  clearAllLabel: string;
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
  closeLabel: 'Close',
  progressBar: false,
  progressAnimation: 'decreasing',
  actions: [],
  tapToDismiss: true,
  swipeToDismiss: true,
  enableHtml: false,
  newestOnTop: true,
  positionClass: 'toast-top-right',
  toastClass: 'ng-toast',
  titleClass: 'toast-title',
  messageClass: 'toast-message',
  easeTime: 300,
  hideAnimation: 'fade',
  maxOpened: 0,
  autoDismiss: false,
  preventDuplicates: false,
  countDuplicates: false,
  resetTimeoutOnDuplicate: false,
  stacked: false,
  clearAllButton: false,
  clearAllLabel: 'Clear all'
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

/**
 * {@link provideToast} for tests: no fade (`easeTime: 0`), so a toast that closes is gone at once,
 * without waiting out a timer. Takes the same options.
 *
 * @example
 * TestBed.configureTestingModule({ providers: [provideToastTesting()] });
 */
export function provideToastTesting(config: Partial<ToastGlobalConfig> = {}): EnvironmentProviders {
  return provideToast({ easeTime: 0, ...config });
}
