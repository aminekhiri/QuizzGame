# Quizzy
Application de quiz en ligne avec mode solo et multijoueur

## But du jeu
Quizzy (Quizz Game) est une application interactive de quiz qui permet aux utilisateurs de tester leurs connaissances générales dans différents modes de jeu. Les joueurs peuvent répondre à des questions à choix multiples, accumuler des points et comparer leurs scores avec d'autres joueurs.

## Fonctionnalités principales
- **Mode Solo**: Jouez à votre rythme et améliorez votre score personnel
- **Mode Multijoueur**: Affrontez d'autres joueurs en temps réel
- **Système de compte**: Créez un profil pour sauvegarder votre progression
- **Panneau d'administration**: Gérez les utilisateurs et les questions (accès administrateur)


## Utilisation

1. **Inscription/Connexion**: Créez un compte ou connectez-vous pour accéder à toutes les fonctionnalités.
2. **Menu principal**: Choisissez entre le mode solo ou multijoueur.
3. **Mode Solo**: 
   - Sélectionnez une catégorie de questions
   - Répondez aux questions dans le temps imparti
   - Voyez votre score final et comparez-le avec vos précédents résultats
4. **Mode Multijoueur**:
   - Attendez qu'un autre joueur se connecte
   - Répondez aux questions plus rapidement que votre adversaire
   - Voyez les scores s'actualiser en temps réel
   - Découvrez qui remporte la partie à la fin des 10 questions

## Technologies utilisées
- **Backend**: Deno, Oak
- **Frontend**: HTML, CSS, JavaScript
- **Base de données**: PostgreSQL
- **Authentification**: JWT (JSON Web Tokens)
- **Communication en temps réel**: WebSockets 



## Structure du projet

Le projet est divisé en deux parties principales :

### Back-end (dossier `/back`)

La structure du back-end est organisée comme suit :

- `server.ts` - Point d'entrée principal du serveur
- `db.ts` - Configuration de la base de données et fonctions helper
- `middleware.ts` - Middlewares d'authentification et CORS
- `utils.ts` - Fonctions utilitaires (JWT, WebSocket, etc.)
- `ws.ts` - Gestion des WebSockets pour le mode multijoueur

Routes organisées par fonctionnalité dans le dossier `/routes` :
- `auth.ts` - Routes d'authentification (login, signup, etc.)
- `user.ts` - Routes pour les profils et données utilisateurs
- `admin.ts` - Routes réservées aux administrateurs
- `quiz.ts` - Routes pour les quiz et scores

### Front-end (dossier `/static_html_server/front_end`)

Interface utilisateur avec plusieurs pages :
- Login/Register - Authentification
- Menu - Sélection de mode de jeu
- Quiz - Interface du jeu en mode solo
- Multiplayer - Interface du jeu en mode multijoueur
- Admin - Tableau de bord pour les administrateurs

## Configuration

Les variables d'environnement sont stockées dans le fichier `.env` :
- Configuration PostgreSQL (utilisateur, mot de passe, base de données)
- Secret JWT pour l'authentification
- Origine CORS pour le front-end

## Démarrage

Pour lancer l'application :

```bash
# Exécuter le script de démarrage
./start.sh
```

Le script démarre le back-end sur le port 3000 (HTTPS) et le front-end sur le port 8080 (HTTPS).

