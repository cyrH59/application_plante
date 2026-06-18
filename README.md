# PlantCare

Prototype de webapp/PWA mobile pour gerer des plantes avec arrosage, fertilisation, meteo et historique exportable.

## Lancer l'application

Ouvrir `index.html` permet de tester l'interface. Pour tester la PWA complete, il faut servir le dossier en HTTP/HTTPS puis ouvrir l'URL sur PC ou telephone.

Hebergements gratuits compatibles :

- GitHub Pages pour une version statique simple.
- Vercel Hobby pour un deploiement rapide depuis GitHub.
- Netlify Free pour une alternative statique avec CDN.
- Supabase pour la future base de donnees, l'authentification et les photos.

## Architecture

Les regles configurables sont separees de l'interface :

```txt
src/
  config.js      regles plantes, saisons, seuils, risques meteo
  engines.js     calculs arrosage, fertilisation, exposition, risques
app.js           orchestration UI, stockage local, meteo, import/export
```

L'objectif est de pouvoir ajouter un nouveau profil de plante ou modifier les seuils sans toucher a la logique metier.

## Fertilisation

Deux modes existent par plante :

- `auto` : la frequence vient du profil d'entretien dans `src/config.js`.
- `manual` : la frequence est definie dans la fiche plante, saison par saison.

Signification des frequences :

- `0` : aucune fertilisation.
- `0.5` : une fertilisation tous les deux mois.
- `1` : une fertilisation par mois.
- `2` : deux fertilisations par mois.

La jauge passe a 100% juste apres fertilisation. Elle descend progressivement jusqu'a environ 25% le jour de l'echeance, puis passe en retard.

## Arrosage

Chaque plante stocke un niveau d'eau courant. Cliquer sur `J'ai arrose` remet la jauge a 100%.

La jauge baisse selon :

- le profil d'entretien ;
- la perte quotidienne configuree ;
- la chaleur ;
- l'impact de la pluie pour les plantes dehors.

Le niveau peut aussi etre modifie manuellement dans la fiche plante.

## Meteo

Le bouton `Activer` demande la position du telephone et utilise Open-Meteo.

L'application affiche :

- pluie prevue sur 24 h ;
- pluie prevue sur 3 jours ;
- pluie prevue sur 7 jours ;
- temperatures min/max ;
- indice de risque 0 a 10.

Risques pris en compte :

- gel ;
- canicule ;
- fortes pluies ;
- secheresse ;
- orages ;
- vent fort.

## Lumiere / exposition

La jauge lumiere a ete supprimee. Elle est remplacee par un indicateur plus utile :

- exposition actuelle ;
- exposition ideale selon le profil ;
- etat visuel si l'emplacement semble incoherent.

## Donnees actuelles

Le prototype stocke encore les donnees dans le navigateur avec `localStorage`.

- `Export` cree une sauvegarde JSON.
- `Import` restaure une sauvegarde.
- Les photos sont encore encodees localement, donc il faut eviter les images trop lourdes.

## Evolution base de donnees

Pour plusieurs centaines de plantes et des milliers de photos, utiliser Supabase :

```txt
gardens
plants
plant_categories
plant_photos
plant_actions
plant_measurements
plant_rules_overrides
weather_snapshots
```

Les photos devront aller dans Supabase Storage, avec miniatures et chemins stockes en base.
