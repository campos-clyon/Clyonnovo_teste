# A CLYON vai passar a segurar o dinheiro

**16-09-2026.** *"O euPago está pronto. Vamos preparar a plataforma para
recebê-lo. Temos que ser detalhistas e meticulosos, não podemos cometer erros
nem bugs — afinal trata-se de dinheiro. Comecei a pensar em começar apenas com
o MB WAY ligado e a funcionar 100%, fazendo a ponte entre cliente e pro
correctamente. Ainda tem reembolso e disputas."*

Este documento é o que encontrei antes de escrever uma linha, e o que proponho
fazer. Não escrevi código de pagamentos: com dinheiro, a primeira coisa a fazer
é ver o buraco inteiro.

---

## 1. O que já existe, e é mais do que parece

### A plataforma inteira está construída à volta de uma cobrança que não existe

`src/lib/pagamento-na-plataforma.ts` diz-o sem rodeios:

> *A carteira do cliente dizia: «Quando aceita uma proposta, o valor fica do
> lado da CLYON.» A do profissional dizia: «Quando o cliente o contrata, paga
> logo à CLYON — e o valor fica retido.» Nenhuma das três era verdade.*

Há um interruptor só, `A_PLATAFORMA_COBRA = false`, e enquanto for falso todo o
produto descreve o que acontece mesmo. **É este o interruptor que este trabalho
vai poder ligar** — e só no fim.

O que já está modelado e passa a ser verdade nesse dia:

| Peça | Onde | Estado |
|---|---|---|
| Estados do trabalho | `trabalho.ts` — `execucaoEnviadaEm`, `confirmadoEm`, `pagoEm` | Funciona |
| Carteira do pro | `carteira.ts` — cativo / disponível / a caminho / levantado | Calculada, sem dinheiro |
| Libertação automática | `estaLibertado()` — o prazo liberta sem ninguém confirmar | Funciona |
| Comissão por negociação | `taxaCliente` / `taxaProfissional`, presas ao nascimento | Feito a 15-09 |
| Conta do cliente | `contaDoCliente()` — serviço + taxa + os dois IVAs | Funciona |
| Levantamentos | `levantamentos` — o pro pede, a CLYON transfere à mão | Funciona |
| IBAN e MB WAY do pro | `providers.iban`, `ibanTitular`, `mbway` | Recolhidos |

### O euPago já está no repositório — mas é de outro produto

`app-clyon/creditos`, `app-clyon/referencias`, `app-clyon/pedidos/[id]/ops`
falam de euPago, MB WAY, Multibanco, comissão e webhook. **Mas isso é a App
CLYON**, cujo backend é Supabase: este repositório só *lê* as linhas que a app
escreveu. Não há aqui nenhuma chamada de saída para o euPago, nenhum webhook,
nenhuma assinatura verificada.

Ou seja: para a plataforma, a integração é **de raiz**. O que se aproveita é a
experiência (o que correu bem e mal na app) e os ecrãs de consulta como
referência de desenho.

### Reembolsos e disputas também já existem — na App CLYON

`in_dispute`, `creditos/acoes` («acerto depois de uma disputa»),
`app-clyon/pagamentos`. **Na plataforma não existe nenhum dos dois conceitos.**
Nem uma coluna, nem um estado, nem um ecrã.

---

## 2. Os cinco riscos, por ordem de gravidade

### 2.0 O que o contrato e a documentação técnica responderam *(16-09-2026)*

> **Correcção do que eu próprio escrevi há uma hora.** Com base só no contrato,
> dei o pagamento repartido como «fora da mesa». **Está errado: o euPago tem
> Split Payments.** O contrato não o menciona — a documentação técnica sim. Foi
> o link que ele mandou que o mostrou, e muda a decisão mais importante deste
> plano. Fica aqui em vez de ser apagado, porque o erro foi ler um contrato
> comercial como se fosse a lista de produtos.

#### ✅ SPLIT PAYMENTS EXISTE — e reabre o modelo mais limpo

<https://eupago.readme.io/reference/split-payments>

Uma referência de pagamento repartida por vários beneficiários, para Multibanco,
MB WAY, Pix, Apple Pay e Google Pay:

```
amount            o total que o cliente paga
identifier        o nosso identificador
adminCallback     o URL do webhook
alias             o telemóvel (só MB WAY)
beneficiaries[]   externKey  (obrigatório) — a chave do beneficiário
                  amount     (obrigatório) — quanto vai para ele
                  identifier
                  immediatePayment — se lhe é pago já
```

**Isto resolve o ponto 2.1 pela raiz**: o euPago paga ao profissional
directamente, e a CLYON nunca segura dinheiro dele. A pergunta regulatória
deixa de se pôr, porque deixa de haver dinheiro de terceiros nas nossas mãos.

**Tem um preço, e é real:** cada beneficiário precisa de uma `externKey`, que
não é a nossa API Key e se obtém em <suporte@eupago.pt>. Ou seja: **cada
profissional tem de ser registado no euPago.** É trabalho de inscrição — e é o
mesmo que o Stripe Connect faz, pela mesma razão legal.

E o `immediatePayment` é exactamente o botão da caução: repartir o pagamento
mas **não** pagar ao profissional já, e libertar quando o cliente confirmar.
*Falta confirmar como se dispara essa libertação — não vem na página.*

#### ✅ Reembolso: existe, e é parcial

<https://eupago.readme.io/reference/refund> — `POST /api/management/v1.02/refund/{trid}`

> *«Accepts partial and total amount refunds.»* · *«For MB WAY and Credit Card
> transactions, is not mandatory to fill IBAN and BIC params.»*

Campos: `amount`, `trid`, e opcionais `iban`, `bic`, `reason`. **Sem prazo
limite documentado.** ⚠️ Atenção a uma diferença que parte integrações: o
reembolso usa **OAuth Bearer token**, e a criação de pagamentos usa
**`Authorization: ApiKey …`**. São dois mecanismos e dois caminhos de erro.

#### ✅ Webhook: HMAC SHA-256, e as retentativas escritas

<https://eupago.readme.io/reference/realtime-webhooks-20>

- POST em JSON, com `transactions` (entity, reference, identifier, method,
  amount, fees, date, **trid**, status), `channel` e `data`;
- **`X-Signature`** — HMAC SHA-256. Encriptação AES-256-CBC opcional, com o IV
  em `X-Initialization-Vector`;
- retentativas **de 2 em 2 minutos, 3 vezes; depois de hora a hora, 24 horas**;
- espera **HTTP 200** para dar a comunicação por entregue.

**Não há chave de idempotência.** Fazemo-la nós, com o `trid` — uma coluna
única na base, não um `if` no código.

E as retentativas explicam a defesa que o ponto 2.3 pedia: se o nosso servidor
estiver em baixo dez minutos, o euPago volta. Se estiver em baixo mais do que
24 horas, não volta — e é para esse caso que a sondagem de recurso existe.

#### ✅ Sandbox e produção

`https://sandbox.eupago.pt/api/…` — e para produção *«replace the word
'sandbox' with 'clientes'»*. Chave em **Canais → Channel Listing**, no menu que
ele já tem aberto.

#### ✅ O tecto do MB WAY: 99 999 € — eu tinha exagerado

A página do MB WAY diz **«Montante máximo: 99 999€»**. O tecto do euPago não é
problema nenhum. **O que continua a valer é o limite do banco de QUEM PAGA**, e
esse não está na nossa mão — mas é o banco dele que lho diz, e a mensagem de
erro tem de o repetir sem inventar.

#### ⚠️ `mbway/authorize` + `mbway/capture` NÃO servem de caução

Existem, e à primeira vista pareciam a peça perfeita: autorizar agora, capturar
quando o trabalho estiver feito. **Não são isso.** As duas páginas dizem a mesma
frase — *«o cliente tem 5 minutos para executar o pagamento»* — e cinco minutos
não é uma semana. Vale a pena perguntar, mas não conto com isto.

#### ⚠️ `payouts` é só de consulta

`GET /api/management/v1.02/payouts?start_date&end_date` lista os pagamentos
feitos. **Não envia dinheiro.** O pagamento ao profissional continua a ser
transferência à mão — a menos que o Split Payments o faça por nós, que é mais
uma razão para ir por aí.

**E o euPago afasta-se explicitamente da relação com o cliente final:**

> *«A Eupago não intervirá, direta ou indiretamente, na relação contratual
> estabelecida entre o Cliente e os seus Consumidores»* · *«Assumir a
> responsabilidade exclusiva por litígios relativos a bens e serviços»*

Ou seja: **toda a disputa é da CLYON**. O euPago processa e mais nada.

**Três obrigações que entram no produto, e não são opcionais:**

1. Dizer aos clientes, nas comunicações, que **os pagamentos são processados
   pelo euPago**. Vai ao ecrã de pagamento e aos Termos.
2. Comunicar qualquer operação não autorizada **em 2 dias úteis**. Passado
   esse prazo o euPago não responde por ela — o que faz da reconciliação
   diária uma obrigação contratual e não uma boa prática.
3. Reclamações podem ir ao **Banco de Portugal** (supervisor do euPago) e a
   entidades de RAL (CNIACC, CICAP).

**⚠️ E uma cláusula que pode prender dinheiro nosso — «Reserva de fundos»:**

> *«A Eupago poderá (…) reter temporariamente parte dos montantes recebidos a
> favor do Cliente, a título de reserva de fundos (…) para assegurar o
> cumprimento (…) de pedidos de reembolso, estornos ou casos de fraude.»* E se
> os reembolsos passarem um limite: *«suspender ou limitar a prestação dos
> serviços; exigir garantias adicionais.»*

Isto importa muito: **a carteira do profissional pode dizer «disponível» e o
dinheiro não estar na conta da CLYON.** O livro de movimentos (ponto 2.4) tem de
saber distinguir *o que é dele* de *o que já cá está* — senão prometemos um
levantamento que não podemos pagar.

#### O preço, e uma conclusão que não esperava

| Método | Custo (sem IVA) |
|---|---|
| MB WAY | 0,07 € + **0,70 %** |
| Multibanco | **0,66 €** fixo |
| Payshop | 0,81 € fixo |
| Anuidade | 0 € |

O MB WAY é percentual e o Multibanco é fixo, e **cruzam-se aos 84,29 €**. Acima
disso o Multibanco é mais barato para nós — e quase todos os trabalhos estão
acima:

| Cliente paga | MB WAY | Multibanco | Diferença |
|---|---|---|---|
| 100 € | 0,77 € | 0,66 € | 0,11 € |
| 318 € | 2,30 € | 0,66 € | **1,64 €** |
| 500 € | 3,57 € | 0,66 € | **2,91 €** |
| 1 000 € | 7,07 € | 0,66 € | **6,41 €** |

Num trabalho de 300 € com um profissional isento, o cliente paga 318,45 € e a
comissão da CLYON é 33 €. O MB WAY leva 2,30 € — **7 % da nossa comissão**. O
Multibanco levaria 0,66 €, ou 2 %.

**Não muda a decisão de começar pelo MB WAY** — é instantâneo, o cliente confirma
no telemóvel em segundos, e a referência Multibanco pode ficar dois dias por
pagar com o profissional à espera. A rapidez vale o 1,64 €. Mas é bom saber que
a escolha tem preço, e que a 100 trabalhos por mês são ~164 €.

E note-se: **a comissão é sobre o valor TODO**, incluindo a parte que é do
profissional. É um custo próprio do modelo de caução que não existiria se o
cliente lhe pagasse directamente.

### 2.1 ⚠️ Quem pode segurar dinheiro de outra pessoa — a pergunta que não é técnica

Se o cliente paga 300 € à CLYON e a CLYON paga 282 € ao profissional daqui a uma
semana, **a CLYON está a guardar dinheiro de terceiros**. Na UE isso é
actividade regulada (instituição de pagamento / moeda electrónica), e não é uma
formalidade.

Os mercados resolvem-no de três maneiras:

1. ✅ **Pagamento repartido no PSP** — **existe** (ver 2.0). O euPago paga ao
   profissional directamente; a CLYON nunca toca no dinheiro dele. Custa uma
   `externKey` por profissional, ou seja, inscrevê-los no euPago.
2. **Em nome próprio** — a CLYON compra o serviço ao pro e vende-o ao cliente. O
   dinheiro é receita da CLYON e o pagamento ao pro é pagar a um fornecedor.
   **Colide com a facturação que já desenhámos**, em que é o profissional que
   factura o serviço ao cliente.
3. **Como agente de cobrança do profissional** — a CLYON recebe *em nome dele*.
   Não exige nada ao euPago, mas tem de estar escrito no contrato do
   profissional e nos Termos — e é a hipótese que o contrato do euPago **não
   contempla**, porque está escrito a assumir que a CLYON vende o que cobra
   (*«litígios relativos a bens e serviços»*).

**A minha recomendação é o 1**, e com convicção: é o único em que a pergunta
regulatória deixa de existir em vez de ser respondida. O 3 obriga a defender uma
posição jurídica; o 1 dispensa-a. O preço — inscrever cada profissional — é
trabalho de uma vez por profissional e é exactamente o que o Stripe Connect faz.

**Não sou advogado e não vou fingir que sou.** Mas a diferença entre os dois
primeiros é grande: no 1, a CLYON nunca segura dinheiro de ninguém; no 2 e no 3,
segura. Se o euPago confirmar o Split Payments para o nosso caso, não vejo razão
para escolher outro.

### 2.2 O limite do MB WAY parte os trabalhos grandes

O MB WAY tem tectos por operação e por dia, do banco de quem paga — tipicamente
na ordem das centenas de euros. **Um esvaziamento de casa de 1 200 € pode
simplesmente não caber numa operação.**

Começar só com MB WAY é a decisão certa para aprender com risco pequeno, mas o
ecrã tem de saber falhar: quando o MB WAY recusa por limite, a resposta ao
cliente não pode ser «erro» — tem de ser *«o seu banco não deixa passar este
valor de uma vez»* e oferecer a referência Multibanco, que já está activa na
conta.

*Confirmar com o euPago qual é o tecto que eles aplicam.*

### 2.3 O webhook é a única fonte da verdade, e não é de confiar

Três coisas acontecem sempre, mais cedo ou mais tarde:

- **chega duas vezes** — e um pedido pago duas vezes credita a dobrar;
- **chega fora de ordem** — a confirmação antes da criação;
- **não chega** — e o cliente pagou, e o ecrã diz que não.

As três defesas, e não são opcionais: **idempotência** (uma referência só pode
ser aplicada uma vez, garantida pela base e não pelo código), **assinatura
verificada** (senão qualquer pessoa credita a carteira que quiser), e **uma
sondagem de recurso** que pergunta ao euPago o estado do que ficou pendente há
mais de N minutos.

### 2.4 Não há livro de movimentos — e sem ele não há reconciliação

A carteira de hoje é **calculada** a partir das linhas de `negociacoes`. Isso
chegava enquanto era uma promessa. Com dinheiro a sério, não chega:

- não dá para responder «porque é que o saldo dele é 282 e não 300»;
- não dá para comparar o nosso total com o saldo no euPago;
- um reembolso parcial não tem onde ser escrito.

**É a decisão de arquitectura mais importante deste trabalho:** uma tabela de
movimentos imutável — entrada, saída, comissão, reembolso —, cada linha com a
referência do euPago, e o saldo a ser a *soma* dela. A carteira actual passa a
ser uma leitura desse livro.

### 2.5 A libertação automática paga um trabalho em disputa

`estaLibertado()` liberta pelo prazo, sem ninguém confirmar. Hoje não custa
nada. No dia em que houver dinheiro, **um cliente que abra uma disputa ao
sétimo dia vê o dinheiro sair ao oitavo.** Uma disputa aberta tem de congelar o
prazo — e isso é uma linha na regra, não um ecrã.

---

## 3. O que proponho, por fases

Cada fase acaba com uma coisa que funciona e é verificável. Nenhuma liga o
`A_PLATAFORMA_COBRA`.

### Fase 0 — Perguntas antes de código *(sua, com o euPago)*

| # | Pergunta | Estado |
|---|---|---|
| 1 | Pagamento repartido / marketplace? | ✅ **Existe** — Split Payments |
| 2 | Tecto do MB WAY por operação? | ✅ **99 999 €** no euPago; o limite real é o do banco de quem paga |
| 3 | Estorno de MB WAY pela API? | ✅ **Sim, parcial e total**, sem prazo documentado |
| 4 | Assinatura do webhook? | ✅ **`X-Signature`, HMAC SHA-256** |
| 5 | Sandbox? | ✅ `sandbox.eupago.pt` |

**Ficam quatro, e são todas de e-mail para <suporte@eupago.pt>:**

| # | Pergunta | Porque importa |
|---|---|---|
| 6 | Como se obtém a **`externKey`** de cada profissional? Que documentos, e quanto demora? | Decide se o modelo 1 é praticável. Se for uma semana por profissional, não é |
| 7 | Com `immediatePayment: false`, **como se liberta** depois o dinheiro do beneficiário? Por API? Quanto tempo pode ficar retido? | É a caução inteira. Sem isto, o Split resolve o regulatório mas não o prazo de confirmação |
| 8 | Vão aplicar **reserva de fundos**? Qual percentagem, quanto tempo? | Ver 2.0 — a carteira pode dizer «disponível» e não haver com que pagar |
| 9 | Onde se põe o **segredo do HMAC** do webhook, e qual é a string exacta que é assinada? | Sem isto não se valida a assinatura, e um webhook que não se valida é uma porta aberta para creditar carteiras |

A **7** é a que decide o desenho. As outras três resolvem-se com uma resposta
qualquer.

*Perguntas 1 a 5 respondidas pela documentação em
<https://eupago.readme.io> — não foi preciso perguntar a ninguém.*

### Fase 1 — O livro de movimentos, sem cobrar nada

A tabela de movimentos, as funções de escrita, e a carteira a passar a ler
dela. Escreve-se **a partir do que já existe** — cada trabalho confirmado gera
as linhas que teria gerado. Verificação: a carteira de cada profissional dá
exactamente o mesmo número de hoje, ao cêntimo, para todos os profissionais.

*Nada muda para ninguém. É a fundação.*

### Fase 2 — O euPago em sandbox, a receber

Cliente fecha → pedido de MB WAY → o cliente confirma no telemóvel → webhook →
movimento de entrada. Com idempotência, assinatura e sondagem de recurso.
Verificação: em sandbox, pagar, pagar duas vezes, recusar, deixar expirar, e
mandar o webhook à mão duas vezes — e o livro fica certo nos cinco casos.

### Fase 3 — Reembolso e disputa

O botão de reembolso (total e parcial) no backoffice, com motivo e registo. A
disputa como estado que **congela o prazo** e impede a libertação. Ecrã igual
para os três lados — cliente, profissional e CLYON a ver o mesmo estado, que é
o que pediu com *«tudo na mesma página»*.

### Fase 4 — O pagamento ao profissional

Hoje é manual: ele pede, alguém transfere, alguém marca. Pode continuar assim
no início — **e talvez deva**, porque é a última porta antes de o dinheiro sair
e um humano a olhar vale muito no primeiro mês. Automatiza-se depois.

### Fase 5 — Ligar

`A_PLATAFORMA_COBRA = true`, com um profissional e um cliente reais, num
trabalho pequeno, combinado ao telefone com os dois. E a reconciliação a correr
todos os dias.

---

## 4. O que preciso de si

**Agora:**
- as cinco respostas da Fase 0 (as três primeiras são as que bloqueiam);
- as credenciais de sandbox do euPago, se houver.

**Antes da Fase 5:**
- os Termos e o contrato do profissional a dizerem o que o ponto 2.1 exigir;
- confirmação do contabilista sobre quem factura o quê.

**Uma coisa que lhe peço que não faça:** não ligue o `A_PLATAFORMA_COBRA`
enquanto as fases não estiverem feitas. Ele existe para ser ligado uma vez, e
ligá-lo cedo põe a plataforma inteira a prometer uma caução que ainda não
segura ninguém.

---

## 5. O que não vou fazer sem lhe perguntar

- mexer em `taxas-plataforma.ts` além de ler;
- mexer em `pricing-helper.ts`, `auth.ts` ou na autenticação do middleware;
- tocar no App CLYON. Tem o backend dele e um dono diferente deste código;
- apagar ou alterar uma linha de `negociacoes` para «corrigir» um saldo. Se um
  número estiver errado, a correcção é um movimento novo — nunca uma linha
  reescrita.
