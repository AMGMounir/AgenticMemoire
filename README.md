# MémoireAI – Assistant de Recherche pour Mémoire avec Intelligence Artificielle

MémoireAI est une application web permettant d’aider à la préparation d’un **mémoire académique** (Master, recherche, projet universitaire) à l’aide d’agents d’intelligence artificielle.

L’application permet de générer automatiquement une **mindmap**, de rechercher des **sources pertinentes**, puis de produire une **synthèse structurée du mémoire**.

---

# Fonctionnalités

- Génération automatique de **mindmaps** à partir d’un sujet
- Visualisation de mindmaps avec **Mermaid.js**
- Recherche automatique de **sources académiques**
- Gestion et ajout manuel de **sources**
- Agents IA pour analyser et organiser les informations
- Génération d’une **structure de mémoire**
- Interface web simple et intuitive

---

# Technologies utilisées

## Backend
- Node.js
- Express.js

## Frontend
- HTML
- CSS
- JavaScript
- Mermaid.js

## Intelligence Artificielle
- Google AI Studio (Gemini)

## Autres outils
- Docker
- Git

---

# Architecture du projet

```
AgenticMemoire
│
├── agents/               # Agents IA (recherche, synthèse)
│   └── orchestrator.js
│
├── utils/                # Fonctions utilitaires
│   ├── mindmapParser.js
│   ├── sourceStore.js
│   └── userStore.js
│
├── public/               # Interface utilisateur
│   ├── index.html
│   ├── login.html
│   └── assets/
│
├── server.js             # Serveur Express principal
├── package.json          # Dépendances Node
├── Dockerfile
└── README.md
```

---

# Installation

## 1. Cloner le projet

```bash
git clone https://github.com/username/AgenticMemoire.git
cd AgenticMemoire
```

---

## 2. Installer les dépendances

```bash
npm install
```

---

## 3. Configurer les variables d’environnement

Créer un fichier **`.env`** à la racine du projet :

```
PORT=3000
SESSION_SECRET=dev-secret-change-me

GOOGLE_API_KEY=your_google_ai_studio_key
GOOGLE_CLIENT_ID=your_google_oauth_client_id
```

---

# Lancer l'application

```bash
node server.js
```

Le serveur démarre sur :

```
http://localhost:3000
```

---

# Utilisation

1. Aller dans la section **Mindmap**
2. Entrer le **sujet du mémoire**
3. Générer la **mindmap**
4. Lancer la **recherche de sources**
5. Consulter les **sources collectées**
6. Lancer la **synthèse**
7. Obtenir la **structure du mémoire**

---

# Utilisation avec Docker

## Construire l’image

```bash
docker build -t memoir-ai .
```

## Lancer le conteneur

```bash
docker run -p 3000:3000 --env-file .env memoir-ai
```

---

# Auteur

Projet développé dans le cadre d’un projet académique sur l’utilisation des **agents d’intelligence artificielle pour l’assistance à la recherche académique**.


---

# Licence

Ce projet est fourni à des fins éducatives et académiques.