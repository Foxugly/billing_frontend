# billing_frontend — console d'exploitation de la facturation

SPA Angular servie sur `billing.foxugly.com`. **Réservée aux opérateurs** : pas
d'inscription, pas de mot de passe oublié — le backend refuse tout compte non-staff,
et les comptes sont créés par `createsuperuser`.

Elle consomme `/api/admin/` de `billing-api.foxugly.com` (JWT), API entièrement
disjointe de l'API service-à-service signée en HMAC que consomment les sites de la flotte.

- Backend : `Foxugly/billing_server`
- Standard de layout : `STANDARD-frontend-layout.md` (dépôt `foxugly-ops`)
- Base : l'app de référence `foxugly-ops/frontend-reference/foo-app`

## Développement

    npm install
    npm start        # http://localhost:4200, API sur http://127.0.0.1:8007
    npm test         # vitest
    npm run build

La configuration (`apiBaseUrl`, Sentry, version) est **injectée au déploiement** par
nginx depuis `/billing-frontend/prod` (SSM), jamais compilée dans le bundle : le même
bundle se promeut d'un environnement à l'autre sans reconstruction.
