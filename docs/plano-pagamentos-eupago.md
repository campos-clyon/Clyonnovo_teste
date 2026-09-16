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

### 2.0 O que o contrato do euPago já respondeu *(lido a 16-09-2026)*

**O dinheiro vem todo para a CLYON, e o euPago não reparte.**

> *«Os valores devidos pelo Cliente à Eupago serão deduzidos diretamente das
> quantias cobradas aos Consumidores, no momento da sua liquidação, antes da
> transferência para a conta bancária do Cliente.»*

Não há pagamento repartido neste contrato: o euPago cobra o cliente final,
desconta a comissão dele, e transfere o líquido para **uma** conta bancária — a
da CLYON. O modelo 1 do ponto 2.1 está fora da mesa, a menos que eles tenham um
produto de marketplace que não está aqui.

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

1. ~~**Pagamento repartido no PSP**~~ — **fora**: o contrato transfere tudo para
   uma conta só, a da CLYON (ver 2.0).
2. **Em nome próprio** — a CLYON compra o serviço ao pro e vende-o ao cliente. O
   dinheiro é receita da CLYON e o pagamento ao pro é pagar a um fornecedor.
   **Colide com a facturação que já desenhámos**, em que é o profissional que
   factura o serviço ao cliente.
3. **Como agente de cobrança do profissional** — a CLYON recebe *em nome dele*.
   É o que melhor encaixa no que já está construído, mas tem de estar escrito no
   contrato do profissional e nos Termos.

**O contrato do euPago não resolve isto — sharpens.** Ele fala de *«litígios
relativos a bens e serviços»* do Cliente para com os seus *Consumidores*, ou
seja: está escrito a assumir que a CLYON vende o que cobra. Isso é o modelo 2.
Se a CLYON cobrar um serviço que o **profissional** presta e factura, está a
receber por conta de terceiro — e o contrato não contempla esse caso nem o
proíbe. Simplesmente não fala dele.

**Não sou advogado e não vou fingir que sou.** O que digo é: a escolha entre 2 e
3 tem de ser feita com o contabilista **antes** de o primeiro euro entrar, e a
resposta muda quem factura o quê — que é código que já existe e teria de mudar.
É o único ponto deste documento que pode obrigar a recomeçar.

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
| 1 | Pagamento repartido / marketplace? | ✅ **Não** — o contrato transfere tudo para uma conta. Falta só decidir o modelo 2 ou 3, e isso é com o contabilista |
| 2 | Tecto do MB WAY por operação? | ❌ por responder |
| 3 | Estorno de MB WAY pela API — total, parcial, prazo? | ❌ **bloqueia** |
| 4 | Assinatura do webhook e onde se configura o URL? | ❌ **bloqueia** |
| 5 | Sandbox com credenciais próprias? | ❌ por responder |
| 6 | *(nova)* Vão aplicar reserva de fundos? Qual a percentagem e quanto tempo? | ❌ **importa muito** — ver 2.0 |

As 3 e 4 são documentação técnica: peça-lhes o **manual da API e do webhook**, e
provavelmente vêm as duas de uma vez, com a 2 e a 5 à mistura.

A 6 é a que ninguém se lembra de perguntar e depois dói: se eles retiverem 10 %
durante 30 dias, a carteira do profissional diz «disponível» e a conta da CLYON
não tem com que pagar.

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
