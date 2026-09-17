# Resposta à Joana Diniz — o que é que «não é possível»?

**17-09-2026.** Ela respondeu *«Não será possível fazer esta situação»* à nota
sobre a actividade declarada e os pagamentos repartidos entre a CLYON e os
profissionais parceiros.

São cinco palavras a uma pergunta de três partes, e a diferença entre as
leituras possíveis é enorme: **preencher um formulário** ou **mudar de
fornecedor**. Este email existe para não se decidir nada em cima de uma
suposição.

**Responder na mesma conversa** (não abrir um assunto novo — o histórico é o
que dá contexto à resposta dela).

---

## O email

**Assunto:** Re: (manter o assunto da conversa)

---

Boa tarde, Joana,

Obrigado pela resposta rápida.

Quero perceber bem o alcance do «não será possível», porque temos decisões de
produto em cima disso e prefiro não avançar em cima de uma suposição.

**1. O que é que não é possível — o modelo, ou o modelo nesta conta?**

Ou seja: o euPago não trabalha com plataformas que cobram ao cliente final
serviços prestados por profissionais independentes; ou trabalha, mas isso exige
uma conta/contrato diferente do que temos hoje (atividade declarada
«Demolição»)?

**2. Se for a segunda, o que é preciso da nossa parte?**

Que documentos, que alteração ao contrato, e quanto tempo demora tipicamente.

**3. E o «Split Payments» que está documentado — a quem se aplica?**

Pergunto porque a vossa documentação técnica descreve pagamentos repartidos por
beneficiários, com `externKey` por beneficiário. Se esse produto existe, presumo
que exista para casos como o nosso — e ajuda-me saber que requisitos tem, mesmo
que hoje não estejamos elegíveis.

**Para contexto, e para não parecer maior do que é:** o que temos hoje é uma
plataforma onde um cliente e um profissional independente acordam um valor por
escrito. O cliente paga-lhe directamente, no fim do trabalho — nós não tocamos
no dinheiro. O que queríamos avaliar é ficar nós a receber e a pagar ao
profissional depois de o cliente confirmar, que é o que dá garantia aos dois
lados. Se isso não for possível pelo euPago, continuamos como estamos; só
preciso de o saber com clareza para não construir na direcção errada.

Com os melhores cumprimentos,
Wanderson Silva
CLYON

---

## Porque é que estas três e não outras

| | |
|---|---|
| **1** | É a única que separa «formulário» de «mudar de fornecedor». Sem ela, qualquer plano seguinte é um palpite |
| **2** | Se for solúvel, isto é a lista de tarefas. Se a resposta for «seis meses e um alvará», isso também é uma resposta |
| **3** | Obriga-os a conciliar a resposta comercial com a documentação técnica deles. O Split Payments existe e está publicado — se não é para nós, é para quem? |

E a última frase do email é deliberada: **diz-lhes que não há pressa e que não
há dependência.** Hoje a CLYON não segura dinheiro de ninguém e a plataforma
funciona. Negociar de uma posição em que não se precisa da resposta é diferente
de negociar de uma em que se precisa — e neste caso é verdade.

## O que NÃO se faz enquanto isto não estiver respondido

- `A_PLATAFORMA_COBRA` fica a `false`. É exactamente para isto que existe.
- Não se põe `EUPAGO_AMBIENTE=producao`. A sandbox não cobra ninguém e permite
  provar a integração toda — que é o que falta fazer, e não depende desta
  resposta.
