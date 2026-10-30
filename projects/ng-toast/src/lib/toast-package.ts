import { WritableSignal, signal } from '@angular/core';
import { Subject } from 'rxjs';

import { ToastAction, ToastConfig } from './toast-config';

/**
 * What one toast is drawn from, handed to its component through DI (`inject(ToastPackage)`).
 *
 * Content and options are signals: `ActiveToast.update` sets them while the toast is up, and the
 * component reads them in its template.
 *
 * The component never injects `ToastService`: it reaches the service only through {@link remove},
 * so a custom component that extends `ToastComponent` cannot form an import cycle with it.
 */
export class ToastPackage {
  /** Emits once per click on the toast; completes when the toast is gone. */
  readonly tapped = new Subject<void>();
  /** Emits the action whose button was clicked; completes when the toast is gone. */
  readonly actions = new Subject<ToastAction>();
  /** The global options with the call's overrides and every update applied. */
  readonly config: WritableSignal<ToastConfig>;
  /** `''` when there is none, so the template can test it plainly. */
  readonly message: WritableSignal<string>;
  /** `''` when there is none. */
  readonly title: WritableSignal<string>;
  /**
   * The type class: `toast-success`, `toast-error`, `toast-info`, `toast-warning`,
   * `toast-loading`, or whatever `show` was given.
   */
  readonly toastType: WritableSignal<string>;
  /** How often the toast came again while it was up (`countDuplicates`); `0` for never. */
  readonly duplicates = signal(0);

  /**
   * @param toastId What `ToastService.remove` and `clear` take; counts up from 1.
   * @param remove Takes the toast out of the DOM at once, without the fade.
   */
  constructor(
    readonly toastId: number,
    config: ToastConfig,
    message: string,
    title: string,
    toastType: string,
    readonly remove: () => void
  ) {
    this.config = signal(config);
    this.message = signal(message);
    this.title = signal(title);
    this.toastType = signal(toastType);
  }
}
