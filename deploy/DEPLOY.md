# Déploiement — console de facturation

Modèle flotte : GitHub Actions → OIDC → S3 + SSM (OPERATIONS.md §3.11). Aucun build
sur la box : le bundle est construit par la CI, déposé sur S3, puis déplié par root.

| Élément | Valeur |
|---|---|
| Arbre | `/var/www/django_websites/billing_frontend` |
| Docroot | `dist/billing-frontend/browser` |
| vhost | `billing.foxugly.com` → `deploy/nginx/billing-frontend.conf` |
| Config d'exécution | SSM `/billing-frontend/prod` → snippet nginx → `window.__BILLING__` |
| Unit | `billing-frontend-runtime-fetch` (oneshot root) |
| Rôle OIDC | `billing-frontend-deploy` |
| Bundle | `s3://foxugly-deploy/builds/billing-frontend/<sha>.tar.gz` |

La configuration n'est **jamais compilée dans le bundle** : le même artefact se
promeut d'un environnement à l'autre sans reconstruction.

## Recharger la configuration après un changement en SSM

    sudo systemctl restart billing-frontend-runtime-fetch

Le script valide `nginx -t` avant de recharger : un snippet fautif ne doit jamais
emporter nginx, donc les autres sites de la flotte avec lui.

## Diagnostic

    cat /etc/nginx/snippets/billing-frontend-runtime.conf
    curl -s https://billing.foxugly.com/ | grep -o 'window.__BILLING__={[^}]*}'
    journalctl -u billing-frontend-runtime-fetch -n 50 --no-pager
