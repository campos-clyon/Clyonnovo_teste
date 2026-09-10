# Convidar profissionais — o que dizer, e o que não dizer

Escrito a 10-09-2026, com as regras tiradas do código e não de memória. Se
alguma delas mudar, este ficheiro muda com ela — as fontes estão indicadas
para se poder conferir.

---

## 1. Como se convida, no painel

A inscrição **não é aberta**, e isso é deliberado: por convite, cada
profissional na plataforma é alguém com quem já se falou, e é isso que permite
dizer ao cliente que quem lhe aparece foi verificado.

O caminho: **Backoffice › Profissionais › convidar**, com nome e email. Sai um
email com o link do registo, e esse link **dura 14 dias**
(`DIAS_DE_VALIDADE_DO_CONVITE`).

O telefone é opcional no convite, mas vale a pena pô-lo: é por WhatsApp que a
conversa acontece.

---

## 2. A primeira mensagem, por WhatsApp

Curta. Quem recebe uma parede de texto de um número desconhecido não a lê.

### Para quem não nos conhece de lado nenhum

> Boa tarde, Sr. Jorge. Chamo-me Wanderson, da CLYON.
>
> Somos uma plataforma que liga clientes a profissionais de recolhas,
> esvaziamentos e mudanças em Lisboa e na Margem Sul. Vi o seu anúncio e queria
> convidá-lo a receber os nossos pedidos.
>
> Neste momento tenho pedidos à espera de quem os faça, na sua zona.
>
> Não se paga nada para responder — nem contactos, nem créditos, nem
> mensalidade. Só há comissão quando fecha um trabalho.
>
> Faz sentido explicar-lhe em dois minutos?

Porque é que esta funciona: diz quem somos, diz o que se ganha, tira do caminho
o medo que qualquer profissional tem destas plataformas (pagar para responder),
e acaba numa pergunta fácil de responder.

**Não colar links na primeira mensagem.** Um link de um número desconhecido
lê-se como burla.

### Para quem já ouviu falar, ou veio recomendado

> Boa tarde, Sr. Jorge. Wanderson, da CLYON — falámos [onde/quando] / foi o
> [nome] que me deu o seu contacto.
>
> Tenho pedidos de recolha e mudanças na sua zona à espera de resposta. Queria
> convidá-lo a entrar na plataforma.
>
> Responder aos pedidos não custa nada; a CLYON só ganha quando o trabalho
> fecha. Explico melhor?

---

## 3. Se responderem: como funciona, em seis linhas

> Funciona assim:
>
> 1. Chega-lhe o pedido por email e no painel — com fotografias, a zona, o
>    andar e se há elevador. Só os serviços que faz e dentro do raio que
>    indicar.
> 2. Abre e vê uma conta feita para si: quanto lhe custa, quanto sobra, e um
>    valor sugerido. A conta usa os SEUS custos, os que puser no perfil.
> 3. Responde com o valor que quiser. O que aparece é já o líquido — o que
>    fica para si depois da comissão.
> 4. O cliente escolhe. Se o escolher, recebe a morada exacta e o contacto
>    dele.
> 5. Faz o trabalho e o cliente paga-lhe a si, no fim.
> 6. A CLYON factura-lhe 6 % do valor acordado. Só isso, e só quando há
>    trabalho.

---

## 4. As regras, por escrito

Isto é o que a plataforma cumpre hoje. Pode ser enviado tal e qual.

### O que custa

- **Inscrever-se: nada.** Sem mensalidade.
- **Responder a um pedido: nada.** Não se compram créditos nem contactos.
  Responder a dez pedidos custa o mesmo que responder a zero.
- **Comissão: 6 % do valor acordado**, e só quando fecha um trabalho
  (`TAXA_PROFISSIONAL`). O cliente paga 5 % por cima do valor, que é a parte
  dele (`TAXA_CLIENTE`).

### Quem paga a quem

- **O cliente paga ao profissional**, no fim do trabalho. A CLYON não recebe
  nem guarda esse dinheiro (`A_PLATAFORMA_COBRA = false`).
- O que a CLYON faz é **guardar o acordo**: o valor combinado fica escrito, e
  nem o cliente nem o profissional o mudam sozinhos. Se o trabalho mudar à
  porta, corrige-se na plataforma, com registo.
- **A factura do serviço é do profissional.** O IVA depende do regime dele. A
  CLYON factura apenas a comissão.

### Que pedidos chegam

- Só as **categorias** que declarar e só dentro do **raio** que indicar, medido
  a partir da base dele (`profissional-elegivel.ts`).
- Cada pedido traz **fotografias, zona, andar, elevador e acesso**.
- **A morada exacta e o telefone do cliente só aparecem depois de ser
  contratado.** Antes disso vê a zona. É a regra que protege o cliente e que o
  protege a si de trabalho combinado por fora.

### Como se negoceia

- **Só valores, sem mensagens.** Não há conversa dentro da negociação: há
  propostas.
- **Cinco propostas de cada lado**, e **48 horas** para responder a cada uma
  (`MAX_PROPOSTAS_POR_LADO`, `PRAZO_DA_PROPOSTA_HORAS`).
- O valor que aparece é sempre o **líquido**: o que fica para si. Não tem
  contas a fazer.

### A conta que a plataforma faz para si

No perfil, em *Serviços e raio*, ele põe os custos dele:

- custo por km, custo por hora e pessoa, pessoas na equipa;
- tempo médio de um trabalho, deslocação incluída;
- custos fixos por ano — Via Verde, manutenção, IUC, inspecção, seguro — e
  quantos trabalhos faz por mês, para o site dividir;
- a margem que quer, numa barra;
- um seguro de risco, se quiser reservar uma percentagem para partidos e
  viagens em vão.

Com isso, cada pedido chega com o **custo mínimo, o valor sugerido e o lucro
estimado**, calculados com os números dele e com os quilómetros dele. É a
diferença entre um palpite e uma conta.

### O que se espera dele

- **Responder depressa.** Ao cliente prometemos propostas em 6 horas
  (`PRAZO_DE_RESPOSTA`). Quem responde primeiro é quem costuma fechar.
- **Cumprir o que ficou escrito.** O valor está registado; mudá-lo à porta do
  cliente é o que a plataforma existe para evitar.
- **Deixar o cliente confirmar.** É a confirmação dele que fecha o trabalho e
  que constrói a nota pública do profissional.

---

## 5. O que NÃO prometer

Escrito aqui para não haver dúvidas, porque prometer o que não existe
custa-nos o profissional ao primeiro trabalho.

| Não dizer | Porquê |
|---|---|
| "A CLYON garante o pagamento" | Não garante. O cliente paga ao profissional; a plataforma não retém o dinheiro. |
| "Dinheiro retido / caução" | Só quando `A_PLATAFORMA_COBRA` passar a `true`. Hoje é falso. |
| "Vai receber X pedidos por mês" | Não há volume para prometer isso, e uma promessa dessas queima o contacto. |
| "Temos X profissionais" ou "24 cidades" | Somos poucos e novos. Dizê-lo é mais forte do que inflacionar. |
| Qualquer número sobre a concorrência | Não temos como o provar, e um número errado numa conversa de recrutamento paga-se caro. |

**O que dizer em vez disso, quando perguntarem pelo volume:** a verdade, que é
boa. *"Somos novos e somos poucos — e é por isso que os pedidos que entram são
repartidos por poucos. Neste momento tenho pedidos parados à espera de quem os
faça."*

---

## 6. Onde encontrar profissionais

Por ordem de proximidade, que é a que costuma resultar:

1. **Quem já trabalhou consigo.** É o mais rápido, e já sabe se é bom.
2. **Anúncios de mudanças e recolhas** no OLX e no Facebook Marketplace, na
   Margem Sul e em Lisboa. São operadores pequenos, com carrinha própria, que é
   exactamente o perfil.
3. **Empresas com anúncio feito** (como a Mudanças Jorge da imagem): já
   investem em publicidade, o que quer dizer que querem trabalho e sabem quanto
   custa arranjá-lo.
4. **Grupos de Facebook de profissionais** da zona.
5. **Quem já recusou um trabalho seu por não ter agenda.** Esse já disse que
   sim ao tipo de trabalho.

Um pedido parado é o melhor argumento que existe. Não guarde os pedidos para
depois de ter os profissionais: use-os para os arranjar.

---

## 7. A mensagem completa, para empresas de mudanças

Escrita para os grupos de WhatsApp de mudanças (Margem Sul e Lisboa), onde as
empresas passam o dia a anunciar que têm equipa e carrinha disponíveis.

### Primeiro: no privado, nunca no grupo

O grupo tem regras — o nome dele começa por «Leia as regras» — e a maioria
destes grupos proíbe divulgação. Uma mensagem de recrutamento no grupo tira-o
de lá e queima 246 contactos de uma vez.

**Envie um a um, no privado.** Dá mais trabalho e é a única forma que não se
paga cara. E abre a mensagem a dizer de onde veio: «vi-o no grupo» é a
diferença entre um convite e spam.

### Como enviar

Estas pessoas recebem dezenas de mensagens por dia. **Mande primeiro só o
bloco de abertura.** O texto completo vai depois, se responderem — quem recebe
quinze linhas de um número desconhecido não as lê.

### Abertura (a primeira mensagem)

> Boa tarde, [nome]. Chamo-me Wanderson, da CLYON.
>
> Vi-o no grupo Mudanças 24h. Somos uma plataforma que recebe pedidos de
> clientes e os manda aos profissionais da zona — mudanças, recolhas e
> esvaziamentos, em Lisboa e na Margem Sul.
>
> Neste momento tenho pedidos parados à espera de quem os faça.
>
> Responder a um pedido não custa nada: nem créditos, nem contactos comprados,
> nem mensalidade. Só há comissão quando fecha um trabalho.
>
> Quer que lhe explique como funciona?

### O texto completo (quando responderem)

> *O que é a CLYON*
> Uma plataforma que liga clientes a profissionais. O cliente descreve o
> trabalho com fotografias; nós mandamos o pedido a quem o pode fazer. Quem
> executa é o profissional — a CLYON não faz mudanças.
>
> *O que lhe chega*
> O pedido vai-lhe ao email e ao painel, com fotografias, a zona, o andar e se
> há elevador. Só os serviços que faz, e só dentro do raio que indicar a partir
> da sua base. Não tem de estar de olho em grupo nenhum à espera que apareça
> trabalho.
>
> *Quanto custa*
> Inscrição: zero. Mensalidade: zero. Responder a um pedido: zero.
> Só há comissão quando fecha um trabalho — 6 % do valor acordado. Um orçamento
> que não dá em nada não lhe custa um cêntimo.
>
> *Como responde*
> Abre o pedido e encontra a conta já feita para si: o combustível para os
> quilómetros que vai fazer, as horas da sua equipa, os seus custos fixos, e o
> valor que sugerimos. Essa conta usa os SEUS números, os que puser no perfil —
> não os nossos. Depois propõe o valor que entender.
> O que aparece no ecrã é sempre o líquido: o que fica para si.
>
> *Quem paga*
> O cliente paga-lhe a si, no fim do trabalho. A CLYON não recebe nem guarda
> esse dinheiro. O que a plataforma faz é guardar o valor combinado por
> escrito, para ninguém o mudar à porta do cliente.
> A factura do serviço é sua e o IVA é do seu regime. A CLYON factura só a
> comissão dela.
>
> *O que a plataforma não deixa fazer*
> A morada exacta e o telefone do cliente só lhe aparecem depois de ele o
> escolher. Antes disso vê a zona. É o que protege o cliente — e o que garante
> que ninguém lhe passa à frente com o contacto.
>
> *O que não lhe prometo*
> Somos novos e somos poucos. Não lhe garanto dez trabalhos por mês, e quem
> lho garantir está a inventar. O que lhe garanto é que responder nunca lhe
> custa nada, e que hoje tenho pedidos à espera.
>
> *Como se entra*
> Mando-lhe um convite por email. O registo leva cinco minutos: nome, email,
> telemóvel, a cidade onde tem base, os serviços que faz e até onde vai. Se
> emitir factura, também o NIF e a morada fiscal.
>
> Quer que envie?

---

## 8. O que eles vão perguntar

As objecções reais de quem vive disto. Respostas curtas, e todas verdadeiras.

**«Tenho de pagar para receber os contactos?»**
Não. Nem para receber, nem para responder. Só há comissão quando fecha um
trabalho.

**«E se o cliente não me pagar?»**
O cliente paga-lhe a si, no fim. A CLYON não retém o dinheiro — o que faz é
guardar o acordo por escrito, com data, para não haver versão diferente
depois. Não lhe vou dizer que garantimos o pagamento, porque não garantimos.

**«Quanto é a comissão, ao certo?»**
6 % do valor acordado, seu. O cliente paga 5 % por cima, que é a parte dele.
Num trabalho de 300 €, ficam-lhe 282 €.

**«Sou obrigado a aceitar os pedidos?»**
Não. Pode não responder, e pode arrumar o pedido para não lhe encher o ecrã.
Não há penalização nenhuma.

**«Já estou na Fixando / noutra plataforma.»**
Continue. Isto não é exclusivo. A diferença é que aqui não gasta nada a
responder — se não fechar, não pagou.

**«Quantos trabalhos vou receber?»**
Não sei, e não lhe vou inventar um número. Somos poucos profissionais, o que
quer dizer que os pedidos que entram são repartidos por poucos. Hoje tenho
[N] à espera.

**«Preciso de empresa? De factura?»**
Para se inscrever, não. Se emitir factura, pedimos o NIF e a morada fiscal,
porque a factura do serviço é sua. Se não emitir, também pode entrar — mas há
clientes que só aceitam com factura.

**«E o entulho? Preciso de guia?»**
Para transportar resíduos é preciso ser transportador licenciado (e-GAR). No
perfil diz se emite guia, e os pedidos que a exigem só vão a quem a emite.
