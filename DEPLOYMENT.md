# Deploiement PlantCare

## Recommandation

Pour ce projet, le meilleur compromis gratuit est :

```txt
Cloudflare Pages ou Vercel
  -> hebergement de la PWA

Supabase
  -> comptes utilisateurs, base PostgreSQL, stockage photos
```

Cloudflare Pages est tres interessant pour la partie statique : plan gratuit, sites illimites, requetes statiques illimitees et bande passante illimitee selon leur page officielle.

Vercel est plus simple si le projet migre plus tard vers React/Next.js.

Supabase sera necessaire pour :

- comptes utilisateurs ;
- partage familial ;
- stockage des photos ;
- historique des actions ;
- synchronisation PC / iPhone.

## Deploiement Vercel

1. Creer un depot GitHub avec ce dossier.
2. Aller sur Vercel.
3. Importer le depot.
4. Laisser Build Command vide.
5. Mettre Output Directory sur `.` si demande.
6. Deployer.

## Deploiement Netlify

Le fichier `netlify.toml` est deja pret.

1. Creer un depot GitHub.
2. Aller sur Netlify.
3. Importer le depot.
4. Build command vide.
5. Publish directory : `.`
6. Deployer.

## Deploiement Cloudflare Pages

1. Creer un depot GitHub.
2. Aller sur Cloudflare Pages.
3. Connecter GitHub.
4. Framework preset : None.
5. Build command vide.
6. Output directory : `.`
7. Deployer.

## Installation iPhone

Une fois le site en HTTPS :

1. Ouvrir l'URL dans Safari.
2. Partager.
3. Ajouter a l'ecran d'accueil.

La PWA utilisera `manifest.webmanifest` et `service-worker.js`.

## Limite actuelle

Le prototype actuel stocke encore les donnees dans le navigateur. Pour plusieurs utilisateurs, il faut migrer vers Supabase avant usage familial reel.
