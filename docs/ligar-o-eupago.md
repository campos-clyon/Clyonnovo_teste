# Ligar o euPago — passo a passo

**17-09-2026.** O código está no ar e não cobra ninguém. O que falta são três
variáveis e uma configuração no backoffice do euPago.

**Quem faz o quê, e porquê:** a chave da API e o segredo do webhook vão do
backoffice do euPago para a Vercel **pelas suas mãos, sem passar por mim**. Um
segredo que atravessa uma conversa fica escrito nela para sempre. Tudo o resto
— conferir, testar, diagnosticar — faço eu, e não preciso de ver a chave para
isso: preciso que o site a tenha.

---

## Passo 0 — Decidir onde testar (2 minutos, e pode poupar uma semana)

Há duas casas do euPago, e **são contas diferentes**:

| | |
|---|---|
| `clientes.eupago.pt` | produção — dinheiro a sério |
| `sandbox.eupago.pt` | testes — dinheiro nenhum |

A sandbox tem backoffice próprio, com login próprio. O botão «Registo» que lá
está **não é auto-serviço** — é o formulário comercial do site deles.

**Faça este teste primeiro:** abra <https://sandbox.eupago.pt> e tente entrar
**com as credenciais de produção**. Muitas contas do euPago entram nas duas.

- **Se entrar** → tem sandbox hoje, sem pedir nada a ninguém. Siga com a chave
  de LÁ e `EUPAGO_AMBIENTE=sandbox`. É o caminho limpo: testa-se à vontade,
  pagar, pagar duas vezes, recusar, deixar expirar, sem um cêntimo em jogo.
- **Se não entrar** → um email ao **suporte** (`suporte@eupago.pt`, não à
  Joana — isto é técnico) a pedir acesso à sandbox do canal CLYON. E, enquanto
  não chegar, há a alternativa do Passo 5.

---

## Passo 1 — A Chave API (no backoffice do euPago)

**Gestão → Canais → Listagem de Canais**

Há um canal chamado **CLYON**. A **Chave API** está nessa listagem — tem o
aspecto `xxxx-xxxx-xxxx-xxxx-xxxx`.

Copie-a. É a mesma chave para os dois meios de pagamento, apesar de o MB WAY a
querer no cabeçalho e o Multibanco dentro do corpo do pedido.

> ⚠️ **Não me mande esta chave.** Vai directa para a Vercel no Passo 3.

---

## Passo 2 — O webhook (no mesmo backoffice)

Na mesma listagem, **Editar** o canal CLYON → secção **Webhooks 2.0**.

É o passo que mais importa: **sem webhook, um cliente paga e o site nunca sabe.**

| Campo | O que pôr | Porquê |
|---|---|---|
| **Software Integrado** | `Integração Personalizada` | Não somos WooCommerce nem Shopify |
| **Webhook Endpoint** | `https://clyon.pt/api/pagamentos/webhook` | É a rota que já está no ar |
| **Encriptar Webhook** | **Não** | O código ainda não sabe desencriptar; se estiver a Sim, ele responde 500 e diz-lho no painel |
| **Tipo de Webhook** | **Pagamento**, **Cancelamento**, **Expiração**, **Erro** e **Reembolso** | Os cinco. Um estado que não chega é um pagamento que fica pendente para sempre no ecrã do cliente |
| **Chave Criptográfica** | carregue em **«Gerar Chave Criptográfica»** e copie o resultado | É o segredo com que eles assinam cada aviso. Sem ele o site recusa tudo — e é isso que tem de fazer |

**E ainda na mesma página**, ao lado, há avisos por email por tipo. Ligue o de
**«Erro de Webhook 2.0»** para o `geral@clyon.pt`.

> Vale mais do que parece: é o único alarme que nos avisa de que o nosso
> servidor não respondeu — e chega por um canal que não depende do nosso
> servidor estar de pé.

---

## Passo 3 — As três variáveis (na Vercel)

**Projecto → Settings → Environment Variables → Add New**

| Nome | Valor |
|---|---|
| `EUPAGO_API_KEY` | a chave do Passo 1 |
| `EUPAGO_WEBHOOK_SEGREDO` | o segredo gerado no Passo 2 |
| `EUPAGO_AMBIENTE` | `sandbox` ou `producao` |

Marque os três para **Production, Preview e Development**.

> **Sobre `EUPAGO_AMBIENTE`:** se se esquecer desta variável, o código assume
> **sandbox**. É deliberado — o valor por omissão de uma variável que mexe em
> dinheiro tem de ser o que não cobra a ninguém.

### ⚠️ E depois: **Redeploy**

As variáveis da Vercel **não entram nos deploys que já existem**. Sem isto,
tudo parece configurado e nada funciona.

**Deployments → o mais recente → menu «…» → Redeploy**

---

## Passo 4 — Confirmar (no backoffice da CLYON)

**Configs → Pagamentos dos clientes**

O painel diz três coisas, e **nunca mostra a chave**:

- **Ambiente** — «sandbox» em azul, ou «PRODUÇÃO — dinheiro a sério» em
  vermelho;
- **Segredo do webhook** — «configurado» ou «EM FALTA»;
- e, se a porta estiver fechada, **porquê**.

Se disser «configurado» nos dois, está feito. **Diga-me e eu testo o resto** —
pagar, pagar duas vezes, recusar, deixar expirar, e mandar o webhook repetido,
com valor errado e fora de ordem. São os cinco casos do plano.

---

## Passo 5 — Se a sandbox não aparecer

Há uma alternativa, e é melhor do que esperar: **testar em produção com 1 €,
pago por si.**

Prova a cadeia inteira com a assinatura verdadeira e o valor verdadeiro, e
custa 1,08 €. Mas hoje não dá: em produção a porta só abre com
`A_PLATAFORMA_COBRA` ligado, e ligá-lo muda os textos do produto todo para
quem não é testador.

**Isso resolve-se com um portão de testador** — abrir a cobrança em produção só
para pedidos cujo cliente esteja na lista de testadores que a plataforma já
tem. São umas linhas, é reversível, e não muda uma palavra do que os outros
clientes vêem.

**Peça-mo se a sandbox não aparecer.** Não o fiz já para não abrir uma porta em
produção que talvez não seja necessária.

---

## O que NÃO se faz neste passo a passo

- **Não se liga `A_PLATAFORMA_COBRA`.** Enquanto for falso, todos os ecrãs
  dizem ao cliente que paga ao profissional no fim do trabalho — e é verdade.
  Liga-se depois de os cinco casos passarem.
- **Não se põe cronograma de pagamentos** (Gestão → Conta → Ficha de Conta →
  Definições). Fica para quando houver dinheiro a sair.
- **Não se manda a chave por email, por WhatsApp, nem nesta conversa.** Do
  backoffice para a Vercel, e mais nada.
