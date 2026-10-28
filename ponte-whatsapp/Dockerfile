# A ponte do WhatsApp: whatsapp-web.js a conduzir um Chromium sem janela.
# Node 22: o puppeteer 25 (forçado no package.json, «overrides») só corre a
# partir do Node 22.12. A mesma Debian (bookworm), por isso o Chromium e as
# bibliotecas de baixo são os mesmos de antes.
FROM node:22-bookworm-slim

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
# As versões estão fixas no package-lock.json: o npm ci instala exactamente
# essas e falha se o package.json e o lock não baterem certo. Subir uma
# versão é um commit ao lock, nunca uma surpresa num deploy.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY index.js ./

# O emparelhamento fica em /app/auth. O volume monta-se no painel do Railway,
# que recusa a instrução VOLUME aqui dentro ("use Railway Volumes"). Sem esse
# volume, lê-se o código de emparelhamento a cada arranque.

# A porta do estado. Ver o servidor http no index.js: a raiz responde sempre
# 200 (o contentor subiu) e /pronto diz se ela esta mesmo a trabalhar.
EXPOSE 8080

CMD ["node", "index.js"]
