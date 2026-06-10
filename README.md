# Site Web ABS91 - Amicale Badminton Spinolienne

Site web moderne et responsive pour le club de badminton ABS91 à Épinay-sur-Orge.

## 🎯 Aperçu

Ce site web présente l'Amicale Badminton Spinolienne (ABS91), un club de badminton fondé en 1999 à Épinay-sur-Orge. Le site offre une expérience utilisateur moderne et intuitive pour présenter le club, gérer les inscriptions et informer les membres.

## 📄 Pages du site

### Pages principales

1. **index.html** - Page d'accueil
   - Hero section accueillante
   - Statistiques du club (190+ adhérents, 4 équipes, etc.)
   - Présentation rapide
   - Cartes des avantages
   - Tarifs de la saison
   - Dernières actualités
   - CTA inscriptions

2. **about.html** - À propos
   - Histoire du club (fondé en 1999)
   - Valeurs (convivialité, respect, progrès)
   - Équipe dirigeante
   - Installations sportives (2 gymnases)
   - Activités proposées

3. **inscription.html** - Inscriptions
   - Tarifs détaillés saison 2025-2026
   - Modalités d'inscription en ligne
   - Sections disponibles (Loisirs, Jeunes, Compétiteurs)
   - Documents à fournir
   - CTA vers plateforme FFBaD

4. **horaires.html** - Horaires & Créneaux
   - Planning détaillé des créneaux
   - Informations sur les 2 gymnases
   - Coordonnées GPS
   - Accès et transports

5. **actualites.html** - Actualités
   - Blog avec articles récents
   - Filtres par catégories
   - Système de badges (date, catégorie)
   - Section newsletter

6. **galerie.html** - Galerie photos
   - Photos d'entraînements
   - Photos de compétitions
   - Événements et moments de cohésion
   - Galerie responsive avec effet hover

7. **contact.html** - Contact
   - Formulaire de contact
   - Coordonnées complètes
   - Adresses des gymnases
   - FAQ
   - Liens réseaux sociaux

8. **partenaires.html** - Nos Partenaires
   - Partenaires principaux
   - Partenaires locaux
   - Avantages adhérents
   - Formulaire devenir partenaire

## 🎨 Design & Technologies

### Technologies utilisées

- **HTML5** - Structure sémantique
- **CSS3** - Design moderne avec variables CSS
- **JavaScript** - Interactivité (vanilla JS)
- **Font Awesome 6.4.0** - Icônes
- **Google Fonts** - Typographie (Inter & Montserrat)

### Charte graphique

#### Couleurs principales

```css
--primary-red: #E63946     /* Rouge principal */
--primary-dark: #1D3557    /* Bleu foncé */
--primary-blue: #457B9D    /* Bleu moyen */
--accent-light: #A8DADC    /* Bleu clair */
--bg-light: #F1FAEE        /* Fond clair */
```

#### Typographie

- **Titres** : Montserrat (700, 800)
- **Texte** : Inter (400, 500, 600, 700)

### Fonctionnalités CSS

- ✅ Design responsive (mobile-first)
- ✅ Variables CSS pour cohérence
- ✅ Grid & Flexbox layouts
- ✅ Animations au scroll (Intersection Observer)
- ✅ Transitions fluides
- ✅ Cards avec effets hover
- ✅ Navigation sticky
- ✅ Ombres et dégradés modernes

### Fonctionnalités JavaScript

- ✅ Menu mobile hamburger
- ✅ Smooth scroll
- ✅ Active nav link
- ✅ Animations au scroll (fade-in)
- ✅ Compteurs animés (stats)
- ✅ Validation formulaires
- ✅ Lightbox galerie (à venir)

## 📁 Structure des fichiers

```
site-web/
├── index.html              # Page d'accueil
├── about.html              # À propos
├── inscription.html        # Inscriptions
├── horaires.html           # Horaires & Créneaux
├── actualites.html         # Actualités
├── galerie.html            # Galerie photos
├── contact.html            # Contact
├── partenaires.html        # Partenaires
├── css/
│   └── style.css          # CSS global
├── js/
│   └── main.js            # JavaScript principal
├── images/                # Images du site (à ajouter)
├── assets/                # Ressources diverses
└── README.md              # Ce fichier
```

## 🚀 Installation & Utilisation

### Installation

1. Cloner le repository
```bash
git clone [url-du-repo]
cd Site-ABS/site-web
```

2. Ouvrir le site
```bash
# Méthode 1 : Ouvrir directement index.html dans un navigateur

# Méthode 2 : Serveur local avec Python
python -m http.server 8000

# Méthode 3 : Serveur local avec Node.js
npx http-server -p 8000
```

3. Accéder au site
```
http://localhost:8000
```

### Pas de build requis

Le site est entièrement statique (HTML/CSS/JS vanilla), aucune compilation ou build n'est nécessaire.

## 📱 Responsive Design

Le site est optimisé pour tous les appareils :

- **Mobile** : < 768px
- **Tablette** : 768px - 1024px
- **Desktop** : > 1024px

Breakpoints CSS :
```css
@media (max-width: 768px) { /* Mobile */ }
@media (max-width: 1024px) { /* Tablette */ }
```

## 🎯 Features

### Implémentées

- ✅ 8 pages complètes
- ✅ Navigation responsive
- ✅ Formulaire de contact
- ✅ Galerie photos
- ✅ Animations au scroll
- ✅ Design moderne et professionnel
- ✅ SEO friendly (meta tags)
- ✅ Accessibilité (aria-labels, labels)

### À améliorer / Ajouter

- ⏳ Intégration vraies photos du club
- ⏳ Backend pour formulaire de contact
- ⏳ Système de blog dynamique
- ⏳ Espace membres (optionnel)
- ⏳ Calendrier des événements
- ⏳ Résultats interclubs en temps réel
- ⏳ Optimisation images (lazy loading)
- ⏳ PWA (Progressive Web App)

## 📊 Informations du club

### Coordonnées

- **Nom** : Amicale Badminton Spinolienne (ABS91)
- **Téléphone** : 06 38 69 88 78
- **Email** : abs91360@gmail.com
- **Adresse** : 8 rue de l'Église, 91360 Épinay-sur-Orge
- **Site web** : https://abs91.fr
- **Facebook** : https://www.facebook.com/AmicaleBadmintonSpinolienne

### Gymnases

**Gymnase Millénaire des Templiers**
- 5 rue de la Croix Ronde, 91360 Épinay-sur-Orge

**Gymnase Alain Mimoun**
- Voie des Prés, 91360 Épinay-sur-Orge

### Horaires

| Jour | Horaire | Lieu | Public |
|------|---------|------|--------|
| Mardi | 20h30-22h30 | Gymnase Mimoun | Adultes loisir |
| Mercredi | 20h00-22h30 | Gymnase Millénaire | Adultes loisir |
| Jeudi | 19h30-22h30 | Gymnase Millénaire | Compétiteurs |
| Samedi | 09h00-12h45 | Gymnase Millénaire | Jeunes + Cours |
| Samedi | 15h00-18h00 | Gymnase Millénaire | Adultes loisir |

### Tarifs 2025-2026

- **Loisirs** : 110€
- **Jeunes** : 105€
- **Compétiteurs** : 130€
- **Cours samedi** : +40€

## 🔧 Personnalisation

### Modifier les couleurs

Éditer `/css/style.css` et changer les variables CSS :

```css
:root {
    --primary-red: #E63946;    /* Votre couleur */
    --primary-dark: #1D3557;   /* Votre couleur */
    /* etc. */
}
```

### Ajouter des images

1. Placer les images dans `/images/`
2. Référencer dans le HTML :
```html
<img src="images/votre-image.jpg" alt="Description">
```

### Modifier le contenu

Éditer directement les fichiers HTML correspondants.

## 📝 Licence

© 2025 ABS91 - Amicale Badminton Spinolienne. Tous droits réservés.

## 🤝 Contribution

Pour toute suggestion ou amélioration, contactez le club ou créez une issue.

---

**Fait avec ❤️ pour le badminton et l'ABS91**
