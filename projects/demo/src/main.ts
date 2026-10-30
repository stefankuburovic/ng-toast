import { provideZonelessChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideToast } from '@stefankuburovic/ng-toast';

import { App } from './app';

bootstrapApplication(App, {
  providers: [
    provideZonelessChangeDetection(),
    // Shown on the page as well, so what a visitor sees can be traced to it.
    provideToast({ maxOpened: 4, preventDuplicates: true, countDuplicates: true })
  ]
}).catch(error => console.error(error));
