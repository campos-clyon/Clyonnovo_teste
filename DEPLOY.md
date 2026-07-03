# Publicacao do site CLYON

## O que enviar para o servidor

Envie esta pasta do projeto:

- `src`
- `public`
- `drizzle`
- `patches`
- `package.json`
- `pnpm-lock.yaml`
- `next.config.ts`
- `tsconfig.json`
- `postcss.config.mjs`
- `tailwind.config.ts`
- `drizzle.config.ts`
- `components.json`
- `next-env.d.ts`
- `.env` ou `.env.local` com base em `.env.example`

Nao precisa enviar:

- `node_modules`
- `.next`
- `.manus`
- `.manus-logs`
- `client_old_vite`
- `tsconfig.tsbuildinfo`
- `package.json.bak`

## Variaveis obrigatorias

Copie `.env.example` para `.env` e preencha pelo menos:

- `GOOGLE_MAPS_API_KEY`
- `DATABASE_URL`
- `JWT_SECRET`

Se for usar as areas internas com OAuth, preencha tambem:

- `NEXT_PUBLIC_APP_ID`
- `OAUTH_SERVER_URL`
- `NEXT_PUBLIC_OAUTH_PORTAL_URL`

## Comandos de publicacao

```bash
pnpm install
pnpm build
pnpm start
```

## Observacoes

- O simulador com sugestoes de morada e calculo de distancia precisa da chave Google Maps.
- O dominio canonico do projeto deve ser `https://clyon.pt`.
- Se o servidor for Node.js, basta instalar dependencias e arrancar com `pnpm start`.
