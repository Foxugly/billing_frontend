import { captureException, initSentry } from './sentry-init';

import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// Lance le chargement du SDK Sentry (s'il y a un DSN) sans retarder le bootstrap.
void initSentry();

bootstrapApplication(App, appConfig).catch((err: unknown) => {
  console.error(err);
  captureException(err);
});
