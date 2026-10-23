import { Subject } from 'rxjs';

import { ToastConfig } from './toast-config';

/**
 * What one toast is drawn from, handed to its component through DI (`inject(ToastPackage)`).
 *
 * The component never injects `ToastService`: it reaches the service only through {@link remove},
 * so a custom component that extends `ToastComponent` cannot form an import cycle with it.
 */
export class ToastPackage {
  /** Emits once per click on the toast; completes when the toast is gone. */
  readonly tapped = new Subject<void>();

  /**
   * @param toastId What `ToastService.remove` and `clear` take; counts up from 1.
   * @param config The global options with the call's overrides applied.
   * @param message `''` when the call passed none, so the template can test it plainly.
   * @param title `''` when the call passed none.
   * @param toastType The type class: `toast-success`, `toast-error`, `toast-info`,
   * `toast-warning`, or whatever `show` was given.
   * @param remove Takes the toast out of the DOM at once, without the fade.
   */
  constructor(
    readonly toastId: number,
    readonly config: ToastConfig,
    readonly message: string,
    readonly title: string,
    readonly toastType: string,
    readonly remove: () => void
  ) {}
}
