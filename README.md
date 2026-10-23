# @stefankuburovic/ng-toast

Small toast notifications for Angular. Signals and plain timers, works zoneless, no dependencies
beyond `@angular/core` (≥ 20.2) and `rxjs`. About 8 kB of JavaScript and 6 kB of CSS.

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

### `ToastService`

| Method | |
| --- | --- |
| `success / error / info / warning(message?, title?, override?)` | Opens a toast, returns an `ActiveToast`. |
| `show(message?, title?, override?, type?)` | Same with any type class. |
| `clear(toastId?)` | Fades out one toast, or all. |
| `remove(toastId)` | Takes a toast out at once. `false` when it is not open. |

`ActiveToast` has `toastId`, `title`, `message`, `componentRef`, `onTap` (every click) and
`onHidden` (once, however the toast went).

### Options

| Option | Default | |
| --- | --- | --- |
| `timeOut` | `5000` | ms until it goes; `0` keeps it |
| `extendedTimeOut` | `1000` | ms after the pointer leaves it (hover pauses it) |
| `disableTimeOut` | `false` | keep it until closed |
| `closeButton` | `false` | draw a × |
| `tapToDismiss` | `true` | a click closes it |
| `enableHtml` | `false` | message as sanitized HTML |
| `newestOnTop` | `true` | |
| `positionClass` | `toast-top-right` | also `toast-top-left`, `toast-bottom-right`, `toast-bottom-left`, `toast-top-center`, `toast-bottom-center`, `toast-top-full-width`, `toast-bottom-full-width`, `toast-center-center` |
| `toastClass` | `ng-toast` | |
| `titleClass` | `toast-title` | |
| `messageClass` | `toast-message` | |
| `easeTime` | `300` | ms of the fade |
| `toastComponent` | `ToastComponent` | see below |

### Custom toast

Extend `ToastComponent`, keep an attribute selector (the host is created from it and has to be a
`div`), and pass it as `toastComponent`. Timer, hover, click and `close()` are inherited.

```ts
@Component({
  selector: '[rich-toast]',
  template: `<button (click)="close()">×</button><div [innerHTML]="message"></div>`
})
export class RichToast extends ToastComponent {}

this.toast.show(html, 'Title', { toastComponent: RichToast, disableTimeOut: true }, 'toast-info');
```

## Coming from ngx-toastr

- `ToastrService` → `ToastService`, `provideToastr` / `ToastrModule.forRoot` → `provideToast`
  (optional), `Toast` → `ToastComponent`.
- `ActiveToast.portal` → `componentRef`. `title`, `message`, `options` on the component are plain
  fields, not signals.
- Default class `ngx-toastr` → `ng-toast`.
- Not carried over: progress bar, duplicate handling (`preventDuplicates`, `countDuplicates`),
  `maxOpened` / `autoDismiss`, `onShown`, `onAction`, `iconClasses`, the `toastContainer`
  directive and NgModules other than none.

## Develop

```sh
npm test         # vitest, jsdom
npm run build    # dist/ng-toast
npm run release  # test, build, npm publish
```

MIT
