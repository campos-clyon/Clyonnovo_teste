# A ponte do WhatsApp

O número da CLYON (931 632 622) emparelhado num servidor, a falar com o cérebro do site. Com isto, o assistente responde sozinho: recolhe pedidos de quem escreve, manda as propostas dos profissionais, fecha e marca datas — e o painel WhatsApp do backoffice continua a mandar (desligar, entregar a si, bloquear).

Não é a API oficial da Meta. É a mesma cadeia do Winapp: whatsapp-web.js a abrir o WhatsApp Web num Chromium sem janela (Puppeteer), com o emparelhamento guardado em disco e a versão da página do WhatsApp sob controlo — só que num servidor sempre ligado. Funciona com um número normal; a automação viola os termos do WhatsApp e o número pode ser bloqueado, por isso usa-se um número dedicado. A saída definitiva é a API oficial, que o site já suporta.

## Como saber em que pé está

Sem instalar nada, no navegador ou no terminal:

```bash
curl -i https://clyon.pt/api/whatsapp/ponte
```

- **503 «Ponte não configurada»** → o Vercel ainda não tem o `PONTE_WHATSAPP_SEGREDO`. Nada responde no WhatsApp, faça o que fizer no telemóvel. É o passo 2 aqui em baixo.
- **401 «Não autorizado»** → o site está pronto. Falta a ponte a correr no Railway (passo 3).
- Ligada e a correr, os logs do Railway dizem `ligado ao WhatsApp`.

## Pôr a correr no Railway (10 minutos)

1. **Um segredo.** Invente uma frase longa (ex.: 40 letras e números). Vai ser o `PONTE_WHATSAPP_SEGREDO` nos dois lados.
2. **No Vercel** (projecto clyon-site › Environment Variables): `PONTE_WHATSAPP_SEGREDO` = o segredo. Redeploy. A partir daqui o painel diz «a falar pela ponte».
3. **No Railway**: New › Deploy from GitHub repo › `campos-clyon/Clyonnovo_teste`.
   - Settings › **Root Directory**: `ponte-whatsapp`
   - Variables:
     - `SITE_URL` = `https://clyon.pt`
     - `PONTE_WHATSAPP_SEGREDO` = o segredo
     - `PONTE_NUMERO` = `351931632622`
   - Volumes › Add volume › mount path `/app/auth` (guarda a sessão; sem isto emparelha-se a cada arranque).
   - O Chromium precisa de memória: se o serviço morrer sozinho no arranque, suba o limite para 1 GB.
4. **Deploy.** Abra os logs: passados uns segundos aparece `CÓDIGO DE EMPARELHAMENTO: XXXX-XXXX`.
5. **No telemóvel do 931 632 622**: Definições › Dispositivos ligados › Ligar dispositivo › **Ligar com número de telefone** › escreva o código.
6. Nos logs aparece `ligado ao WhatsApp`. Pronto: mande uma mensagem de outro número e o assistente responde.

## O que acontece depois

- **Cliente escreve** → o site responde (assistente de recolha, ou negociação se já tem pedido).
- **Você responde à mão** (telemóvel ou WhatsApp Web) → a ponte avisa o site, que cala o cérebro nesse número. Devolve-se no painel («Devolver ao site»).
- **Bloqueado ou desligado no painel** → a ponte não envia nada a esse número.
- **A fila do painel** («Para enviar») esvazia-se sozinha: a ponte vai buscá-la a cada 5 segundos.

## Se der problemas

- `401` nos logs: os segredos não são iguais nos dois lados.
- `503`: o Vercel ainda não tem o `PONTE_WHATSAPP_SEGREDO` (ou não fez redeploy).
- `sessão terminada no telemóvel`: apague o conteúdo do volume (ou desligue o dispositivo no telemóvel) e emparelhe de novo.
- Sem `PONTE_NUMERO`, o emparelhamento é por QR nos logs — funciona, mas é mais difícil de ler.
- **As fotos deixaram de descarregar mas o texto anda**: a Meta mexeu na página do WhatsApp Web. No arranque a ponte usa a versão actual; para voltar a uma anterior, ponha `VERSAO_DA_PAGINA` com uma da lista em `versions.json` do repositório `wppconnect-team/wa-version` (ex.: `2.3000.1047094411-alpha`) e reinicie. É o mesmo botão que o Winapp tinha nas Definições.
- **`O SITE AINDA NÃO TEM O SEGREDO (503)`** nos registos: falta o passo 2. A ponte fica à espera e tenta de trinta em trinta segundos — assim que puser a variável no Vercel e fizer redeploy, ela segue sozinha, sem reiniciar nada.
