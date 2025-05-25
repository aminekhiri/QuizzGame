#!/bin/bash

# Couleurs pour différencier les logs
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Démarrage de l'application QuizzGame...${NC}"

# Fonction pour vérifier si un port est utilisé
check_port() {
  local port=$1
  local pid=$(lsof -ti:$port 2>/dev/null)
  echo $pid
}

# Fonction pour arrêter les processus sur un port spécifique
kill_port() {
  local port=$1
  local pid=$(check_port $port)
  if [ -n "$pid" ]; then
    echo -e "${YELLOW}Port $port déjà utilisé (PID: $pid). Arrêt du processus...${NC}"
    kill -9 $pid 2>/dev/null
    sleep 1
    if [ -n "$(check_port $port)" ]; then
      echo -e "${RED}Impossible d'arrêter le processus sur le port $port.${NC}"
      return 1
    else
      echo -e "${GREEN}Processus arrêté avec succès.${NC}"
      return 0
    fi
  else
    echo -e "${GREEN}Port $port libre.${NC}"
    return 0
  fi
}

# Arrêter les serveurs existants si nécessaire
echo -e "\n${YELLOW}Vérification des serveurs en cours d'exécution...${NC}"
kill_port 3000 # Backend
kill_port 8080 # Frontend

# Fonction pour arrêter proprement tous les processus lors de la fermeture
cleanup() {
    echo -e "\n${GREEN}Arrêt des serveurs...${NC}"
    kill $BACK_PID $FRONT_PID 2>/dev/null
    exit 0
}

# Capturer SIGINT (Ctrl+C) pour arrêter proprement
trap cleanup SIGINT

# Lancement du backend
echo -e "${GREEN}Démarrage du backend sur https://localhost:3000...${NC}"
echo -e "${YELLOW}Exécution de la commande: deno run --allow-net --allow-env --allow-read --allow-write -A server.ts${NC}"
cd back && deno run --allow-net --allow-env --allow-read --allow-write -A server.ts &
BACK_PID=$!

# Attendre que le backend soit prêt
echo -e "${YELLOW}Attente du démarrage du backend...${NC}"
sleep 2

# Vérifier que le backend fonctionne
RETRY_COUNT=0
MAX_RETRIES=5

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if curl -k -s https://localhost:3000/ping > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend démarré avec succès${NC}"
    break
  else
    RETRY_COUNT=$((RETRY_COUNT+1))
    if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
      echo -e "${RED}Le backend ne répond pas après $MAX_RETRIES tentatives. Vérifiez les logs pour plus de détails.${NC}"
    else
      echo -e "${YELLOW}Tentative $RETRY_COUNT/$MAX_RETRIES - Attente du démarrage du backend...${NC}"
      sleep 2
    fi
  fi
done

# Lancement du frontend
echo -e "${BLUE}Démarrage du frontend sur https://localhost:8080...${NC}"
echo -e "${YELLOW}Exécution de la commande: deno run --allow-net --allow-read --allow-env --allow-write -A server.ts${NC}"
cd static_html_server && deno run --allow-net --allow-read --allow-env --allow-write -A server.ts  &
FRONT_PID=$!
cd ..

echo -e "${GREEN}Les deux serveurs sont en cours d'exécution.${NC}"
echo -e "${GREEN}Accédez à l'application via https://localhost:8080${NC}"
echo -e "${GREEN}Appuyez sur Ctrl+C pour arrêter les deux serveurs.${NC}"

# Attendre que l'un des processus se termine
wait $BACK_PID $FRONT_PID

# Si l'un des serveurs s'arrête, arrêter l'autre aussi
cleanup
