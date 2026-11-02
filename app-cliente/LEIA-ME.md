# CLYON — a app de cliente

App nativa (Expo SDK 57, React Native, Expo Router), irmã da `app-pro/`.
Pacote `pt.clyon.cliente`, nome «CLYON», o «S» em fundo branco.

## Os ecrãs (versão 3, em dia a 31-10-2026)

A app abre sempre no Início, com ou sem conta. A barra de baixo é a mesma
para todos: **Início · Descobrir · Pedir · Pedidos · Perfil** (d5,
31-10-2026). Cada ecrã tem o título da sua entrada: «Descobrir» é o catálogo
dos serviços (ecrã `servicos`) e «Pedidos» é a lista dos pedidos (ecrã
`pedidos`; no Perfil, a mesma lista é «Os meus pedidos»). «Pedir» é o botão
redondo ao meio. Por cima, uma barra com a morada, as Conversas (o WhatsApp
da CLYON), a Ajuda e as Notificações.
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
| E3/E4 Pedir (uma pergunta por ecrã desde 02-11-2026, E3.F) | `src/app/(app)/pedir.tsx`, `src/componentes/NovoPedido.tsx` | R7, `POST /api/cliente/referencia` (R12, S13), `/api/maps/*`, `/api/blob/presign`, `POST /api/simulador/pedido` |
| Pedido de empresa | `src/app/empresa.tsx` | `POST /api/pedido-de-empresa` |
| E5–E10, E5M, E5A O pedido | `src/app/pedido/[id].tsx`, `src/componentes/VistaDoPedido.tsx` | R5, R8, `POST /api/pagamentos`, R13 e R14 (S17, S18) |
| E5L O pedido pelo link, sem conta | `src/app/convidado/[id].tsx`, `src/lib/convidado.ts` | R5, R8, R13, R14 com a sessão de convidado (S16) |
| As minhas avaliações (só as recebidas) | `src/app/avaliacoes.tsx`, `src/lib/avaliacoes.ts` | `GET /api/cliente/avaliacoes` |
| E11 Perfil | `src/app/(app)/perfil.tsx` | `/api/users/me`, `/api/cliente/dispositivo`, `POST /api/cliente/aviso-de-teste` (d5), `/api/cliente/carteira` e `/api/cliente/sair-de-todos` (S22) |
| E7 Pagamento | `src/app/pagar/[id].tsx`, `src/componentes/Pagar.tsx`, `src/lib/pagamento.ts` | R5, `POST /api/pagamentos` |

## Ecrãs simples (02-11-2026)

Ordem do CEO com o sim do dono: «direto ao ponto», como a Vinted.

- **Pedir**: uma pergunta por ecrã — onde é → o que é e quanto → (na mudança,
  para onde vai) → fotografias → andar e elevador (e a carrinha perto) →
  quando → contacto → resumo. Cada ecrã valida só a sua parte
  (`camposEmFaltaNoEcra`); o resumo valida tudo e mostra o preço como o
  pagamento (Serviço / IVA / Total de referência, `conta` da R12).
- **«É nesta morada?»** (1.º ecrã do Pedir): com sessão, a morada da conta
  (`/api/users/me`), a da barra de cima e as dos 3 últimos pedidos (R5), sem
  repetir, até 3, a primeira já escolhida; «Outra morada» abre a procura de
  sempre. Sem sessão ou sem morada, fica como estava. A morada usada no pedido
  não se grava na conta (`moradas-do-pedido.ts`, `lerMoradasParaOPedido`;
  testes: `src/lib/app-cliente-morada-do-pedido.test.ts`).
- **A escolha recolhida**: nas listas de escolha única do Pedir com perguntas
  a seguir no mesmo ecrã (o serviço, quanto há, o entulho, o tamanho da casa,
  o andar, o elevador, «Quando?»…), depois de escolher fica só a escolhida
  num cartão com «Mudar», e as perguntas seguintes sobem, com uma animação
  curta (`Escolhas recolher`, `EscolhaFeita`, `escolha-recolhida.ts`).
- **O calendário** («Quando?» → «Numa data à escolha»): por baixo dos dias
  rápidos, «Escolher no calendário» abre o mês (setas até ao último dia
  possível), os dias passados desligados, e depois a hora (8h00–20h00 de 30
  em 30 min, Lisboa). Os mesmos dias que os botões rápidos e a mesma
  `dataPreferida`; a hora vai na descrição («Hora preferida: …») e aparece
  no resumo. Não muda preços nem prazos. Testes:
  `src/lib/app-cliente-escolha-e-calendario.test.ts`.
- **Pagamento** (`/pagar/[id]`): o serviço e o parceiro, Serviço / IVA /
  Total a pagar (`pagamento.conta` da R5), MB WAY ou Referência Multibanco,
  «Pagar Z €». Qualquer falha diz a frase do servidor (ou a de reserva) e
  deixa «Tentar de novo» e «Pagar por Multibanco»; o MB WAY tem contagem até
  ao `expiraEm` e depois volta a «por pagar» com o bloco inteiro; «pago» só
  quando a R5 o diz. Testes: `src/lib/app-cliente-ecras-simples.test.ts`.
- **O pedido**: estado, parceiro, preço e o próximo passo; o resto («O
  trabalho e o contacto», «O valor e os itens a mais», «O que pediu», «Ajuda e
  alterações») em secções recolhidas.

## Garagem, sótão e cave (d5, 31-10-2026)

Os três perguntam o mesmo que o simulador do site: quanto há para levar (com
os nomes das faixas do site), como se chega ao espaço e, na garagem e na cave,
o que lá está. As perguntas e as linhas que cada resposta escreve na descrição
vêm já escritas da R7 (`espaco` em cada serviço, de
`src/lib/perguntas-do-espaco.ts`); a app manda à R12 o `volume`, o
`acessoDoEspaco` e o `estacionamento`, e é o site que decide o «acesso
difícil» — por isso aparece «Para o que escolheu» com o IVA ao lado, igual ao
simulador. A garagem e a cave ficam no rés-do-chão, sem a pergunta do andar, e
nenhum dos três pergunta a desmontagem. O teste de contrato
(`src/lib/app-cliente-espaco.test.ts`) passa o corpo da app pela leitura do
servidor, para cada serviço do catálogo, e compara com o simulador.

## O aviso de teste (d5, 31-10-2026)

No Perfil, com os avisos ligados, «Enviar um aviso de teste» pede ao site que
mande um aviso a este telemóvel e espera pelo recibo da Expo. Quando falha,
diz o motivo (por exemplo, a chave FCM V1 em falta no projecto clyon-cliente).

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

## Actualizações (desde 30-10-2026, a app pergunta antes)

Ao abrir e ao voltar ao primeiro plano, a app procura um EAS Update e
descarrega-o (`componentes/ActualizacaoAutomatica.tsx`, `lib/actualizacoes.ts`);
o arranque não descarrega nada sozinho (`checkAutomatically: NEVER`). Com uma
nova pronta, pergunta: «Atualizar agora» ou «Mais tarde» («Mais tarde» volta a
perguntar da próxima vez que a app abrir). No simulador, na entrada, no pedido
e nos links espera que o cliente saia do ecrã.

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
| fc977c2e (versionCode 5, 0.1.0) — `checkAutomatically: NEVER`, pergunta antes | 30-10-2026 | preview (APK) | `f387938d97375699783545363962a7181dcb263e` |
| 67b2ea5b (versionCode 7, 0.1.0) — 1.ª para a Google Play (teste fechado), commit 24d1cc1d | 01-11-2026 | production (AAB, canal `production`) | `f387938d97375699783545363962a7181dcb263e` |

A 2.ª build (A6) trouxe o `google-services.json`, o Google Sign-In ligado, o
`expo-linear-gradient` e o `expo-system-ui`. A chave de assinatura é a mesma
(SHA-256 `C5:F0:B9:…:6B:55`, a do `assetlinks.json`): nada muda no Google.
Os avisos no telemóvel só chegam depois de o dono pôr a chave FCM V1 no
projecto EAS; até lá o pedido do token falha calado.

Um EAS Update para as builds de teste: `npx eas-cli update --channel preview
--environment preview --platform android --message "…"`; para a da Play (67b2ea5b),
o mesmo com `--channel production --environment production` a partir de
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
