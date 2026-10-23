import {
  ApplicationRef,
  ComponentRef,
  DOCUMENT,
  DestroyRef,
  Injectable,
  Injector,
  createComponent,
  inject
} from '@angular/core';
import { Observable, Subject } from 'rxjs';

import { DEFAULT_TOAST_CONFIG, TOAST_CONFIG, ToastConfig } from './toast-config';
import { ToastComponent } from './toast.component';
import { ToastPackage } from './toast-package';

/** An open toast, as `ToastService` hands it back. */
export interface ActiveToast<C extends ToastComponent = ToastComponent> {
  /** What {@link ToastService.remove} and {@link ToastService.clear} take. */
  readonly toastId: number;
  /** `''` when there is none. */
  readonly title: string;
  /** `''` when there is none. */
  readonly message: string;
  /** The toast's component; `location.nativeElement` is the toast element. */
  readonly componentRef: ComponentRef<C>;
  /** Emits on every click on the toast; completes when it is gone. */
  readonly onTap: Observable<void>;
  /**
   * Emits once and completes when the toast is gone, however it went: its timer, a click, the ×,
   * `clear` or `remove`. A caller that has to tell these apart turns the timer off and keeps its
   * own.
   */
  readonly onHidden: Observable<void>;
}

/** What the service keeps per open toast, next to what it hands out. */
interface OpenToast {
  /** What the caller got. */
  readonly active: ActiveToast;
  /** Fires `onHidden`. */
  readonly hidden: Subject<void>;
  /** Completes `onTap`. */
  readonly toastPackage: ToastPackage;
}

/**
 * Opens toasts and closes them.
 *
 * Each toast is its own component, created outside any view and attached to the application so
 * that change detection reaches it, inside one container per `positionClass`
 * (`div.toast-container.toast-top-right`, …). The containers sit in one
 * `div.overlay-container[aria-live=polite]` at the end of `body`, created with the first toast.
 *
 * When the app or the test bed is destroyed, so are its toasts and the container: a container
 * left behind would collect the next test's toasts next to the dead ones.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  /** The defaults with the app's overrides applied. */
  private readonly config: ToastConfig = { ...DEFAULT_TOAST_CONFIG, ...inject(TOAST_CONFIG, { optional: true }) };
  /** Runs change detection over the toasts, which belong to no view. */
  private readonly appRef = inject(ApplicationRef);
  /** The parent of each toast's injector, so a custom toast component can inject app services. */
  private readonly injector = inject(Injector);
  /** Where the containers go. */
  private readonly document = inject(DOCUMENT);

  /** Open toasts by id, in the order they were opened. */
  private readonly toasts = new Map<number, OpenToast>();
  /** One container per `positionClass`. */
  private readonly panes = new Map<string, HTMLElement>();
  /** Holds the containers; created with the first toast. */
  private overlay?: HTMLElement;
  /** The last id handed out. */
  private lastId = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      [...this.toasts.keys()].forEach(id => this.remove(id));
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
    const toastId = ++this.lastId;
    const toastPackage = new ToastPackage(toastId, config, message ?? '', title ?? '', type, () => this.remove(toastId));
    const componentRef = createComponent(config.toastComponent ?? ToastComponent, {
      environmentInjector: this.appRef.injector,
      elementInjector: Injector.create({ providers: [{ provide: ToastPackage, useValue: toastPackage }], parent: this.injector })
    }) as ComponentRef<C>;
    this.appRef.attachView(componentRef.hostView);

    const pane = this.pane(config.positionClass);
    const element: HTMLElement = componentRef.location.nativeElement;
    pane.insertBefore(element, config.newestOnTop ? pane.firstChild : null);

    const hidden = new Subject<void>();
    const active: ActiveToast<C> = {
      toastId,
      title: toastPackage.title,
      message: toastPackage.message,
      componentRef,
      onTap: toastPackage.tapped.asObservable(),
      onHidden: hidden.asObservable()
    };
    this.toasts.set(toastId, { active, hidden, toastPackage });
    return active;
  }

  /**
   * Takes a toast out at once, without the fade, and fires its `onHidden`.
   *
   * @returns `false` when no such toast is open (already gone, or never was).
   */
  remove(toastId: number): boolean {
    const toast = this.toasts.get(toastId);
    if (!toast) {
      return false;
    }
    this.toasts.delete(toastId);
    const { componentRef } = toast.active;
    this.appRef.detachView(componentRef.hostView);
    componentRef.destroy();
    componentRef.location.nativeElement.remove();
    toast.toastPackage.tapped.complete();
    toast.hidden.next();
    toast.hidden.complete();
    return true;
  }

  /** Fades out one toast, or every open one when no id is given. */
  clear(toastId?: number): void {
    this.toasts.forEach((toast, id) => {
      if (toastId === undefined || id === toastId) {
        toast.active.componentRef.instance.close();
      }
    });
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
