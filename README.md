# @stefankuburovic/ng-toast

Small toast notifications for Angular. Signals and plain timers, works zoneless, no dependencies
beyond `@angular/core` (≥ 20.2) and `rxjs`. About 3.5 kB of JavaScript and 3 kB of CSS, minified
and gzipped.

The API follows [ngx-toastr](https://github.com/scttcper/ngx-toastr) (archived), so moving over
is mostly a rename. The stylesheet is taken from it.

## Install

```sh
npm install @stefankuburovic/ng-toast
```

Add the stylesheet, e.g. in `angular.json` / `project.json`:

```json
"styles": ["node_modules/@stefankuburovic/ng-toast/toast.css", "src/styles.scss"]
```

## Use

```ts
import { ToastService } from '@stefankuburovic/ng-toast';

export class SaveButton {
  private readonly toast = inject(ToastService);

  save(): void {
    this.toast.success('Saved', 'Customer');
  }
}
```

No provider is needed. For app-wide options:

```ts
bootstrapApplication(App, { providers: [provideToast({ timeOut: 3000, closeButton: true })] });
```

### Promises

`promise` shows a spinner while the promise runs, then turns the same toast into a success or an
error. Each step is a message, an update (`{ message, title, … }`), or a function of the result.

```ts
this.toast.promise(this.api.save(customer), {
  loading: 'Saving…',
  success: saved => `Saved ${saved.name}`,
  error: (e: HttpErrorResponse) => ({ title: 'Not saved', message: e.message })
});
```

For an Observable, pass `firstValueFrom(observable)`.

### Updating a toast

```ts
const toast = this.toast.info('Uploading 0 %', '', { disableTimeOut: true, progressBar: false });
// …
toast.update({ message: 'Uploading 60 %' });
// …
toast.update({ type: 'toast-success', message: 'Uploaded', disableTimeOut: false });
```

An update starts the timer over. It does nothing once the toast is gone.

### Actions

```ts
this.toast.info('Customer deleted', '', {
  actions: [{ label: 'Undo', onClick: () => this.restore(customer) }]
});
```

A click on an action runs `onClick`, emits on `onAction` and closes the toast, unless the action
has `dismiss: false`. It is never a tap.

### `ToastService`

| Method | |
| --- | --- |
| `success / error / info / warning(message?, title?, override?)` | Opens a toast, returns an `ActiveToast`. |
| `show(message?, title?, override?, type?)` | Same with any type class. |
| `promise(promise, { loading, success, error }, override?)` | A loading toast that turns into success or error. |
| `clear(toastId?)` | Fades out one toast, or all; waiting ones go at once. |
| `remove(toastId)` | Takes a toast out at once. `false` when it is not open. |

`ActiveToast` has `toastId`, `title()` and `message()` (signals), `componentRef`, `update(changes)`,
`onTap` (every click), `onAction` (every action) and `onHidden` (once, however the toast went).

### Options

Every option can be set app-wide with `provideToast` and per call through `override`.

| Option | Default | |
| --- | --- | --- |
| `timeOut` | `5000` | ms until it goes; `0` keeps it |
| `extendedTimeOut` | `1000` | ms after the pointer leaves it (hover pauses it) |
| `disableTimeOut` | `false` | keep it until closed |
| `pauseWhenHidden` | `true` | the timer stands still while the tab is in the background |
| `closeButton` | `false` | draw a × |
| `progressBar` | `false` | a bar that runs down with the timer |
| `progressAnimation` | `decreasing` | or `increasing` |
| `actions` | `[]` | buttons, see above |
| `tapToDismiss` | `true` | a click closes it |
| `enableHtml` | `false` | message as sanitized HTML |
| `newestOnTop` | `true` | |
| `positionClass` | `toast-top-right` | also `toast-top-left`, `toast-bottom-right`, `toast-bottom-left`, `toast-top-center`, `toast-bottom-center`, `toast-top-full-width`, `toast-bottom-full-width`, `toast-center-center` |
| `toastClass` | `ng-toast` | |
| `titleClass` | `toast-title` | |
| `messageClass` | `toast-message` | |
| `easeTime` | `300` | ms of the fade |
| `toastComponent` | `ToastComponent` | see below |

These are about all toasts together, so only `provideToast` takes them:

| Option | Default | |
| --- | --- | --- |
| `maxOpened` | `0` | toasts on screen at once, `0` for no limit; the rest wait in line |
| `autoDismiss` | `false` | at `maxOpened`, a new toast closes the oldest instead of waiting |
| `preventDuplicates` | `false` | a toast with the type, title and message of one that is up hands back that one |
| `countDuplicates` | `false` | shows how often it came: `Offline [3]` |
| `resetTimeoutOnDuplicate` | `false` | a duplicate starts the timer of the one that is up over |

Types: `toast-success`, `toast-error`, `toast-info`, `toast-warning`, and `toast-loading` (a
spinner) for `promise`.

### Custom toast

Extend `ToastComponent`, keep an attribute selector (the host is created from it and has to be a
`div`), and pass it as `toastComponent`. Timer, hover, click, `close()` and `runAction()` are
inherited; `title`, `message` and `options` are signals.

```ts
@Component({
  selector: '[rich-toast]',
  template: `<button (click)="close()">×</button><div [innerHTML]="message()"></div>`
})
export class RichToast extends ToastComponent {}

this.toast.show(html, 'Title', { toastComponent: RichToast, disableTimeOut: true }, 'toast-info');
```

## Upgrading from 1.x

- `ActiveToast.title` and `.message` are signals: `toast.title()`.
- In a custom toast, `title`, `message` and `options` are signals: `{{ title() }}`,
  `options().closeButton`. `closing` is public and read-only.
- The timer starts when the service calls `start()`, no longer in the constructor.
- `pauseWhenHidden` is on by default; set it to `false` for the old behavior.

## Coming from ngx-toastr

- `ToastrService` → `ToastService`, `provideToastr` / `ToastrModule.forRoot` → `provideToast`
  (optional), `Toast` → `ToastComponent`.
- `ActiveToast.portal` → `componentRef`. `title` and `message` are signals.
- Default class `ngx-toastr` → `ng-toast`.
- A duplicate is a toast with the same type, title and message; `includeTitleDuplicates` is gone.
  `show` hands back the open toast instead of `null`.
- Not carried over: `onShown`, `iconClasses`, the `toastContainer` directive and NgModules other
  than none.

## Develop

```sh
npm test         # vitest, jsdom
npm run build    # dist/ng-toast
npm run release  # test, build, npm publish
```

MIT
