import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  OnDestroy,
  computed,
  inject,
  signal
} from '@angular/core';

import { ToastAction } from './toast-config';
import { ToastPackage } from './toast-package';

/**
 * The toast itself: title, message, action buttons, an optional × and progress bar, faded in and
 * out with CSS.
 *
 * It runs its own timer once the service calls {@link start}: up for `timeOut`, stopped while the
 * pointer rests on it, and up for `extendedTimeOut` more once the pointer leaves. While the tab is
 * in the background the timer and the bar stand still (`pauseWhenHidden`). Closing adds
 * `toast-out` and leaves the element in place for `easeTime`, so the fade can play; only then
 * does it ask the service to remove it.
 *
 * Esc closes it while the focus is in it (on the × or an action), and a finger swipes it away
 * sideways (`swipeToDismiss`).
 *
 * Extend it for a toast with its own template (see `ToastConfig.toastComponent`). The subclass
 * inherits the host bindings, the timer, {@link close} and {@link runAction}; it must keep an
 * attribute selector. `title`, `message` and `options` are signals.
 *
 * Signals and plain timers only, no NgZone, so it works zoneless and with zone.js alike.
 */
@Component({
  // An attribute, so the host is a `div`: the service creates the host element from the selector.
  selector: '[ng-toast]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'toastClasses()',
    '[class.toast-out]': 'closing()',
    '[class.toast-paused]': 'paused()',
    '[style.--toast-ease-time]': 'options().easeTime + "ms"',
    '[style.translate]': 'swipe() ? swipe() + "px 0" : null',
    '[class.toast-swiping]': 'swiping()',
    'animate.enter': 'toast-in',
    '(mouseenter)': 'stickAround()',
    '(mouseleave)': 'delayedClose()',
    '(click)': 'tap()',
    '(keydown.escape)': 'close()',
    '(pointerdown)': 'swipeStart($event)',
    '(pointermove)': 'swipeMove($event)',
    '(pointerup)': 'swipeEnd($event)',
    '(pointercancel)': 'swipeEnd($event)',
    '(document:visibilitychange)': 'visibilityChange()'
  },
  template: `
    @if (options().closeButton) {
      <button (click)="close()" type="button" class="toast-close-button" aria-label="Close">
        <span aria-hidden="true">&times;</span>
      </button>
    }
    @if (title()) {
      <!-- The live region is the message; a toast with only a title makes the title one. -->
      <div [class]="options().titleClass" [attr.role]="message() ? null : liveRole()">{{ title() }}</div>
    }
    @if (message()) {
      @if (options().enableHtml) {
        <div [attr.role]="liveRole()" [class]="options().messageClass" [innerHTML]="message()"></div>
      } @else {
        <div [attr.role]="liveRole()" [class]="options().messageClass">{{ message() }}@if (duplicates()) { [{{ duplicates() + 1 }}]}</div>
      }
    }
    @if (options().actions.length) {
      <div class="toast-actions">
        @for (action of options().actions; track action) {
          <button
            (click)="runAction(action, $event)"
            type="button"
            class="toast-action"
            [class]="action.class ?? ''"
            [attr.aria-label]="action.ariaLabel"
          >{{ action.label }}</button>
        }
      </div>
    }
    @if (options().progressBar) {
      <!-- A new run is a new object, so the bar is drawn anew and its animation starts over. -->
      @for (run of [progress()]; track run) {
        @if (run.ms) {
          <div
            class="toast-progress"
            [class.toast-progress-increasing]="options().progressAnimation === 'increasing'"
            [style.animation-duration.ms]="run.ms"
          ></div>
        }
      }
    }
  `
})
export class ToastComponent implements OnDestroy {
  /** This toast's data and the way back to the service. */
  protected readonly toastPackage = inject(ToastPackage);
  /** The options this toast was opened with, as updated since. */
  readonly options = this.toastPackage.config.asReadonly();
  /** `''` when there is none. */
  readonly title = this.toastPackage.title.asReadonly();
  /** `''` when there is none; HTML when `enableHtml` is set. */
  readonly message = this.toastPackage.message.asReadonly();
  /** How often it came again (`countDuplicates`); `0` for never. */
  protected readonly duplicates = this.toastPackage.duplicates.asReadonly();
  /**
   * How a screen reader announces the toast: an error interrupts (`alert`), anything else waits
   * for a pause (`status`).
   */
  protected readonly liveRole = computed(() =>
    this.toastPackage.toastType().split(/\s+/).includes('toast-error') ? 'alert' : 'status'
  );
  /** The type class next to the configured ones, e.g. `toast-success ng-toast`. */
  protected readonly toastClasses = computed(
    () => `${this.toastPackage.toastType()} ${this.options().toastClass}`
  );

  /** Backs {@link closing}. */
  private readonly closed = signal(false);
  /**
   * Set once {@link close} has started the fade. It is also what keeps the × from counting as a
   * tap: the button's click runs first, and the bubbling click on the host then finds it set.
   */
  readonly closing = this.closed.asReadonly();

  /** The timer is stopped for a background tab; the progress bar stops with it. */
  protected readonly paused = signal(false);
  /** The current run of the timer, for the progress bar; `ms` is `0` while none runs. */
  protected readonly progress = signal({ ms: 0 });
  /** How far a finger has dragged the toast sideways, in px; `0` while it is not swiped. */
  protected readonly swipe = signal(0);
  /** A finger is dragging the toast: no transition, so it follows the finger. */
  protected readonly swiping = signal(false);

  private readonly document = inject(DOCUMENT);
  /** The pending close: the timeout, the extended timeout or the end of the fade. */
  private timer?: ReturnType<typeof setTimeout>;
  /** When the running timer fires (`Date.now()` time); `0` while none runs. */
  private deadline = 0;
  /** What was left of the timer when the tab went to the background. */
  private remaining = 0;
  /** The pointer is on the toast, or on its stack: the timer waits for {@link resume}. */
  private held = false;
  /** Where the finger that may swipe the toast went down. */
  private swipeFrom?: { readonly pointerId: number; readonly x: number };
  /** The last touch swiped the toast, so the click that may follow it is no tap. */
  private swiped = false;

  /**
   * Starts the timer from `timeOut`, and the progress bar with it. The service calls it when the
   * toast comes on screen, after an update, and on a duplicate with `resetTimeoutOnDuplicate`.
   * While the pointer is on the toast the timer waits for it to leave.
   */
  start(): void {
    this.run(this.options().timeOut);
  }

  /** Fades the toast out and removes it. Does nothing a second time. */
  close(): void {
    if (this.closed()) {
      return;
    }
    clearTimeout(this.timer);
    this.closed.set(true);
    if (this.options().easeTime <= 0) {
      // No fade to wait for, as in tests (provideToastTesting): gone at once.
      this.toastPackage.remove();
      return;
    }
    this.timer = setTimeout(() => this.toastPackage.remove(), this.options().easeTime);
  }

  /**
   * An action button: runs its `onClick`, reports it on `onAction` and closes the toast unless the
   * action says otherwise. Pass the click so it does not reach the toast as a tap.
   */
  protected runAction(action: ToastAction, event?: Event): void {
    event?.stopPropagation();
    if (this.closed()) {
      return;
    }
    action.onClick?.();
    this.toastPackage.actions.next(action);
    if (action.dismiss ?? true) {
      this.close();
    }
  }

  /** A click on the toast: reported on `onTap`, and closes it when `tapToDismiss` is set. */
  protected tap(): void {
    if (this.closed() || this.swiped) {
      this.swiped = false;
      return;
    }
    this.toastPackage.tapped.next();
    if (this.options().tapToDismiss) {
      this.close();
    }
  }

  /**
   * Stops the timer, and the progress bar with it, until {@link resume}. The pointer on the toast
   * does this; for a stack (`stacked`) the service does it for every toast in it at once.
   */
  pause(): void {
    this.held = true;
    this.run(0);
  }

  /** Runs the timer again after {@link pause}: the toast goes after `extendedTimeOut`. */
  resume(): void {
    this.held = false;
    this.run(this.options().extendedTimeOut);
  }

  /** The pointer is on the toast: it stays until the pointer leaves. In a stack, the stack decides. */
  protected stickAround(): void {
    if (!this.toastPackage.stacked) {
      this.pause();
    }
  }

  /** The pointer left: the toast goes after `extendedTimeOut`. In a stack, the stack decides. */
  protected delayedClose(): void {
    if (!this.toastPackage.stacked) {
      this.resume();
    }
  }

  /** A finger, or a pen, went down on the toast: it may become a swipe. A mouse never does. */
  protected swipeStart(event: PointerEvent): void {
    this.swiped = false;
    if (event.pointerType !== 'mouse' && this.options().swipeToDismiss && !this.closed()) {
      this.swipeFrom = { pointerId: event.pointerId, x: event.clientX };
    }
  }

  /** The finger moved: past a few pixels of wobble it drags the toast along, timer held. */
  protected swipeMove(event: PointerEvent): void {
    if (this.swipeFrom?.pointerId !== event.pointerId) {
      return;
    }
    const distance = event.clientX - this.swipeFrom.x;
    if (!this.swiping()) {
      if (Math.abs(distance) < 10) {
        return;
      }
      this.swiping.set(true);
      try {
        // Keeps the moves coming when the finger leaves the toast; a nicety, not a need.
        (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
      } catch {
        // The browser no longer counts that pointer as active: swipe on without the capture.
      }
      this.pause();
    }
    this.swipe.set(distance);
  }

  /**
   * The finger let go: far enough (a third of the toast, at most 80px) and the toast flies out
   * that way and closes; not far enough, or the touch was cancelled, and it snaps back.
   */
  protected swipeEnd(event: PointerEvent): void {
    if (this.swipeFrom?.pointerId !== event.pointerId) {
      return;
    }
    this.swipeFrom = undefined;
    if (!this.swiping()) {
      return;
    }
    this.swiping.set(false);
    this.swiped = true;
    const width = (event.currentTarget as HTMLElement).offsetWidth;
    if (event.type === 'pointerup' && Math.abs(this.swipe()) > Math.min(80, width / 3)) {
      this.swipe.set(Math.sign(this.swipe()) * width);
      this.close();
    } else {
      this.swipe.set(0);
      this.resume();
    }
  }

  /** Stops the running timer when the tab goes to the background, and runs it on when it is back. */
  protected visibilityChange(): void {
    if (!this.options().pauseWhenHidden || !this.deadline || this.closed()) {
      return;
    }
    if (this.document.hidden && !this.paused()) {
      clearTimeout(this.timer);
      this.remaining = this.deadline - Date.now();
      this.paused.set(true);
    } else if (!this.document.hidden && this.paused()) {
      this.paused.set(false);
      this.arm(this.remaining);
    }
  }

  /** Clears whatever timer is pending, so a toast removed mid-fade leaves nothing to fire. */
  ngOnDestroy(): void {
    clearTimeout(this.timer);
  }

  /**
   * Starts a new run of the timer: the toast closes after `ms`, unless timeouts are off, `ms` is
   * `0` or the pointer is on it. `0` just stops it. Nothing changes once it is closing.
   */
  private run(ms: number): void {
    if (this.closed()) {
      return;
    }
    clearTimeout(this.timer);
    this.deadline = 0;
    this.paused.set(false);
    const on = ms > 0 && !this.held && !this.options().disableTimeOut;
    this.progress.set({ ms: on ? ms : 0 });
    if (on) {
      this.arm(ms);
      // Opened, or updated, in a background tab: wait for the tab.
      this.visibilityChange();
    }
  }

  /** Closes the toast after `ms`. */
  private arm(ms: number): void {
    this.deadline = Date.now() + ms;
    this.timer = setTimeout(() => this.close(), ms);
  }
}
