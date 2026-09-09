# A ponte do WhatsApp: whatsapp-web.js a conduzir um Chromium sem janela.
FROM node:20-bookworm-slim

# O Chromium do sistema e as fontes de que precisa. O puppeteer que vem com o
# whatsapp-web.js NÃO descarrega o Chrome dele (PUPPETEER_SKIP_DOWNLOAD): usa
# este, apontado por CHROME_PATH.
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium fonts-liberation fonts-noto-color-emoji ca-certificates \
      libnss3 libatk-bridge2.0-0 libgtk-3-0 libxss1 libasound2 libgbm1 \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    CHROME_PATH=/usr/bin/chromium \
    PASTA_DA_SESSAO=/app/auth

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY index.js ./

# O emparelhamento fica aqui: montar um volume, senão lê-se o código a cada arranque.
VOLUME ["/app/auth"]

CMD ["node", "index.js"]
