# CLYON Pro — a app do profissional

App nativa (Expo SDK 57, React Native, Expo Router) para os profissionais da
CLYON. Pacote `pt.clyon.pro`, em teste fechado na Google Play. Em dia a
31-10-2026.

## O que faz

- **Entrar** com a conta do painel (email e palavra-passe), **registar-se**
  (`registo.tsx`) e repor a palavra-passe pelo link do email, que abre a app.
- **Trabalhos** (`(app)/index.tsx`): os mesmos separadores do painel — novos,
  em negociação, contratados, terminados, recusados e arquivados.
- **O trabalho** (`trabalho/[id].tsx`): aceitar, propor outro valor (com o
  valor sugerido pela CLYON e quanto recebe), recusar ou arquivar; nos
  trabalhos CLYON de valor fixo, só aceitar ou recusar; por hora, as horas e
  os materiais.
- **Contratado** (`componentes/TrabalhoContratado.tsx`): o mapa e o contacto,
  «Estou a caminho», «Estou próximo» e «Cheguei» pela ordem (o cliente
  confirma a chegada), «Está feito» sem fotografias (o cliente confirma, ou
  fica confirmado 7 dias depois), as horas feitas e avaliar o cliente.
- **Agenda** (`(app)/agenda.tsx`) e **Carteira** (`(app)/carteira.tsx`,
  `carteira/historico.tsx`): por receber, recebido e à espera, trabalho a
  trabalho, como no painel.
- **Conta** (`(app)/conta.tsx` e `conta/*`): perfil, serviços, raio em km,
  faturação, banco, avaliações, palavra-passe, como funciona, ajuda, ligar e
  desligar os avisos, sair.
- **Avisos no telemóvel**: o pedido novo e o «trabalho é seu» abrem o
  trabalho. A rota `/api/profissionais/aviso-de-teste` continua no site para
  quando for preciso provar que os avisos chegam.

## Uma só verdade

A app não tem base nem regras próprias. Fala só com as rotas do painel em
`clyon.pt/api/profissionais/*`, com o token no cabeçalho `Authorization`.
As regras da negociação, das taxas e dos serviços vêm directamente de
`../src/lib/` (ficheiros sem dependências — um teste do site garante-o).
Os testes da app correm com os do site (`src/lib/app-pro*.test.ts` e o
`orquestra.test.ts`, que também lê `app-pro/src`).

## Actualizações sem loja (EAS Update)

`runtimeVersion` por fingerprint e o canal `production` (`eas.json`). Um
EAS Update só chega a uma build com a mesma fingerprint: antes de publicar,
`npx expo-updates fingerprint:generate --platform android` em `app-pro/` tem
de dar a da build instalada (hoje `dcf63afc942dbf9bc6465f4ec788580612025532`,
desde a versão 13). Os scripts do `package.json`, o `app.json` e o fim das
linhas (CRLF/LF) entram na fingerprint: mudá-los obriga a build nova. A app
actualiza-se sozinha ao abrir e ao voltar ao primeiro plano, e espera que o
profissional saia dos ecrãs onde está a escrever (`componentes/ActualizacaoAutomatica.tsx`).

## Ver os ecrãs no computador

Modo de demonstração, com trabalhos de exemplo (o navegador não pode chamar o
clyon.pt):

```
cd app-pro
set EXPO_PUBLIC_DEMO=1&& npx expo start --web
```

## Instalar num telemóvel Android

As builds fazem-se na nuvem da Expo (EAS); este computador não precisa de
Android Studio.

1. Uma vez: `npx eas-cli login` (conta Expo da CLYON).
2. `npx eas-cli build -p android --profile preview` — dá um link para o APK.
3. Avisos no Android: a Expo precisa das credenciais do Firebase (FCM V1) —
   `npx eas-cli credentials`, Android, «Google Service Account Key».

Para a loja: `--profile production` gera o AAB para a Play Console.

## Variáveis

- `EXPO_PUBLIC_SITE` — outro endereço do site (ex.: uma pré-visualização).
- `EXPO_PUBLIC_DEMO=1` — modo de demonstração (nunca numa build).
