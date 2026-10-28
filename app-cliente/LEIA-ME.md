# CLYON — a app de cliente

App nativa (Expo SDK 57, React Native, Expo Router), irmã da `app-pro/`.
Pacote `pt.clyon.cliente`, nome «CLYON», o «S» em fundo branco.

## Os ecrãs

| Ecrã | Ficheiro | Rotas do site |
|---|---|---|
| E0 Boas-vindas | `src/app/bem-vindo.tsx` | `GET /api/cliente/catalogo` (frase única) |
| E1 Entrar | `src/app/entrar/index.tsx` | `POST /api/entrada/link` com `app: "cliente"` e a prova |
| E1a Confirmar a entrada | `src/app/entrar/confirmar.tsx` | `POST /api/cliente/entrar/verificar`, `POST /api/cliente/entrar` |
| E1b O link de um pedido | `src/app/pedido-do-link.tsx` | `POST /api/cliente/pedido-do-link` |
| E2 Os seus pedidos | `src/app/(app)/index.tsx` | `GET /api/cliente/pedidos` |
| E3/E4 Novo pedido | `src/componentes/NovoPedido.tsx` (`(app)/novo.tsx`, `pedir.tsx`) | `GET /api/cliente/catalogo`, `/api/maps/*`, `/api/blob/presign`, `POST /api/simulador/pedido` |
| E5–E10 O pedido | `src/app/pedido/[id].tsx` e `src/componentes/` | `GET /api/cliente/pedidos/[id]`, `POST /api/users/me/negociacao`, `POST /api/pagamentos` |
| E11 Conta | `src/app/(app)/conta.tsx` | `/api/users/me`, `/api/cliente/dispositivo` |

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

Falta, antes da 1.ª build: o projecto EAS (`projectId` e `updates.url` no
app.json), o `google-services.json` de `pt.clyon.cliente` (com
`android.googleServicesFile`) e os App Links de `pt.clyon.cliente` no
`assetlinks.json` do site.

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
