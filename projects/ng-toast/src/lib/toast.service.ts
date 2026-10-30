import {
  ApplicationRef,
  ComponentRef,
  DOCUMENT,
  DestroyRef,
  Injectable,
  Injector,
  Signal,
  createComponent,
  inject
} from '@angular/core';
import { Observable, Subject } from 'rxjs';

import {
  DEFAULT_TOAST_CONFIG,
  TOAST_CONFIG,
  ToastAction,
  ToastConfig,
  ToastGlobalConfig,
  ToastUpdate
} from './toast-config';
import { ToastComponent } from './toast.component';
import { ToastPackage } from './toast-package';

/** An open toast, as `ToastService` hands it back. */
export interface ActiveToast<C extends ToastComponent = ToastComponent> {
  /** What {@link ToastService.remove} and {@link ToastService.clear} take. */
  readonly toastId: number;
  /** `''` when there is none. */
  readonly title: Signal<string>;
  /** `''` when there is none. */
  readonly message: Signal<string>;
  /**
   * The toast's component; `location.nativeElement` is the toast element. A toast waiting for
   * room (`maxOpened`) has its component already, but it is not in the page yet.
   */
  readonly componentRef: ComponentRef<C>;
  /** Emits on every click on the toast; completes when it is gone. */
  readonly onTap: Observable<void>;
  /** Emits the action whose button was clicked; completes when the toast is gone. */
  readonly onAction: Observable<ToastAction>;
  /**
   * Emits once and completes when the toast is gone, however it went: its timer, a click, the ×,
   * an action, `clear` or `remove`. A caller that has to tell these apart turns the timer off and
   * keeps its own.
   */
  readonly onHidden: Observable<void>;
  /**
   * Changes the toast in place and starts its timer over. Does nothing once it is gone.
   *
   * @example
   * const toast = this.toast.info('Uploading…', '', { disableTimeOut: true });
   * toast.update({ type: 'toast-success', message: 'Uploaded', disableTimeOut: false });
   */
  update(changes: ToastUpdate): void;
}

/** One step of {@link ToastService.promise}: a message, an update, or one made from the result. */
export type ToastStep<A> = string | ToastUpdate | ((result: A) => string | ToastUpdate);

/** What {@link ToastService.promise} shows while the promise runs and once it has settled. */
export interface ToastPromiseSteps<T> {
  /** Shown at once, as a `toast-loading` toast that stays up and ignores clicks. */
  loading: string | ToastUpdate;
  /** Replaces it when the promise resolves, as a `toast-success` toast. */
  success: ToastStep<T>;
  /** Replaces it when the promise rejects, as a `toast-error` toast. */
  error: ToastStep<unknown>;
}

/** What the service keeps per toast, next to what it hands out. */
interface OpenToast {
  /** What the caller got. */
  readonly active: ActiveToast;
  /** Fires `onHidden`. */
  readonly hidden: Subject<void>;
  /** Completes `onTap` and `onAction`, and holds what `update` changes. */
  readonly toastPackage: ToastPackage;
  /** Waiting for room under `maxOpened`, not in the page yet. */
  queued: boolean;
}

/**
 * Opens toasts and closes them.
 *
 * Each toast is its own component, created outside any view and attached to the application so
 * that change detection reaches it, inside one container per `positionClass`
 * (`div.toast-container.toast-top-right`, …). The containers sit in one
 * `div.overlay-container[aria-live=polite]` at the end of `body`, created with the first toast.
 *
 * Every toast first goes into line and comes on screen as soon as `maxOpened` leaves room, which
 * without a limit is at once. A toast that is closing does not count against the limit.
 *
 * When the app or the test bed is destroyed, so are its toasts and the container: a container
 * left behind would collect the next test's toasts next to the dead ones.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  /** The defaults with the app's overrides applied. */
  private readonly config: ToastGlobalConfig = {
    ...DEFAULT_TOAST_CONFIG,
    ...inject(TOAST_CONFIG, { optional: true })
  };
  /** Runs change detection over the toasts, which belong to no view. */
  private readonly appRef = inject(ApplicationRef);
  /** The parent of each toast's injector, so a custom toast component can inject app services. */
  private readonly injector = inject(Injector);
  /** Where the containers go. */
  private readonly document = inject(DOCUMENT);

  /** Open and waiting toasts by id, in the order they were opened. */
  private readonly toasts = new Map<number, OpenToast>();
  /** One container per `positionClass`. */
  private readonly panes = new Map<string, HTMLElement>();
  /** Holds the containers; created with the first toast. */
  private overlay?: HTMLElement;
  /** The last id handed out. */
  private lastId = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      [...this.toasts.values()].forEach(toast => this.drop(toast));
      this.overlay?.remove();
    });
  }

  /** Opens a green toast. */
  success(message?: string, title?: string, override?: Partial<ToastConfig>): ActiveToast {
    return this.show(message, title, override, 'toast-success');
  }

  /** Opens a red toast. */
  error(message?: string, title?: string, override?: Partial<ToastConfig>): ActiveToast {
    return this.show(message, title, override, 'toast-error');
  }

  /** Opens a blue toast. */
  info(message?: string, title?: string, override?: Partial<ToastConfig>): ActiveToast {
    return this.show(message, title, override, 'toast-info');
  }

  /** Opens an orange toast. */
  warning(message?: string, title?: string, override?: Partial<ToastConfig>): ActiveToast {
    return this.show(message, title, override, 'toast-warning');
  }

  /**
   * Opens a toast of any type.
   *
   * With `preventDuplicates`, a toast like one that is up does not open; the one that is up comes
   * back instead.
   *
   * @param type The type class on the toast; `''` for none.
   * @typeParam C The `toastComponent` in `override`, so `componentRef` comes back typed.
   */
  show<C extends ToastComponent = ToastComponent>(
    message?: string,
    title?: string,
    override: Partial<ToastConfig> = {},
    type = ''
  ): ActiveToast<C> {
    const config = { ...this.config, ...override };
    if (config.preventDuplicates) {
      const duplicate = this.duplicateOf(type, title ?? '', message ?? '');
      if (duplicate) {
        if (config.countDuplicates) {
          duplicate.toastPackage.duplicates.update(count => count + 1);
        }
        if (config.resetTimeoutOnDuplicate && !duplicate.queued) {
          duplicate.active.componentRef.instance.start();
        }
        return duplicate.active as ActiveToast<C>;
      }
    }

    const toastId = ++this.lastId;
    const toastPackage = new ToastPackage(toastId, config, message ?? '', title ?? '', type, () =>
      this.remove(toastId)
    );
    const componentRef = createComponent(config.toastComponent ?? ToastComponent, {
      environmentInjector: this.appRef.injector,
      elementInjector: Injector.create({
        providers: [{ provide: ToastPackage, useValue: toastPackage }],
        parent: this.injector
      })
    }) as ComponentRef<C>;
    this.appRef.attachView(componentRef.hostView);

    const hidden = new Subject<void>();
    const active: ActiveToast<C> = {
      toastId,
      title: toastPackage.title.asReadonly(),
      message: toastPackage.message.asReadonly(),
      componentRef,
      onTap: toastPackage.tapped.asObservable(),
      onAction: toastPackage.actions.asObservable(),
      onHidden: hidden.asObservable(),
      update: changes => this.update(toastId, changes)
    };
    this.toasts.set(toastId, { active, hidden, toastPackage, queued: true });

    const { maxOpened, autoDismiss } = this.config;
    if (maxOpened && autoDismiss) {
      const open = this.onScreen();
      open
        .slice(0, Math.max(0, open.length - maxOpened + 1))
        .forEach(toast => toast.active.componentRef.instance.close());
    }
    this.flush();
    return active;
  }

  /**
   * Shows a toast for a promise: `loading` while it runs, then `success` or `error`, made from
   * its result if they are functions. The settled toast takes its timer and clicks from the
   * options again. For an Observable, pass `firstValueFrom(observable)`.
   *
   * @example
   * this.toast.promise(this.api.save(customer), {
   *   loading: 'Saving…',
   *   success: saved => `Saved ${saved.name}`,
   *   error: 'Could not save'
   * });
   */
  promise<T>(
    promise: PromiseLike<T>,
    steps: ToastPromiseSteps<T>,
    override: Partial<ToastConfig> = {}
  ): ActiveToast {
    const { message, title, type, ...options } =
      typeof steps.loading === 'string' ? { message: steps.loading } : steps.loading;
    const toast = this.show(
      message,
      title,
      { ...override, disableTimeOut: true, tapToDismiss: false, ...options },
      type ?? 'toast-loading'
    );
    const { disableTimeOut, tapToDismiss } = { ...this.config, ...override };
    const settle = <A>(step: ToastStep<A>, result: A, type: string): void => {
      const content = typeof step === 'function' ? step(result) : step;
      toast.update({
        disableTimeOut,
        tapToDismiss,
        type,
        ...(typeof content === 'string' ? { message: content } : content)
      });
    };
    promise.then(
      value => settle(steps.success, value, 'toast-success'),
      error => settle(steps.error, error, 'toast-error')
    );
    return toast;
  }

  /**
   * Takes a toast out at once, without the fade, and fires its `onHidden`. A toast that waited
   * for room may come up in its place.
   *
   * @returns `false` when no such toast is open (already gone, or never was).
   */
  remove(toastId: number): boolean {
    const toast = this.toasts.get(toastId);
    if (!toast) {
      return false;
    }
    this.drop(toast);
    this.flush();
    return true;
  }

  /**
   * Fades out one toast, or every open one when no id is given. Toasts still waiting for room go
   * at once, without coming up.
   */
  clear(toastId?: number): void {
    const toasts = [...this.toasts.values()].filter(
      toast => toastId === undefined || toast.active.toastId === toastId
    );
    // The waiting ones first: closing the open ones makes room they would otherwise take.
    const waiting = toasts.filter(toast => toast.queued);
    waiting.forEach(toast => this.drop(toast));
    toasts
      .filter(toast => !waiting.includes(toast))
      .forEach(toast => toast.active.componentRef.instance.close());
  }

  /** Applies an `ActiveToast.update`. */
  private update(toastId: number, changes: ToastUpdate): void {
    const toast = this.toasts.get(toastId);
    if (!toast) {
      return;
    }
    const { message, title, type, ...options } = changes;
    const { toastPackage } = toast;
    if (message !== undefined) {
      toastPackage.message.set(message);
    }
    if (title !== undefined) {
      toastPackage.title.set(title);
    }
    if (type !== undefined) {
      toastPackage.toastType.set(type);
    }
    toastPackage.config.update(config => ({ ...config, ...options }));
    if (!toast.queued) {
      toast.active.componentRef.instance.start();
    }
  }

  /** An open or waiting toast that is not closing and shows the same, if there is one. */
  private duplicateOf(type: string, title: string, message: string): OpenToast | undefined {
    return [...this.toasts.values()].find(
      ({ toastPackage, active }) =>
        toastPackage.toastType() === type &&
        toastPackage.title() === title &&
        toastPackage.message() === message &&
        !active.componentRef.instance.closing()
    );
  }

  /** The toasts on screen that are not closing, oldest first. */
  private onScreen(): OpenToast[] {
    return [...this.toasts.values()].filter(
      toast => !toast.queued && !toast.active.componentRef.instance.closing()
    );
  }

  /** Brings waiting toasts on screen, oldest first, as far as `maxOpened` leaves room. */
  private flush(): void {
    const { maxOpened } = this.config;
    let room = maxOpened ? maxOpened - this.onScreen().length : Infinity;
    for (const toast of this.toasts.values()) {
      if (room <= 0) {
        break;
      }
      if (toast.queued) {
        this.open(toast);
        room--;
      }
    }
  }

  /** Puts a waiting toast into its container and starts its timer. */
  private open(toast: OpenToast): void {
    toast.queued = false;
    const { positionClass, newestOnTop } = toast.toastPackage.config();
    const pane = this.pane(positionClass);
    pane.insertBefore(
      toast.active.componentRef.location.nativeElement,
      newestOnTop ? pane.firstChild : null
    );
    toast.active.componentRef.instance.start();
  }

  /** Takes a toast out at once and fires its `onHidden`, without letting waiting ones up. */
  private drop(toast: OpenToast): void {
    this.toasts.delete(toast.active.toastId);
    const { componentRef } = toast.active;
    this.appRef.detachView(componentRef.hostView);
    componentRef.destroy();
    componentRef.location.nativeElement.remove();
    toast.toastPackage.tapped.complete();
    toast.toastPackage.actions.complete();
    toast.hidden.next();
    toast.hidden.complete();
  }

  /** The container for a position class, created on first use. */
  private pane(positionClass: string): HTMLElement {
    let pane = this.panes.get(positionClass);
    if (!pane) {
      pane = this.document.createElement('div');
      pane.classList.add('toast-container', ...positionClass.split(/\s+/).filter(Boolean));
      this.overlayElement().appendChild(pane);
      this.panes.set(positionClass, pane);
    }
    return pane;
  }

  /** The element that holds the containers, created on first use. */
  private overlayElement(): HTMLElement {
    if (!this.overlay) {
      this.overlay = this.document.createElement('div');
      this.overlay.classList.add('overlay-container');
      this.overlay.setAttribute('aria-live', 'polite');
      this.document.body.appendChild(this.overlay);
    }
    return this.overlay;
  }
}
