# O assistente automático da CLYON — plano

**12-09-2026.** Pedido do dono, por palavras dele:

> Quero que o bot do WhatsApp seja um assistente da CLYON automático que faça a gestão de
> conversas, trabalhos e clientes. O assistente deve controlar os orçamentos — com propostas
> e sem propostas — e sempre que tenha novidade deve informar o cliente. Se o cliente
> aceitar, o assistente vai até ao pedido e marca a opção que foi aceite; ou caso não seja
> aceite, ou o cliente queira desistir. Da mesma forma faz a gestão dos pedidos já aceites e
> contratados. Caso o cliente não responda, deve reenviar mensagens para garantir que o
> pedido fique finalizado. Deve ter categorias mais robustas para gerir os pedidos e marcar
> tudo bem organizado. Deve acompanhar os pedidos do início ao fim, desde a primeira
> mensagem até à finalização com agradecimento. E cada uma dessas ferramentas deve ter a
> opção de o admin parar, caso esteja a cometer erros.

---

## O que já existe (e não precisa de ser construído)

Vale a pena dizer isto primeiro, porque muda o tamanho do trabalho. **A máquina já cá está** —
o que falta é o condutor.

| Peça | Onde | Estado |
|---|---|---|
| Motor da negociação (propor, aceitar, contratar, desistir) | `negociacao.ts` | Completo e testado |
| Fases do trabalho depois do acordo | `trabalho.ts` (`faseDoTrabalho`) | Completo |
| Enviar e receber WhatsApp, três canais | `whatsapp-cloud.ts` | Completo |
| Ler o que o cliente escreve, em linguagem natural | `whatsapp-compreensao.ts` | Feito hoje |
| Recolher um pedido novo de raiz | `whatsapp-recolha.ts` | Completo |
| Registo permanente de cada transição | `registoPermanente` | 15 acontecimentos |
| Avisar o cliente de uma proposta nova | `avisarDaProposta` | **Só para propostas** |
| Desligar tudo / entregar uma conversa / bloquear | painel do WhatsApp | Global e por número |

**O que falta** é o que este plano trata: um assistente que *observa as mudanças de estado*,
*decide o que dizer*, *insiste quando não há resposta*, e *escreve de volta no pedido* — com
travões por capacidade e um registo do que fez.

---

## As cinco decisões que sustentam o desenho

Antes das fases, as escolhas que definem tudo o resto. Se alguma destas estiver errada, o
resto não se salva.

### 1. As categorias DERIVAM-SE, não se guardam

O pedido quer «pedidos criados, orçamentos enviados, orçamentos aceites, orçamentos
recusados, pedidos cancelados». A tentação é acrescentar uma coluna `categoria` e escrevê-la
a cada passo.

**Não se faz assim.** Uma coluna de estado escrita à mão em doze sítios diferentes fica errada
no primeiro sítio que alguém esquecer — e aí o painel diz «orçamento enviado» sobre um
pedido que já foi pago. Este projecto já tem a lição escrita: `faseDoTrabalho` calcula a fase a
partir das datas que já existem, e por isso nunca pode divergir.

A categoria é uma **função pura** sobre o que já está na base:

```
sem negociações                          → criado
negociações, nenhuma proposta ainda      → à espera de propostas
propostas na mesa, nenhuma aceite        → orçamento enviado
uma acordada, sem execução               → aceite, por fazer
execução enviada, por confirmar          → feito, à espera de confirmação
confirmado                               → concluído
pago                                     → pago
todas mortas/desistidas, ou status       → recusado / cancelado
```

Ganha-se: nunca diverge, não precisa de migração, e o painel e o assistente lêem **a mesma**
verdade. É também o que já corrigimos hoje no Início — a categoria vem dos dados, não de um
campo paralelo.

### 2. Uma mensagem por TRANSIÇÃO, e num sítio só

Hoje `avisarDaProposta` é chamado de cinco sítios diferentes, e só cobre um acontecimento.
Acrescentar avisos assim multiplica o problema: nove acontecimentos × cinco chamadores.

O assistente passa a olhar para **uma coisa só**: mudou de categoria? Então há novidade.

O `registoPermanente` já grava cada transição com `estadoAntes` e `estadoDepois`. É a fonte
perfeita: **o que ainda não foi contado ao cliente** é o que o assistente tem para dizer.

### 3. Marcar «aceite» é uma acção de dinheiro — precisa de prova

Quando o cliente diz «sim», o assistente vai «até ao pedido e marca a opção que foi aceite».
Isso liberta um compromisso de centenas de euros entre duas pessoas.

Três guardas, e nenhuma é opcional:

- **A decisão passa pelo motor de sempre** (`contratar`, `aceitar`), nunca por um `UPDATE`
  escrito à mão. É lá que vivem as regras de quem pode fazer o quê.
- **O modelo não decide, traduz.** Já é assim desde hoje: o Gemini lê a frase e reescreve-a
  na forma que o código entende; quem executa é o código. Na dúvida devolve «nada».
- **Fica escrito que foi o assistente.** `autorTipo: "assistente"` no histórico e no registo
  permanente, para que no dia de um desacordo se saiba quem carregou no botão.

### 4. Insistir tem limite, e o limite é dito

«Caso o cliente não responda, reenviar mensagens para garantir que o pedido fique
finalizado.» Um assistente que insiste sem limite é um assistente que chateia — e no WhatsApp
isso custa o número.

Regra: **três toques e pára**, com espaçamento crescente, e nunca mais do que um por dia.
Ao terceiro sem resposta, a conversa vai para o admin com a etiqueta «não responde», em vez
de continuar a bater à porta.

### 5. Cada capacidade tem interruptor próprio

Hoje há um interruptor geral («Desligar tudo») e um por conversa («Entregar a si»). O que não
há é o do meio: *parar os lembretes mas continuar a responder*, ou *deixar de marcar acordos
mas continuar a avisar*.

Seis interruptores independentes, numa tabela, visíveis no painel do WhatsApp:

| Interruptor | O que pára |
|---|---|
| `recolher` | Criar pedidos novos pela conversa |
| `avisar` | Contar novidades ao cliente |
| `fechar` | Marcar aceites e recusas |
| `insistir` | Os lembretes de quem não responde |
| `acompanhar` | Datas, lembretes de execução, confirmação |
| `agradecer` | A mensagem de fecho |

Cada um começa **desligado**. Liga-se um de cada vez, à medida que se ganha confiança.

---

## As fases

Cada fase entrega alguma coisa que funciona sozinha, e nenhuma depende da seguinte para
valer a pena.

### Fase 1 — Ver antes de agir *(a base)*

**Constrói:** `categoriaDoPedido()` pura + testes; a coluna «categoria» nos ecrãs de Pedidos e
Negociações; e a tabela dos seis interruptores, todos desligados.

**Não faz nada de automático.** É só passar a ver o mundo como o assistente o vai ver.

**Porque primeiro:** se a categoria estiver errada, tudo o que vier a seguir manda mensagens
erradas. Esta fase deixa-a à vista durante alguns dias — sem risco — para se confirmar que
bate certo com a realidade.

**Como se sabe que resultou:** abrir os Pedidos e conferir dez pedidos à mão.

---

### Fase 2 — Contar as novidades *(o primeiro automatismo)*

**Constrói:** o observador de transições, um cron de poucos em poucos minutos, e a tabela do
que já foi contado (para não repetir). Interruptor `avisar`.

**A mensagem que o dono pediu**, nas palavras dele:

> Boa tarde, Sr. João. Acabou de receber uma proposta do Fred, de 150 € sem IVA — com o
> imposto e a taxa fica em 157,50 €. Quer aceitar?

**O que cobre:** proposta nova, proposta aceite pelo profissional, contraproposta, o dia
marcado, o trabalho dado por feito, o pagamento libertado.

**O risco, e o travão:** uma mensagem a mais é chato mas não parte nada — e o interruptor
está ao lado. Por isso esta é a primeira capacidade automática: **fala, não decide**.

---

### Fase 3 — Fechar o negócio *(a que mexe em dinheiro)*

**Constrói:** o «sim» e o «não» do cliente a chegarem ao motor. Interruptor `fechar`.

Boa parte já existe — hoje o cliente pode fechar por WhatsApp. O que falta é o assistente
fazê-lo **com a proposta certa quando há várias**, e escrever no histórico que foi ele.

**Guardas específicas desta fase:**
- Com mais do que uma proposta na mesa, e sem ficar claro qual, **pergunta em vez de
  adivinhar**.
- Um fecho feito pelo assistente fica **desfazível pelo admin durante 24 horas**, com um
  botão «não era isto» no ecrã das Negociações.
- Um valor que o cliente diga e que não case com nenhuma proposta vira **contraproposta**,
  nunca um fecho.

---

### Fase 4 — Insistir com quem não responde

**Constrói:** o cron dos lembretes, com o limite de três e a escada de tempos. Interruptor
`insistir`.

Cadência proposta, a confirmar consigo:

| Situação | 1.º toque | 2.º | 3.º | Depois |
|---|---|---|---|---|
| Proposta na mesa sem resposta | 24 h | +2 dias | +3 dias | vai para o admin |
| Trabalho feito por confirmar | 24 h | +2 dias | — | liberta-se sozinho aos 7 dias (já existe) |
| Recolha a meio, parada | 6 h | +1 dia | — | arquiva a conversa |

**Nunca entre as 21h e as 9h.** Um lembrete às 3 da manhã é a melhor maneira de perder um
cliente e o número.

---

### Fase 5 — Acompanhar até ao fim

**Constrói:** o que acontece depois do acordo — lembrar a data na véspera, perguntar como
correu, pedir a avaliação, agradecer. Interruptores `acompanhar` e `agradecer`.

É a parte que o dono descreve como «uma rede profissional de marketing: da primeira mensagem
à última, com agradecimento». É também a de menor risco — ninguém perde dinheiro com um
agradecimento — e por isso vem no fim, quando a confiança no assistente já estiver feita.

---

### Fase 6 — O ecrã do assistente

**Constrói:** um separador no painel do WhatsApp que mostra **o que o assistente fez**, em
ordem, com o que disse e o que mudou na base. Cada linha com «desfazer» quando aplicável.

**Porque é que isto não vem primeiro, sendo tão óbvio:** porque só há o que mostrar depois
das fases 2 e 3. Mas é o que torna os interruptores utilizáveis a sério — sem este ecrã, «parar
caso esteja a cometer erros» depende de alguém ler conversas uma a uma para descobrir o erro.

---

## O que eu recomendo, e onde discordo do pedido

**Concordo com quase tudo.** Duas ressalvas, e prefiro dizê-las agora:

**1. «Sem propostas» é um problema de oferta, não de conversa.** O pedido fala em controlar os
orçamentos «com propostas / sem propostas». Um pedido sem propostas não se resolve falando
com o cliente — resolve-se falando com os profissionais, ou baixando o valor de partida.
Sugiro que, nesse caso, o assistente **avise a equipa** em vez do cliente: dizer ao cliente
«ainda ninguém respondeu» três dias seguidos é anunciar que a plataforma está vazia.

**2. O agradecimento não deve pedir nada.** A tentação de juntar «e avalie-nos» ao
agradecimento é grande, e transforma um gesto numa cobrança. Proponho separá-los: o
agradecimento no fim do trabalho, e o pedido de avaliação um dia depois, uma vez só.

---

## Riscos, a sério

| Risco | Consequência | Como se trava |
|---|---|---|
| Fechar um negócio que o cliente não aceitou | Compromisso de centenas de euros entre duas pessoas | Na dúvida pergunta; desfazível 24 h; fica escrito quem foi |
| Insistir de mais | O número é banido pelo WhatsApp e a plataforma fica muda | Três toques, um por dia, nunca de noite |
| Dizer um preço que a casa não pratica | Promessa que o profissional não cumpre | Nenhum número sai sem vir de `precos-publicos.ts` ou da proposta real |
| O assistente falar por cima de uma pessoa | Duas vozes na mesma conversa | Uma conversa entregue a alguém continua calada — o portão já existe |
| Uma transição contada duas vezes | Cliente recebe a mesma novidade repetida | Tabela do que já foi contado, com chave única por transição |

---

## O que preciso de si antes de começar

1. **A cadência dos lembretes** — confirma a tabela da fase 4, ou prefere outra?
2. **A fase 1 sozinha primeiro?** Recomendo: mostra as categorias durante uns dias, sem nada
   automático, e confirma-se que batem certo antes de o assistente começar a falar.
3. **Os avisos sem propostas** — para o cliente ou para a equipa? (Recomendo a equipa.)
4. **O tratamento** — «Sr. João» ou «João»? O exemplo que deu usa «senhor»; o resto do
   assistente hoje trata por «você» sem título.

Diga-me e começo pela fase 1.
