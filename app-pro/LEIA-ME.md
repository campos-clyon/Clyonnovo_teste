# CLYON Pro — a app do profissional

App nativa (Expo SDK 57, React Native, Expo Router) para os profissionais da
CLYON. Plano e decisões: «A app CLYON Pro» (relatório de 18/10/2026).

## O que faz (fase 2)

- Entrar com a conta do painel (email e palavra-passe).
- Trabalhos nos mesmos separadores do painel: Novos, Em negociação,
  Contratados, Terminados, Recusados.
- Detalhe do trabalho: aceitar, propor outro valor (com a sugestão CLYON e
  quanto recebe), recusar; trabalhos CLYON de valor fixo só aceitar/recusar.
- Avisos no telemóvel: o pedido novo e o «trabalho é seu» abrem o trabalho.
- Conta: estado, raio em km, ligar os avisos, sair.

## Uma só verdade

A app não tem base nem regras próprias. Fala só com as rotas do painel em
`clyon.pt/api/profissionais/*`, com o token no cabeçalho `Authorization`.
As regras da negociação, das taxas e dos serviços vêm directamente de
`../src/lib/` (ficheiros sem dependências — um teste do site garante-o).
Os testes da app correm com os do site: `src/lib/app-pro.test.ts`.

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

1. Uma vez: `npx eas-cli login` (conta Expo da CLYON) e `npx eas-cli init`.
2. `npx eas-cli build -p android --profile preview` — dá um link para o APK.
3. Avisos no Android: a Expo precisa das credenciais do Firebase (FCM V1) —
   `npx eas-cli credentials`, Android, «Google Service Account Key».

Para a loja: `--profile production` gera o AAB para o Play Console.

## Variáveis

- `EXPO_PUBLIC_SITE` — outro endereço do site (ex.: uma pré-visualização).
- `EXPO_PUBLIC_DEMO=1` — modo de demonstração (nunca numa build).
