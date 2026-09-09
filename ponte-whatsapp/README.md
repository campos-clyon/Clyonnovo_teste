# A ponte do WhatsApp

O número da CLYON (931 632 622) emparelhado num servidor, a falar com o cérebro do site. Com isto, o assistente responde sozinho: recolhe pedidos de quem escreve, manda as propostas dos profissionais, fecha e marca datas — e o painel WhatsApp do backoffice continua a mandar (desligar, entregar a si, bloquear).

Não é a API oficial da Meta. Usa o protocolo do WhatsApp Web (biblioteca Baileys), como mais um «dispositivo ligado» do telemóvel. Funciona com um número normal, sem conta de empresa. A Meta pode um dia recusar; a saída definitiva é a API oficial, que o site já suporta.

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
