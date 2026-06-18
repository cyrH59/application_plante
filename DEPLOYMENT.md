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

## Etat actuel

Ton URL Cloudflare actuelle :

```txt
https://plantcare.cyril-hannier.workers.dev/
```

Si cette URL affiche le site, la partie PWA est deja hebergee. Il reste a brancher la base Supabase pour avoir les comptes et les donnees synchronisees.

## Brancher Supabase

1. Ouvrir le projet Supabase.
2. Aller dans `SQL Editor`.
3. Coller le contenu de `supabase/schema.sql`.
4. Executer le script.
5. Aller dans `Project Settings` puis `API`.
6. Copier :
   - `Project URL`
   - `anon public` ou `publishable key`
7. Les coller dans `src/supabase-config.js`.

Ne jamais coller la `service_role key` dans le code frontend.

Exemple :

```js
export const supabaseConfig = {
  url: "https://xxxx.supabase.co",
  publishableKey: "eyJ..."
};
```

## Authentification

Le client Supabase est pret dans :

```txt
src/supabase-client.js
src/supabase-repository.js
```

Il utilise le client JavaScript officiel via CDN. La documentation Supabase indique que `createClient` prend l'URL Supabase et la cle fournie par le dashboard.

Dans Supabase, aller dans `Authentication` -> `URL Configuration` :

- `Site URL` : `https://plantcare.cyril-hannier.workers.dev`
- `Redirect URLs` : ajouter `https://plantcare.cyril-hannier.workers.dev/**`

Sans ce reglage, les emails de confirmation peuvent renvoyer vers l'URL par defaut du projet, par exemple `http://localhost:3000`.

Si la connexion affiche une erreur RLS lors de la creation du jardin, executer aussi dans `SQL Editor` :

```txt
supabase/fix-garden-rls.sql
```

Cette fonction cree le jardin par defaut et son adhesion proprietaire dans une transaction cote Supabase.

## Photos

Le script SQL cree un bucket prive :

```txt
plant-photos
```

Les chemins des photos sont stockes dans :

```txt
plant_photos.storage_path
```

Pour la suite, il faudra compresser les photos avant upload et generer une miniature afin de rester dans les limites gratuites.

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
