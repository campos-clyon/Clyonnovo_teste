FROM node:20-slim

# Pequenas dependências nativas de algumas bibliotecas do Baileys.
RUN apt-get update && apt-get install -y --no-install-recommends git python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY index.js ./

# As credenciais do WhatsApp: montar um volume aqui, senão emparelha-se a cada arranque.
VOLUME ["/app/auth"]
ENV PASTA_DA_SESSAO=/app/auth

CMD ["node", "index.js"]
