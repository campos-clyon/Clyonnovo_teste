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
