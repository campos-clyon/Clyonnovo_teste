# E-mail para o euPago — por enviar

**Para:** Joana Diniz
**Cc:** suporte@eupago.pt
**Assunto:** Conta 25044 (CLYON) — credenciais recebidas + 5 questões sobre Split Payments

> **Porquê à Joana e não ao suporte:** ela já o conhece, tratou da activação, e
> tem uma pergunta em aberto consigo. Responder-lhe fecha-lhe o assunto e abre o
> seguinte na mesma mensagem — chega a alguém que já sabe quem é a CLYON, em vez
> de começar do zero numa fila de tickets. O **Cc para o suporte** é para o
> pedido ficar registado, porque as perguntas 2, 3 e 5 são técnicas e vão acabar
> em alguém da equipa de integração.
>
> **Decisão já tomada (16-09-2026):** a comissão do euPago é suportada pela
> CLYON. O profissional recebe os 94,00 € exactos; é o número que lhe foi
> prometido no ecrã. A pergunta 3 não pergunta *quem paga* — diz que somos nós e
> pergunta *como se indica*.

---

Bom dia, D. Joana,

Obrigado — **recebi as credenciais**, sim, e a conta está a funcionar. Já entrei
no backoffice e confirmei os serviços activos (MB WAY, Multibanco e Payshop).

Estamos agora a preparar a integração por API e surgiram-me cinco questões.
Ponho-as todas aqui para lhe ser mais fácil encaminhar a quem de direito.

**O que vamos construir**, para dar contexto: a CLYON é uma plataforma que liga
clientes a profissionais independentes (recolhas de móveis, esvaziamentos,
mudanças). O cliente escolhe uma proposta, paga; o profissional faz o trabalho;
o cliente confirma.

**Em números**, num trabalho combinado em 100 €:

| | |
|---|---|
| Valor acordado entre cliente e profissional | 100,00 € |
| **O cliente paga** (100 + 5 % de taxa) | **105,00 €** |
| **O profissional recebe** (100 − 6 % de comissão) | **94,00 €** |
| Fica para a CLYON | 11,00 € |

Não emitimos cobrança ao profissional: a comissão é **descontada no que lhe
pagamos**. E queremos que os 94 € **fiquem retidos entre o pagamento e a
confirmação do cliente** — tipicamente alguns dias — e só depois sigam para ele.

Pela documentação, o **Split Payments** parece ser o caminho certo: indicamos o
profissional como beneficiário dos 94 € e a CLYON fica com os 11 €. É sobre isso
que são as perguntas.

---

### 1. `externKey` dos beneficiários

A documentação do Split Payments diz que cada beneficiário precisa de uma
`externKey`, e que a devemos pedir ao vosso suporte.

- Que informação e documentos são precisos **por cada profissional**?
- Quanto tempo demora, em média, a emitir uma?
- Pode ser pedida **por API**, ou é sempre por e-mail? Contamos ter algumas
  dezenas de profissionais, e a crescer.
- O beneficiário precisa de ter conta no euPago, ou basta indicarmos o IBAN
  dele?

### 2. Retenção e libertação *(a mais importante para nós)*

O campo `immediatePayment` sugere que o pagamento ao beneficiário pode não ser
imediato. Precisamos de perceber o que acontece a seguir:

- Com **`immediatePayment: false`**, o valor do beneficiário fica retido. **Como
  damos depois a ordem de libertação?** Há um endpoint para isso?
- **Durante quanto tempo** pode ficar retido? Há um prazo máximo, findo o qual é
  libertado automaticamente — ou devolvido?
- Se nesse intervalo tivermos de **reembolsar o cliente** (total ou
  parcialmente), o reembolso sai desse valor retido? O `POST /refund/{trid}`
  funciona sobre uma transacção de Split Payments?
- E se o profissional não fizer o trabalho: conseguimos **cancelar** a parte
  dele e devolver tudo ao cliente?

### 3. A vossa comissão tem de sair da parte da CLYON

No exemplo acima, a transacção é de 105 € e a vossa comissão de MB WAY seria
0,07 € + 0,70 %, ou seja ~0,81 €.

**Queremos que essa comissão seja suportada inteiramente pela CLYON**, e que o
profissional receba os 94,00 € exactos. É o valor que lhe prometemos no ecrã
quando ele aceita o trabalho, e não pode chegar-lhe diferente — se fosse
descontada proporcionalmente, ele receberia 93,28 € e a promessa deixava de ser
verdade.

- **É assim por omissão** num split, ou tem de ser indicado na chamada?
- Se tiver de ser indicado, **que campo** o faz?
- E se não for possível: a comissão é repartida por que critério, para podermos
  pelo menos calcular de antemão o que cada um recebe?

### 4. Reserva de fundos

As Condições Gerais preveem que o euPago possa reter temporariamente parte dos
montantes recebidos a nosso favor, a título de reserva de fundos.

- **Vai ser aplicada à nossa conta?** Se sim, que percentagem e durante quanto
  tempo?
- Pergunto porque a nossa plataforma mostra a cada profissional o saldo que ele
  tem a receber. Se uma parte estiver retida convosco, temos de o reflectir no
  que lhe mostramos — não queremos prometer um levantamento que depois não
  conseguimos pagar.

### 5. Assinatura dos Webhooks 2.0

Já encontrei no backoffice, em *Canais → Editar → Webhooks 2.0*, onde se define
o endpoint e se gera a Chave Criptográfica. Falta-me um detalhe para validar o
`X-Signature`:

- **Qual é exactamente a string sobre a qual o HMAC-SHA256 é calculado?** O
  corpo cru do pedido tal como enviado, ou alguma concatenação de campos?
- Em que **codificação** vem a assinatura no cabeçalho — hexadecimal ou base64?
- Há algum **exemplo completo** (corpo + chave + assinatura esperada) que
  possamos usar para confirmar a implementação?
- Com a encriptação activa, o HMAC é calculado **antes ou depois** de encriptar?

---

Mais uma nota, para não haver surpresas do vosso lado: a actividade declarada na
nossa conta é **«Demolição»**. Continua a descrever o nosso negócio, mas o que
vai passar pela vossa plataforma são pagamentos de serviços feitos por
profissionais parceiros, repartidos entre eles e nós. Imagino que isso seja
relevante para a vossa avaliação de risco — diga-me se é preciso actualizar
alguma coisa do nosso lado.

Se for mais fácil falarmos por telefone sobre as perguntas **2 e 3**, com todo o
gosto: são as duas que decidem como construímos o nosso lado.

Com os melhores cumprimentos,

**Wanderson Campos Silva**
CLYON — geral@clyon.pt · +351 931 632 622
Conta euPago 25044
