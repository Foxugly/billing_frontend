import type { Translation } from '@jsverse/transloco';

/**
 * BUNDLED i18n catalogs (STANDARD-frontend-layout.md §5) — in-memory, so the
 * reference app runs fully offline with no i18n HTTP round-trip. `fr` (default)
 * and `en` are complete; `nl` / `it` / `es` are deep-merged over `en` with
 * localized chrome/nav (stubs — machine-quality, not proofread).
 */

const en: Translation = {
  app: {
    title: 'Foxugly Billing',
    tagline: 'Console de facturation de la flotte',
  },
  common: {
    skip_to_content: 'Skip to content',
    language_switcher: { aria: 'Change language' },
    cancel: 'Cancel',
  },
  chrome: {
    nav: {
      dashboard: 'Dashboard',
      apps: 'Apps',
      deliveries: 'Deliveries',
      soutenir: 'Support',
      aria_main: 'Main navigation',
      aria_mobile: 'Mobile navigation',
    },
    theme: { toggle: 'Toggle theme' },
    menu: { open: 'Open menu', close: 'Close menu' },
    user: {
      profile: 'Profile',
      change_password: 'Change password',
      logout: 'Log out',
      menu_aria: 'User menu',
      sign_in: 'Sign in',
    },
  },
  footer: {
    version_label: 'Version {{version}}',
    author: 'Foxugly',
    privacy: 'Privacy',
    rights: 'All rights reserved',
  },
  dashboard: {
    title: 'Dashboard',
    mrr: 'Monthly recurring revenue',
    customers: 'Customers',
    pending: 'Pending deliveries',
    per_app: 'Per application',
    paid_of_known: 'paying',
    no_app: 'No application connected yet.',
  },
  apps: {
    title: 'Applications',
    empty: 'No application is connected to the billing service yet.',
    slug: 'Application',
    endpoint: 'Entitlement endpoint',
    plans: 'Plans',
    ping: 'Test',
    rotate: 'Rotate secret',
    rotate_confirm:
      'Rotate the shared secret of {{slug}}? The previous one keeps working for 24 hours — put the new one in the application SSM before then.',
    rotate_failed: 'Rotation failed.',
    ping_failed: 'The application could not be reached.',
    new_secret: 'New shared secret',
    secret_warning: 'Shown once only. Copy it now: it cannot be read again.',
  },
  deliveries: {
    title: 'Deliveries',
    empty: 'No delivery matches this filter.',
    target: 'Target',
    attempts: 'Attempts',
    last_error: 'Last error',
    created: 'Created',
    replay: 'Replay',
    replayed: 'Delivery requeued.',
    replay_failed: 'Replay failed.',
    all: 'All',
    pending: 'Pending',
    delivered: 'Delivered',
  },
  login: {
    title: 'Sign in',
    email: 'Email',
    password: 'Password',
    remember: 'Remember me',
    forgot: 'Forgot password?',
    submit: 'Sign in',
    or: 'or',
    magic: 'Get a sign-in link',
    magic_submit: 'Send the link',
    magic_sent: 'Sign-in link sent (demo).',
    no_account: 'No account yet?',
    register: 'Create an account',
    success: 'Signed in',
    staff_only: 'Access is restricted to Foxugly operators.',
    failed: 'Login refused: unknown account, wrong password, or not an operator.',
  },
  privacy: {
    title: 'Privacy',
    lead: 'This is a stub privacy page so the footer link resolves.',
    body: 'Operator console for the Foxugly billing service. Access is restricted to staff accounts; no personal data is collected from visitors.',
  },
};

const fr: Translation = {
  app: {
    title: 'Foxugly Billing',
    tagline: 'Console de facturation de la flotte',
  },
  common: {
    skip_to_content: 'Aller au contenu',
    language_switcher: { aria: 'Changer de langue' },
    cancel: 'Annuler',
  },
  chrome: {
    nav: {
      dashboard: 'Tableau de bord',
      apps: 'Applications',
      deliveries: 'Livraisons',
      soutenir: 'Soutenir',
      aria_main: 'Navigation principale',
      aria_mobile: 'Navigation mobile',
    },
    theme: { toggle: 'Basculer le thème' },
    menu: { open: 'Ouvrir le menu', close: 'Fermer le menu' },
    user: {
      profile: 'Profil',
      change_password: 'Changer de mot de passe',
      logout: 'Déconnexion',
      menu_aria: 'Menu utilisateur',
      sign_in: 'Se connecter',
    },
  },
  footer: {
    version_label: 'Version {{version}}',
    author: 'Foxugly',
    privacy: 'Confidentialité',
    rights: 'Tous droits réservés',
  },
  dashboard: {
    title: 'Tableau de bord',
    mrr: 'Revenu mensuel récurrent',
    customers: 'Clients',
    pending: 'Livraisons en attente',
    per_app: 'Par application',
    paid_of_known: 'payants',
    no_app: 'Aucune application branchée pour le moment.',
  },
  apps: {
    title: 'Applications',
    empty: "Aucune application n'est branchée sur le service de facturation.",
    slug: 'Application',
    endpoint: 'Endpoint de réception',
    plans: 'Plans',
    ping: 'Tester',
    rotate: 'Changer le secret',
    rotate_confirm:
      "Changer le secret partagé de {{slug}} ? L'ancien reste accepté 24 h — poser le nouveau dans le SSM de l'application avant ce délai.",
    rotate_failed: 'La rotation a échoué.',
    ping_failed: "L'application n'a pas pu être jointe.",
    new_secret: 'Nouveau secret partagé',
    secret_warning: "Affiché une seule fois. Copiez-le maintenant : il ne sera plus relisible.",
  },
  deliveries: {
    title: 'Livraisons',
    empty: 'Aucune livraison ne correspond à ce filtre.',
    target: 'Destinataire',
    attempts: 'Tentatives',
    last_error: 'Dernière erreur',
    created: 'Créée',
    replay: 'Rejouer',
    replayed: 'Livraison remise en file.',
    replay_failed: 'Le rejeu a échoué.',
    all: 'Toutes',
    pending: 'En attente',
    delivered: 'Livrées',
  },
  login: {
    title: 'Se connecter',
    email: 'Email',
    password: 'Mot de passe',
    remember: 'Se souvenir de moi',
    forgot: 'Mot de passe oublié ?',
    submit: 'Se connecter',
    or: 'ou',
    magic: 'Recevoir un lien de connexion',
    magic_submit: 'Envoyer le lien',
    magic_sent: 'Lien de connexion envoyé (démo).',
    no_account: 'Pas encore de compte ?',
    register: 'Créer un compte',
    success: 'Connecté',
    staff_only: 'L’accès est réservé aux opérateurs Foxugly.',
    failed: 'Connexion refusée : compte inconnu, mot de passe erroné, ou compte non-opérateur.',
  },
  privacy: {
    title: 'Confidentialité',
    lead: 'Page de confidentialité factice pour que le lien du footer se résolve.',
    body: 'Console d’exploitation du service de facturation Foxugly. L’accès est réservé aux comptes opérateurs ; aucune donnée personnelle de visiteur n’est collectée.',
  },
};

/** Deep-merge source over a copy of base (arrays/scalars replaced). */
function deepMerge(base: Translation, override: Translation): Translation {
  const out: Translation = Array.isArray(base) ? [...base] : { ...base };
  for (const key of Object.keys(override)) {
    const b = (out as Record<string, unknown>)[key];
    const o = (override as Record<string, unknown>)[key];
    (out as Record<string, unknown>)[key] =
      b && o && typeof b === 'object' && typeof o === 'object' && !Array.isArray(b)
        ? deepMerge(b as Translation, o as Translation)
        : o;
  }
  return out;
}

// nl / it / es — localized chrome only, English fallback for the rest (stubs).
const nl = deepMerge(en, {
  app: { tagline: 'Facturatieconsole van de vloot' },
  common: { skip_to_content: 'Naar inhoud', language_switcher: { aria: 'Taal wijzigen' }, cancel: 'Annuleren' },
  chrome: {
    nav: { soutenir: 'Steunen', aria_main: 'Hoofdnavigatie', aria_mobile: 'Mobiele navigatie' },
    theme: { toggle: 'Thema wisselen' },
    menu: { open: 'Menu openen', close: 'Menu sluiten' },
    user: { profile: 'Profiel', change_password: 'Wachtwoord wijzigen', logout: 'Afmelden', menu_aria: 'Gebruikersmenu', sign_in: 'Aanmelden' },
  },
  footer: { privacy: 'Privacy', rights: 'Alle rechten voorbehouden' },
});

const it = deepMerge(en, {
  app: { tagline: 'Console di fatturazione della flotta' },
  common: { skip_to_content: 'Vai al contenuto', language_switcher: { aria: 'Cambia lingua' }, cancel: 'Annulla' },
  chrome: {
    nav: { soutenir: 'Sostieni', aria_main: 'Navigazione principale', aria_mobile: 'Navigazione mobile' },
    theme: { toggle: 'Cambia tema' },
    menu: { open: 'Apri menu', close: 'Chiudi menu' },
    user: { profile: 'Profilo', change_password: 'Cambia password', logout: 'Esci', menu_aria: 'Menu utente', sign_in: 'Accedi' },
  },
  footer: { privacy: 'Privacy', rights: 'Tutti i diritti riservati' },
});

const es = deepMerge(en, {
  app: { tagline: 'Consola de facturación de la flota' },
  common: { skip_to_content: 'Ir al contenido', language_switcher: { aria: 'Cambiar idioma' }, cancel: 'Cancelar' },
  chrome: {
    nav: { soutenir: 'Apoyar', aria_main: 'Navegación principal', aria_mobile: 'Navegación móvil' },
    theme: { toggle: 'Cambiar tema' },
    menu: { open: 'Abrir menú', close: 'Cerrar menú' },
    user: { profile: 'Perfil', change_password: 'Cambiar contraseña', logout: 'Cerrar sesión', menu_aria: 'Menú de usuario', sign_in: 'Iniciar sesión' },
  },
  footer: { privacy: 'Privacidad', rights: 'Todos los derechos reservados' },
});

export const CATALOGS: Record<string, Translation> = { fr, en, nl, it, es };
