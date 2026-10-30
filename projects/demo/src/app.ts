import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  computed,
  effect,
  inject,
  signal
} from '@angular/core';
import { ToastConfig, ToastService } from '@stefankuburovic/ng-toast';

import { STACKED } from './stacked';

/** One of the corners or edges a toast can go to. */
interface Position {
  readonly value: string;
  readonly label: string;
}

const POSITIONS: readonly Position[] = [
  { value: 'toast-top-right', label: 'Top right' },
  { value: 'toast-top-center', label: 'Top center' },
  { value: 'toast-top-left', label: 'Top left' },
  { value: 'toast-bottom-right', label: 'Bottom right' },
  { value: 'toast-bottom-center', label: 'Bottom center' },
  { value: 'toast-bottom-left', label: 'Bottom left' }
];

/** What `success`, `error`, … are called with from the type buttons. */
const SAMPLES = {
  success: ['Changes saved', 'Profile'],
  error: ['The file is larger than 10 MB', 'Upload failed'],
  info: ['A new version is available', ''],
  warning: ['Your session ends in 2 minutes', '']
} as const;

type ToastKind = keyof typeof SAMPLES;

/**
 * The playground: buttons that fire toasts with the options set in the panel, and the code each
 * one ran, so a visitor can copy what they just saw.
 */
@Component({
  selector: 'demo-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html'
})
export class App {
  private readonly toast = inject(ToastService);
  private readonly document = inject(DOCUMENT);

  protected readonly positions = POSITIONS;
  protected readonly kinds = Object.keys(SAMPLES) as ToastKind[];

  protected readonly position = signal('toast-top-right');
  protected readonly progressBar = signal(true);
  protected readonly closeButton = signal(true);
  protected readonly timeOut = signal(5000);
  protected readonly material = signal(false);
  protected readonly stacked = STACKED;
  protected readonly dark = signal(this.startsDark());

  /** The code of the last thing fired, as it would read in an app. */
  protected readonly code = signal(
    `// Pick something on the left; the call it makes shows up here.\nthis.toast.success('Changes saved', 'Profile');`
  );
  protected readonly copied = signal(false);

  /** The per-call options the panel sets, without the ones left at their default. */
  private readonly override = computed(() => {
    const override: Partial<ToastConfig> = {};
    if (this.position() !== 'toast-top-right') override.positionClass = this.position();
    if (this.progressBar()) override.progressBar = true;
    if (this.closeButton()) override.closeButton = true;
    if (this.timeOut() !== 5000) override.timeOut = this.timeOut();
    return override;
  });

  constructor() {
    effect(() => {
      const link = this.document.getElementById('material-theme') as HTMLLinkElement | null;
      if (link) link.disabled = !this.material();
    });
    effect(() => {
      this.document.documentElement.setAttribute('data-theme', this.dark() ? 'dark' : 'light');
    });
  }

  protected fire(kind: ToastKind): void {
    const [message, title] = SAMPLES[kind];
    this.toast[kind](message, title, this.override());
    this.show(`this.toast.${kind}(${this.args(message, title)});`);
  }

  protected promise(succeeds: boolean): void {
    const save = new Promise<{ name: string }>((resolve, reject) =>
      setTimeout(() => (succeeds ? resolve({ name: 'Ana Petrović' }) : reject()), 2000)
    );
    this.toast.promise(
      save,
      {
        loading: 'Saving the customer…',
        success: customer => `Saved ${customer.name}`,
        error: { title: 'Not saved', message: 'The server did not answer' }
      },
      this.override()
    );
    this.show(
      `this.toast.promise(this.api.save(customer), {
  loading: 'Saving the customer…',
  success: customer => \`Saved \${customer.name}\`,
  error: { title: 'Not saved', message: 'The server did not answer' }
}${this.options()});`
    );
  }

  protected undo(): void {
    this.toast.info('Invoice #1042 deleted', '', {
      ...this.override(),
      actions: [
        {
          label: 'Undo',
          class: 'toast-action-primary',
          onClick: () => this.toast.success('Invoice #1042 restored', '', this.override())
        }
      ]
    });
    this.show(
      `this.toast.info('Invoice #1042 deleted', '', {${this.options(true)}
  actions: [{
    label: 'Undo',
    class: 'toast-action-primary',
    onClick: () => this.restore(invoice)
  }]
});`
    );
  }

  protected upload(): void {
    const toast = this.toast.info('Uploading report.pdf… 0 %', '', {
      ...this.override(),
      progressBar: false,
      disableTimeOut: true,
      tapToDismiss: false
    });
    let percent = 0;
    const timer = setInterval(() => {
      percent += 10;
      if (percent < 100) {
        toast.update({ message: `Uploading report.pdf… ${percent} %` });
      } else {
        clearInterval(timer);
        toast.update({
          type: 'toast-success',
          message: 'report.pdf uploaded',
          progressBar: this.progressBar(),
          disableTimeOut: false,
          tapToDismiss: true
        });
      }
    }, 250);
    toast.onHidden.subscribe(() => clearInterval(timer));
    this.show(
      `const toast = this.toast.info('Uploading report.pdf… 0 %', '', { disableTimeOut: true });

upload.progress$.subscribe(percent =>
  toast.update({ message: \`Uploading report.pdf… \${percent} %\` })
);
upload.done$.subscribe(() =>
  toast.update({ type: 'toast-success', message: 'report.pdf uploaded', disableTimeOut: false })
);`
    );
  }

  protected queue(): void {
    for (let i = 1; i <= 8; i++) {
      this.toast.info(`Notification ${i} of 8`, '', { ...this.override(), timeOut: 2500 });
    }
    this.show(
      `// provideToast({ maxOpened: 4 }): four on screen, the rest wait their turn
for (let i = 1; i <= 8; i++) {
  this.toast.info(\`Notification \${i} of 8\`, '', { timeOut: 2500 });
}`
    );
  }

  protected duplicates(): void {
    for (let i = 0; i < 3; i++) {
      this.toast.error('You are offline', '', this.override());
    }
    this.show(
      `// provideToast({ preventDuplicates: true, countDuplicates: true })
this.toast.error('You are offline');
this.toast.error('You are offline'); // the same toast, now "[2]"
this.toast.error('You are offline'); // "[3]"`
    );
  }

  /** `stacked` is set once, in provideToast, so switching it loads the page again. */
  protected layout(stacked: boolean): void {
    if (stacked === this.stacked) return;
    const url = new URL(location.href);
    if (stacked) url.searchParams.set('layout', 'stacked');
    else url.searchParams.delete('layout');
    location.assign(url);
  }

  protected clear(): void {
    this.toast.clear();
    this.show(`this.toast.clear();`);
  }

  protected copyCode(): void {
    navigator.clipboard?.writeText(this.code()).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1600);
    });
  }

  protected copyText(text: string, button: HTMLButtonElement): void {
    navigator.clipboard?.writeText(text).then(() => {
      button.textContent = 'Copied';
      setTimeout(() => (button.textContent = 'Copy'), 1600);
    });
  }

  protected numberOf(event: Event): number {
    return Number((event.target as HTMLInputElement).value);
  }

  protected valueOf(event: Event): string {
    return (event.target as HTMLSelectElement).value;
  }

  /** Remembers the visitor's choice, as the portfolio page does. */
  protected toggleDark(): void {
    this.dark.update(dark => !dark);
    try {
      localStorage.setItem('theme', this.dark() ? 'dark' : 'light');
    } catch {
      // Private mode: the choice lasts until the page is left.
    }
  }

  private show(code: string): void {
    this.code.set(code);
  }

  /** `'message', 'title', { … }`, leaving out what is empty. */
  private args(message: string, title: string): string {
    const options = this.options();
    if (!title && !options) return `'${message}'`;
    return `'${message}', '${title}'${options}`;
  }

  /**
   * The panel's options as code: `, { … }` after other arguments, or the bare lines inside an
   * object literal that has more in it.
   */
  private options(inside = false): string {
    const entries = Object.entries(this.override()).map(
      ([key, value]) => `${key}: ${typeof value === 'string' ? `'${value}'` : value}`
    );
    if (!entries.length) return '';
    return inside ? `\n  ${entries.join(',\n  ')},` : `, { ${entries.join(', ')} }`;
  }

  private startsDark(): boolean {
    const set = this.document.documentElement.getAttribute('data-theme');
    return set ? set === 'dark' : !!this.document.defaultView?.matchMedia('(prefers-color-scheme: dark)').matches;
  }
}
