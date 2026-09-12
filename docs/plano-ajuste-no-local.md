# O ajuste no local — plano

*13-09-2026*

> «O cliente disse que tinha 20 sacos de entulho mas chegou lá tinha 50. O pro
> deve ter a opção de pedir a atualização do valor ou ajuste, e o cliente deve
> fazer a aprovação desse ajuste.»

---

## 1. O que isto é, e o que não é

O negócio já se faz assim: o profissional chega, vê o que é mesmo, e fala com o
cliente **ali, de viva voz**. Isso não muda e não deve mudar — nenhum ecrã
resolve uma conversa de dois minutos à porta de uma garagem.

O que falta não é um sítio para negociar. É um sítio para **ficar escrito o que
eles combinaram**, antes de o trabalho ser feito, com o cliente a carregar num
botão a dizer que sim.

Hoje não existe. Existem três saídas, e as três são más:

| O que acontece hoje | O que corre mal |
|---|---|
| O pro faz pelo valor antigo | Trabalha 50 sacos ao preço de 20. Faz uma vez, não faz duas — e deixa a plataforma. |
| Combinam por fora e o cliente paga a diferença em mão | Sai da carteira, sai das contas, sai do IVA. A CLYON não viu nada e não cobra nada. |
| Ligam à CLYON e um assistente corrige no painel | Funciona, mas só em horário de expediente e só se alguém atender. O pro fica à espera com a carrinha parada. |

Este plano trata da terceira: **o que o assistente faz ao telefone, passa a
poder ser feito pelos dois, no local, em trinta segundos.** A rota do painel
fica na mesma, como rede de segurança.

---

## 2. A decisão de fundo: não é uma proposta

Havia duas hipóteses. Registo a que foi posta de lado e porquê.

**Reabrir a negociação** — pôr o motor de `negociacao.ts` a aceitar propostas
outra vez depois de `acordada`. **Não.**

- O motor é de *antes* do aperto de mão: cinco propostas por lado, 48 horas
  para responder, um de cada vez. Um prazo de 48 horas não significa nada com
  uma carrinha à porta.
- Reabrir deixava o profissional voltar a leiloar um trabalho que já é dele.
- Os estados `aberta → aguarda_contratacao → acordada` são lidos por meia dúzia
  de sítios (`assistente-categorias.ts`, `Trabalhos.tsx`,
  `PropostasRecebidas.tsx`, `faseDoTrabalho`). Um estado novo no meio parte
  todos.

**Um objecto novo, à parte.** É a hipótese boa, e já há precedente: a correcção
de valor do painel (`/api/admin/negociacoes/valor`) também não é uma proposta —
é uma rota própria, que escreve `valorAcordado` e regista porquê. O ajuste no
local é a **mesma operação, pedida pelo profissional e autorizada pelo
cliente** em vez de escrita por um assistente.

---

## 3. Onde vive

`ajustesJson LONGTEXT NULL` na tabela `negociacoes` — ao lado de `propostasJson`
e `provaJson`, que já guardam listas exactamente assim. Sem tabela nova, sem
índice novo, sem *join* novo.

A regra vive num módulo puro, `src/lib/ajuste-no-local.ts`, sem base de dados lá
dentro — como `negociacao.ts` e `trabalho.ts`. É o que permite testá-lo todo
sem MySQL.

```ts
export type EstadoDoAjuste = "pendente" | "aprovado" | "recusado" | "expirado";

export type Ajuste = {
  pedidoEm: Date | string;
  valorNovo: number;      // a BASE, sem IVA — o mesmo que valorAcordado
  valorAntigo: number;    // o que estava acordado quando se pediu
  motivo: string;         // nas palavras do profissional, obrigatório
  fotos: string[];        // as URLs; obrigatório quando sobe
  estado: EstadoDoAjuste;
  respondidoEm?: Date | string | null;
  respondidoPor?: "cliente" | "clyon" | null;
  notaDoCliente?: string | null;
};
```

**Um número só continua a mandar.** Aprovar escreve `valorAcordado` e mais nada.
Quanto o profissional recebe, quanto o cliente paga, o IVA e a comissão saem
todos daí — como já saem hoje. Nunca se gravam quatro números para depois
discordarem uns dos outros.

---

## 4. Quando o profissional pode pedir

**Só em `fase === "a_executar"`.** Ou seja: depois de o cliente contratar e
antes de ele marcar «está feito».

- Antes do aperto de mão não faz sentido — aí o valor muda-se propondo, que é o
  que a negociação é.
- **Depois de mandar a prova, não.** Quem já fotografou o trabalho pronto e
  disse «está feito» não pode a seguir levantar o preço: isso é o cliente refém
  do trabalho já feito. Se houve mesmo engano, existe a rota do painel e uma
  pessoa a olhar para o caso.

Mais dois travões:

- **Um pedido aberto de cada vez.** Segundo pedido com um por responder: não.
- **No máximo dois por trabalho.** Ao terceiro já não é um ajuste, é outro
  orçamento — e deve passar pela CLYON.

---

## 5. O que o profissional vê

Em `src/app/profissionais/painel/Trabalhos.tsx`, dentro do bloco que já existe
para `a_executar` (onde hoje está «Quando estiver feito»), uma secção nova
**acima** dessa:

> ### O que está aqui não é o que foi dito?
>
> **Ligue-lhe primeiro.** Isto é para ficar escrito o que combinarem — não
> substitui a conversa.  `[ Ligar ao cliente ]`
>
> Valor combinado: **135,00 €**
> Valor que vai ficar: `[ ______ ]` €
> O que mudou: `[ «Estavam 50 sacos, não 20. Contei-os um a um.» ]`
> Fotografe o que encontrou  `[ Fotografar ]`  ← obrigatório
>
> `[ Pedir o ajuste ao cliente ]`

**As fotografias são obrigatórias quando o valor sobe**, e são a peça mais
importante de tudo isto. Sem elas é a palavra de um contra a de outro, e o
cliente que está a três quilómetros não tem como decidir. Com elas, tem. O
componente `EnviarFotos` já está nesse ecrã — não custa nada.

Depois de pedir, a secção passa a mostrar o que está à espera, com o telefone do
cliente à mão e o botão de cancelar o pedido.

---

## 6. O que o cliente vê

Em `src/app/pedido/[token]/PropostasRecebidas.tsx`, dentro do cartão verde do
`acordada`, **por cima de tudo o resto** e em âmbar — é a única coisa que
interessa naquele ecrã enquanto estiver por responder:

> ### ⚠ {Pro} pede para ajustar o valor
>
> **«Estavam 50 sacos, não 20. Contei-os um a um.»**
>
> *[as fotografias, em grande]*
>
> |  | Estava | Fica |
> |---|---|---|
> | Serviço | 135,00 € | 300,00 € |
> | IVA (23%) | 31,05 € | 69,00 € |
> | Taxa CLYON | 6,75 € | 15,00 € |
> | **Total a pagar** | **172,80 €** | **384,00 €** |
>
> `[ Aceito — o valor passa a ser este ]`
> `[ Não aceito ]`   `[ Ligar a {Pro} ]`
>
> Pedido às 14:32. Fica de pé até às 16:32.

**Mostra-se a conta inteira, antes e depois.** O que sai da carteira dele é o
total, não a base — mostrar-lhe só «135 → 300» escondia-lhe os 84 € de imposto
e comissão que também subiram. Os números saem de `contaDoCliente()`, os mesmos
que o ecrã já usa duas linhas acima.

---

## 7. Se o cliente não responder

Esta é a parte onde um desenho ingénuo estraga tudo, e vale a pena dizer o que
**não** se vai fazer:

> **Nunca se aprova sozinho.** Nem ao fim de duas horas, nem ao fim de dois
> dias. Uma conta que subiu sem ninguém do lado de lá dizer que sim não é um
> ajuste — é uma factura surpresa, e é exactamente o género de promessa que a
> auditoria de 11-09 andou a arrancar do site.

O pedido fica de pé **duas horas** — é uma decisão de porta de casa, não uma
negociação — e depois expira sozinho. Aí, e também se o cliente recusar, o
profissional vê três saídas escritas com todas as letras:

1. **Fazer na mesma pelo valor combinado.** O trabalho segue a 135 €.
2. **Falar com a CLYON.** Abre o WhatsApp do apoio com o número do pedido já
   escrito.
3. **Não fazer.** Não cancela nada sozinho: avisa a CLYON e alguém pega no caso.
   Um trabalho contratado que se desmarca tem um cliente à espera do outro lado.

O valor acordado **não muda em nenhum destes casos**. Quem não respondeu paga o
que combinou.

---

## 8. Para baixo é diferente

Se o profissional chega e havia 10 sacos em vez de 20, deve poder baixar o valor
— e isso aplica-se **logo, sem esperar aprovação**. A aprovação existe para
proteger quem é prejudicado, e ninguém precisa de ser protegido de pagar menos.
O cliente é avisado à mesma, e fica no histórico.

Evita também um estado encravado: um desconto à espera que alguém o autorize.

*(Decisão para o dono — ver §12.)*

---

## 9. O preço por carga

Há pedidos com `baseDoPreco = "carga"`, em que «150 €» quer dizer 150 **por
carga**. Num ajuste isso é uma armadilha: «agora são 300» são duas cargas a 150
ou uma carga a 300?

O cartão do ajuste mostra a base nos dois lados e, quando é por carga, di-lo por
extenso em vez de deixar o cliente adivinhar. `avisoDaBase()` já existe e já
escreve essa frase.

---

## 10. As pontas soltas que não são código

**O aviso tem de chegar em dois minutos.** O email é o registo, não o aviso —
ninguém abre email com a carrinha à porta. O que funciona é o WhatsApp, pela
ponte que já existe, com o link do pedido. Se a ponte estiver em baixo, o
profissional tem o número do cliente no ecrã e o link para lhe mandar à mão.

**O painel tem de ver.** Um ajuste por responder é uma discussão a decorrer
entre duas pessoas. Aparece na mesa como a negociação aparece, e o assistente ao
telefone pode aprovar em nome do cliente — fica registado que foi a CLYON e não
ele. Reaproveita `assumirPedidoSeLivre()`, como a rota do valor já faz.

**A defesa contra o preço-isco.** Alguém vai perceber que pode ganhar pedidos
com um valor baixo para depois «descobrir» o dobro no local. A defesa não é um
tecto — é ficar à vista: **a percentagem de trabalhos em que cada profissional
pede ajuste**, na ficha dele, no painel. Quem ajusta um trabalho em dez teve
azar; quem ajusta seis em dez não está a orçamentar, está a pescar. É uma conta
barata, e é o que protege mesmo a praça. *(Fase 2.)*

---

## 11. Por onde entra no que já existe

Nada disto abre porta nova de autenticação. Encaixa nas duas que já lá estão:

| | Rota | Acção nova |
|---|---|---|
| Profissional | `POST /api/profissionais/trabalho` (sessão) | `pedir_ajuste`, `cancelar_ajuste` |
| Cliente | `POST /api/negociacao/[token]` (token do pedido) | `aprovar_ajuste`, `recusar_ajuste` |
| CLYON | `POST /api/admin/negociacoes/valor` | *fica como está* — a rede de segurança |

**Ficheiros:** `src/lib/ajuste-no-local.ts` (novo, puro), `db.ts` (uma coluna e
os leitores/escritores), as duas rotas acima, `Trabalhos.tsx`,
`PropostasRecebidas.tsx`, e o aviso ao cliente.

**Não se toca** em `pricing-helper.ts`, `taxas-plataforma.ts`, `auth.ts`, no
middleware, nem em `negociacao.ts` — que é precisamente a razão de o ajuste ser
um objecto à parte.

**Testes:** que `a_confirmar` não deixa pedir; que o segundo pedido aberto é
recusado; que ao terceiro ajuste diz que não; que subir sem fotografia é
recusado; que expirar **não** muda `valorAcordado`; e um teste-guarda a garantir
que em lado nenhum do produto aparece a ideia de um ajuste aprovado
automaticamente — o mesmo padrão de `promessa-do-dinheiro.test.ts`.

---

## 12. Antes de escrever a primeira linha

**Uma correcção a fazer primeiro, e é de uma linha.** Em `Trabalhos.tsx:1736` o
profissional lê hoje *«Enviou a prova. O valor fica cativo até ele confirmar»*.
Não fica: `A_PLATAFORMA_COBRA` é `false` e a CLYON não guarda dinheiro nenhum. É
a mesma promessa falsa que a auditoria tirou do resto do site, esquecida no ecrã
exacto onde esta funcionalidade vai viver. Construir por cima dela era pôr o
cliente a «aprovar» uma coisa que ninguém retém.

**Três decisões que são suas:**

1. **Para baixo aplica logo?** (§8) — recomendo que sim.
2. **Duas horas é o prazo certo?** Conhece o terreno melhor do que eu.
3. **Dois ajustes por trabalho chegam?**

---

## 13. Ordem de trabalho

| | | |
|---|---|---|
| 0 | A frase do «valor cativo» | 1 linha |
| 1 | `ajuste-no-local.ts` + testes | a regra toda, sem ecrã |
| 2 | Coluna e leitores em `db.ts` | |
| 3 | As duas rotas | |
| 4 | O ecrã do profissional | |
| 5 | O ecrã do cliente | |
| 6 | Avisos (WhatsApp + email) | |
| 7 | O painel vê e pode decidir | |
| 8 | A percentagem de ajustes por profissional | fase 2 |

Do 1 ao 5 é a funcionalidade de pé. O 6 e o 7 são o que a torna utilizável num
sábado de manhã.
