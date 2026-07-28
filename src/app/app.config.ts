import { ApplicationConfig, isDevMode, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideTransloco } from '@jsverse/transloco';
import { ConfirmationService, MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';
import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { TranslocoHttpLoader } from './core/i18n/transloco-loader';

// Emerald is the single fleet accent (STANDARD-frontend-layout.md §9). Remap BOTH
// the `primary` semantic AND the `green` primitive onto Emerald so that
// `severity="success"` renders in the exact same emerald as `primary` — otherwise
// `success` falls back to PrimeNG's default green and the UI shows two greens.
const EMERALD_SCALE = {
  50: '{emerald.50}',
  100: '{emerald.100}',
  200: '{emerald.200}',
  300: '{emerald.300}',
  400: '{emerald.400}',
  500: '{emerald.500}',
  600: '{emerald.600}',
  700: '{emerald.700}',
  800: '{emerald.800}',
  900: '{emerald.900}',
  950: '{emerald.950}',
} as const;

const BillingAura = definePreset(Aura, {
  primitive: { green: { ...EMERALD_SCALE } },
  semantic: { primary: { ...EMERALD_SCALE } },
});

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    // Attache le JWT et retente une fois apres un 401 en rafraichissant.
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimations(),
    provideTransloco({
      config: {
        availableLangs: ['fr', 'nl', 'en', 'it', 'es'],
        defaultLang: 'fr',
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
      },
      loader: TranslocoHttpLoader,
    }),
    providePrimeNG({
      theme: {
        preset: BillingAura,
        options: {
          prefix: 'p',
          darkModeSelector: '.dark-mode',
          cssLayer: false,
        },
      },
    }),
    MessageService,
    ConfirmationService,
  ],
};
