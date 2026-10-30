# @stefankuburovic/ng-toast

Small toast notifications for Angular. Signals and plain timers, works zoneless, no dependencies
beyond `@angular/core` (≥ 20.2) and `rxjs`. About 4 kB of JavaScript and 4.5 kB of CSS,
minified and gzipped.

The API follows [ngx-toastr](https://github.com/scttcper/ngx-toastr) (archived), so moving over
is mostly a rename. The stylesheet is taken from it.

Live demo: https://stefankuburovic.github.io/ng-toast/

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

| Action field | |
| --- | --- |
| `label` | the button's text |
| `onClick` | runs on the click |
| `dismiss` | `false` keeps the toast up; default `true` |
| `class` | classes next to `toast-action`; `toast-action-primary` is the emphasized look |
| `ariaLabel` | what a screen reader reads instead of the label |

```ts
this.toast.error('Could not save', '', {
  actions: [
    { label: 'Details', dismiss: false, onClick: () => this.openLog() },
    { label: 'Retry', class: 'toast-action-primary', onClick: () => this.save() }
  ]
});
```

## Theming

Every color and size in `toast.css` comes from a CSS variable, with the default as fallback.
Set them anywhere above the toasts: `:root` for the whole app, or a class of your own for one
kind of toast. No selectors to out-specify.

```css
:root {
  --ng-toast-radius: 8px;
  --ng-toast-font: 500 14px/20px Inter, sans-serif;
  --ng-toast-success-bg: #1e7d4f;
}

/* one kind of toast: provideToast({ toastClass: 'ng-toast brand' }) or per call */
.brand {
  --ng-toast-bg: #111827;
  --ng-toast-icon-color: #facc15;
}
```

| Variables | |
| --- | --- |
| `--ng-toast-bg`, `--ng-toast-color` | a toast without a type, and the text of every one |
| `--ng-toast-{success,error,info,warning,loading}-bg` / `-color` | per type |
| `--ng-toast-icon-color` | type icons and the spinner (they are masks, so any color works); default the text color |
| `--ng-toast-icon` | the icon itself, a `url(…)`; set it on `.toast-success` etc. to replace one |
| `--ng-toast-width`, `-padding`, `-radius`, `-gap`, `-offset`, `-z-index` | size and place |
| `--ng-toast-shadow`, `-shadow-hover` | |
| `--ng-toast-font`, `-title-font`, `-title-weight` | type |
| `--ng-toast-close-color`, `-close-hover-color`, `-close-shadow` | the × |
| `--ng-toast-link-color`, `-link-hover-color` | links in an HTML message |
| `--ng-toast-action-{bg,color,border,radius,padding,font,weight,hover-bg}` | action buttons |
| `--ng-toast-action-primary-{bg,color,hover-bg}` | `toast-action-primary` |
| `--ng-toast-progress-{color,opacity,height}` | the progress bar |

### Angular Material

`toast-material.css` sets these variables from Material 3's system variables, so the toasts look
like `MatSnackBar` and follow the app's palette, shape, typography and light or dark mode:

```json
"styles": [
  "node_modules/@stefankuburovic/ng-toast/toast.css",
  "node_modules/@stefankuburovic/ng-toast/toast-material.css",
  "src/styles.scss"
]
```

It needs a theme that emits the `--mat-sys-*` variables (`@include mat.theme(…)`, Angular
Material 19+). Toasts sit on the inverse surface with icons and actions in the inverse primary,
errors on the error container. Anything it sets can still be overridden with the variables above.

### `ToastService`

| Method | |
| --- | --- |
| `success / error / info / warning(message?, title?, override?)` | Opens a toast, returns an `ActiveToast`. |
| `show(message?, title?, override?, type?)` | Same with any type class. |
| `promise(promise, { loading, success, error }, override?)` | A loading toast that turns into success or error. |
| `clear(toastId?)` | Fades out one toast, or all; waiting ones go at once. |
| `remove(toastId)` | Takes a toast out at once. `false` when it is not open. |

`ActiveToast` has `toastId`, `title()` and `message()` (signals), `componentRef`, `update(changes)`,
`onShown` (once it is on screen, which for a queued toast is later; replays to late subscribers),
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
| `stacked` | `false` | lays the toasts in a deck instead of a list, see below |

Types: `toast-success`, `toast-error`, `toast-info`, `toast-warning`, and `toast-loading` (a
spinner) for `promise`.

### Stacked

```ts
provideToast({ stacked: true, maxOpened: 5 })
```

The toasts of each position lie on top of each other like a deck: the newest in front, the
older ones peeking out behind it, smaller, the cards past the third hidden. While the pointer or
keyboard focus is on the deck it spreads into a list, and every timer in it waits; when the
pointer leaves, they run out their `extendedTimeOut`. At the top the deck peeks and spreads
downwards, at the bottom upwards. In a stack the newest is always in front, whatever
`newestOnTop` says. It is CSS, fed a few measurements by the service, and works with every
theme.

| Variable | Default | |
| --- | --- | --- |
| `--ng-toast-stack-offset` | `10px` | how far each card behind peeks out |
| `--ng-toast-stack-scale` | `0.05` | how much smaller each card behind is |
| `--ng-toast-stack-visible` | `3` | cards shown while collapsed |
| `--ng-toast-stack-time` | `300ms` | the spread and collapse |

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
- Type icons are a `::before` mask instead of a `background-image`. A stylesheet that replaced an
  icon with `background-image` sets `--ng-toast-icon` on the type class instead.

## Coming from ngx-toastr

- `ToastrService` → `ToastService`, `provideToastr` / `ToastrModule.forRoot` → `provideToast`
  (optional), `Toast` → `ToastComponent`.
- `ActiveToast.portal` → `componentRef`. `title` and `message` are signals.
- Default class `ngx-toastr` → `ng-toast`.
- A duplicate is a toast with the same type, title and message; `includeTitleDuplicates` is gone.
  `show` hands back the open toast instead of `null`.
- `iconClasses` → the type classes and `--ng-toast-icon`.
- Not carried over: the `toastContainer` directive and NgModules other than none.

## Develop

```sh
npm test         # vitest, jsdom
npm run demo     # the playground on localhost:4200, built from source
npm run build    # dist/ng-toast
npm run release  # test, build, npm publish
```

MIT
