# CLYON — a app de cliente

App nativa (Expo SDK 57, React Native, Expo Router), irmã da `app-pro/`.
Pacote `pt.clyon.cliente`, nome «CLYON», o «S» em fundo branco.

## O que faz agora

- Entrar (E1): link de entrada por email (`POST /api/entrada/link`); o link
  `https://clyon.pt/entrar/link?t=…` abre `src/app/entrar/link.tsx`, que o
  troca por uma sessão em `POST /api/cliente/entrar`.
- O token fica no cofre do telemóvel (`expo-secure-store`) e vai em
  `Authorization: Bearer`. A cada abertura, `POST /api/cliente/sessao` com o
  cabeçalho `x-app-versao`. Qualquer 401 apaga o token e volta ao Entrar.
- O botão do Google fica escondido (`GOOGLE_NESTA_VERSAO`) até haver o cliente
  OAuth Android de `pt.clyon.cliente`.

Ainda sem EAS, sem build e sem loja.

## Uma só verdade

Sem base nem regras próprias: tudo vem das rotas de clyon.pt. Nenhum preço,
taxa ou IVA escrito na app; datas sempre na hora de Lisboa. Os testes correm
com os do site: `src/lib/app-cliente.test.ts` (e o `orquestra.test.ts`, que
também lê `app-cliente/src`).

## No computador

```
cd app-cliente
npm install
npx tsc --noEmit
npx expo start
```
