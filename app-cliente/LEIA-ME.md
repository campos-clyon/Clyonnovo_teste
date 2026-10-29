# CLYON — a app de cliente

App nativa (Expo SDK 57, React Native, Expo Router), irmã da `app-pro/`.
Pacote `pt.clyon.cliente`, nome «CLYON», o «S» em fundo branco.

## Os ecrãs (versão 3, 29-10-2026)

A app abre sempre no Início, com ou sem conta. Os separadores são os mesmos
para todos: **Início · Serviços · Pedir · Pedidos · Perfil** (escolha do dono).
A conta só se pede para enviar um pedido, e o rascunho não se perde.

| Ecrã | Ficheiro | Rotas do site |
|---|---|---|
| E0 Início | `src/app/(app)/index.tsx` | `GET /api/cliente/catalogo` (R7 v2) |
| Serviços | `src/app/(app)/servicos.tsx`, `src/componentes/Servicos.tsx` | R7 v2 |
| I1–I6 Informação útil | `src/app/info/[tema].tsx` | R7 v2 |
| E1 Entrar | `src/app/entrar/index.tsx`, `src/componentes/Entrada.tsx`, `src/lib/google.ts` | `POST /api/entrada/link`, `POST /api/cliente/entrar` (`{ google }`) |
| E1a Confirmar a entrada | `src/app/entrar/confirmar.tsx` | `POST /api/cliente/entrar/verificar`, `POST /api/cliente/entrar` |
| E1b O link de um pedido | `src/app/pedido-do-link.tsx` | `POST /api/cliente/pedido-do-link` (R10 v3 sem conta: S16) |
| E2 Pedidos / E2c sem conta | `src/app/(app)/pedidos.tsx` | `GET /api/cliente/pedidos` |
| E3/E4 Pedir (3 passos, E3.F) | `src/app/(app)/pedir.tsx`, `src/componentes/NovoPedido.tsx` | R7, `POST /api/cliente/referencia` (R12, S13), `/api/maps/*`, `/api/blob/presign`, `POST /api/simulador/pedido` |
| Pedido de empresa | `src/app/empresa.tsx` | `POST /api/pedido-de-empresa` |
| E5–E10, E5M, E5A O pedido | `src/app/pedido/[id].tsx`, `src/componentes/VistaDoPedido.tsx` | R5, R8, `POST /api/pagamentos`, R13 e R14 (S17, S18) |
| E5L O pedido pelo link, sem conta | `src/app/convidado/[id].tsx`, `src/lib/convidado.ts` | R5, R8, R13, R14 com a sessão de convidado (S16) |
| E11 Perfil | `src/app/(app)/perfil.tsx` | `/api/users/me`, `/api/cliente/dispositivo`, `/api/cliente/carteira` e `/api/cliente/sair-de-todos` (S22) |

O que vem das rotas novas do Site (S12–S22) lê-se com tolerância à forma
(`src/lib/catalogo.ts`, os tipos `…V3` de `src/lib/pedidos.ts`): o que não vier
não aparece. Afinar a forma é JavaScript — chega por EAS Update.

## O pedido pelo link sem conta (A9, liga-se com a S16)

Regras da Segurança (D3, 29-10-2026): o convidado tem um código do aparelho
próprio (`clyon-cliente-convidado`, separado do da entrada), a sessão de
convidado vive no cofre com o pedido a que pertence (nunca mais de 30 dias), e
vai com o cabeçalho `x-codigo-do-aparelho`. Sem conta não se paga; só se
alteram os campos da lista fechada; pormenores até 1000 caracteres; datas de
amanhã a 180 dias.

## A entrada pelo link

- O link pedido na app fica preso a este telemóvel: um código do aparelho
  (32 bytes, no cofre) e, no pedido do link, só o SHA-256 dele (`entrada.ts`,
  `codigo-do-aparelho.ts`).
- O link do email abre o E1a, que pergunta de quem é a conta sem gastar o
  link, e só entra depois de um toque em «Entrar» (ou «Trocar de conta»).
- Só `https://clyon.pt/entrar/app?t=…` e `https://clyon.pt/pedido/<token>`
  chegam aos ecrãs de link (`+native-intent.tsx`, `links.ts`); o token fica na
  memória, nunca no caminho nem no telemóvel. `clyoncliente://…` vai para o
  início.

## Actualizações sem loja

`runtimeVersion` por fingerprint e os canais `preview`/`production` no
`eas.json`. Os scripts do `package.json` e os ficheiros em LF entram na
fingerprint: não se mudam depois da 1.ª build (`.gitattributes`). Antes de
cada EAS Update, `npm run fingerprint` tem de dar a fingerprint da build.

| Build | Data | Perfil | Fingerprint (Android) |
|---|---|---|---|
| 3879f098 (versionCode 2, 0.1.0) | 29-10-2026 | preview (APK) | `e2dc72ccdd7fe0c4e354bca4f06245d474caca53` |
| 3d8de466 (versionCode 3, 0.1.0) — 2.ª build, v3 | 29-10-2026 | preview (APK) | `cd052f69541b4d8bb03af6ddd67af521f4d3b86e` |

A 2.ª build (A6) trouxe o `google-services.json`, o Google Sign-In ligado, o
`expo-linear-gradient` e o `expo-system-ui`. A chave de assinatura é a mesma
(SHA-256 `C5:F0:B9:…:6B:55`, a do `assetlinks.json`): nada muda no Google.
Os avisos no telemóvel só chegam depois de o dono pôr a chave FCM V1 no
projecto EAS; até lá o pedido do token falha calado.

Um EAS Update para esta build: `npx eas-cli update --channel preview
--environment preview --platform android --message "…"` a partir de
`app-cliente/`, só depois de o `npm run fingerprint` dar a mesma fingerprint.

Projecto EAS: `@wandersonclyon/clyon-cliente` (29-10-2026; `projectId` e
`updates.url` no app.json). A chave de assinatura Android é a da EAS desse
projecto, e a sua impressão SHA-256 está no `assetlinks.json` do site
(`IMPRESSOES_DA_APP_CLIENTE` em `src/lib/links-da-app.ts`).

A 1.ª build saiu sem o `google-services.json`; a 2.ª já o traz (ver acima).

## Uma só verdade

Sem base nem regras próprias: tudo vem das rotas de clyon.pt. Nenhum preço,
taxa ou IVA escrito na app; datas sempre na hora de Lisboa; a ordem das listas
é a da API. Os testes correm com os do site: `src/lib/app-cliente.test.ts`,
`src/lib/app-cliente-fase-2.test.ts` (e o `orquestra.test.ts`, que também lê
`app-cliente/src`).

## No computador

```
cd app-cliente
npm install
npx tsc --noEmit
npm test
npx expo start
```
