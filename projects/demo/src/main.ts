import { provideZonelessChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideToast } from '@stefankuburovic/ng-toast';

import { App } from './app';

import { STACKED } from './stacked';

bootstrapApplication(App, {
  providers: [
    provideZonelessChangeDetection(),
    // Shown on the page as well, so what a visitor sees can be traced to it. `stacked` is global,
    // so the layout switch on the page reloads it with ?layout=stacked.
    provideToast({ maxOpened: 4, preventDuplicates: true, countDuplicates: true, stacked: STACKED })
  ]
}).catch(error => console.error(error));
