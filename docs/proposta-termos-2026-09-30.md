Publicada a 01-10-2026 em src/app/termos/page.tsx

# Proposta de actualização dos Termos e Condições — 30-09-2026

Os Termos publicados (versão de 21-08-2026) descrevem um modelo que já não é o
do site. Esta proposta só entra em vigor quando o dono a aprovar e, pela
cláusula 16, com aviso de 30 dias a quem já tem conta.

## O que hoje está em contradição

| Cláusula | Diz hoje | O que o site faz |
|---|---|---|
| 6 | 5 % somados ao cliente e 6 % descontados ao profissional; «o IVA é do regime de quem emite a fatura» | Desde 29-09 o cliente vê um preço só, já com a taxa; a CLYON fica com 11 % do que ele paga. O IVA (23 %) só entra com factura, e quem factura é a Miragem Dourada |
| 6 | «A fatura do serviço é sempre emitida pelo profissional. A CLYON não fatura o serviço.» | A factura é emitida pela Miragem Dourada (decisão de 22-09) |
| 7 | «O pagamento do serviço é feito ao profissional… A CLYON não recebe nem detém o valor do serviço.» | Na forma «pela plataforma», o cliente paga à CLYON por referência MB WAY/Multibanco, e a CLYON só entrega o valor ao profissional depois da confirmação |
| 7 | «Se precisa de fatura… só lhe propomos profissionais que a possam passar.» | O filtro por profissional deixou de fazer sentido: quem factura é a Miragem Dourada |
| — | Não há política de cancelamento e reembolso | O código já trata reembolsos (`pagamentos-na-base.ts`) e diz a quem cancela depois da libertação que o dinheiro não volta (`cancelamento.ts`) |
| 10 | O profissional «emite a fatura… A CLYON fatura-lhe apenas a comissão de 6 %» | A comissão depende das taxas da negociação (6,55 % com a quota de 11 %) |
| 17 | «…ou à plataforma europeia de resolução de litígios em linha» | A plataforma ODR da UE foi encerrada a 20-07-2025 (Regulamento (UE) 2024/3228) |

## Texto proposto

### 6. Preços, taxas e IVA
O preço de cada proposta é o que o cliente paga pelo trabalho, sem IVA, e já
inclui a taxa de plataforma da CLYON. A CLYON fica com 11 % do que o cliente
paga; o profissional recebe o valor que propôs, descontada a comissão. Os
valores de referência que o site mostre antes das propostas são indicativos.

Os valores são apresentados sem IVA. Se pedir factura, acrescem 23 % de IVA
sobre o preço da proposta. A factura é emitida pela Miragem Dourada,
Unipessoal Lda, empresa parceira da CLYON. A CLYON está em regime de isenção
(artigo 53.º do CIVA) e não liquida IVA.

### 7. Pagamento
No pedido, o cliente escolhe como paga:

- **Pela plataforma.** Depois de aceitar a proposta, recebe uma referência
  MB WAY ou Multibanco (processada pelo euPago) para pagar à CLYON. A CLYON
  guarda o valor e só o entrega ao profissional depois de o cliente confirmar
  que o trabalho está feito. O profissional pede então o levantamento e recebe
  por transferência em até 24 horas.
- **Em dinheiro, ao profissional, no fim do trabalho.** Nesse caso paga à
  CLYON, à parte e por referência, a comissão da plataforma, que inclui a
  parte que seria descontada ao profissional. Não é possível pagar em dinheiro
  valores iguais ou superiores a 3 000 € (Lei n.º 92/2017).

### 7-A. Cancelamento e reembolso *(novo — falta o prazo)*
Se o pedido for cancelado antes de o trabalho estar feito, o valor pago pela
plataforma é devolvido pelo mesmo meio em até **[X] dias**. Depois de o cliente
confirmar o trabalho, o valor é entregue ao profissional e deixa de poder ser
devolvido pela CLYON; qualquer reclamação segue o ponto 17.

### 10. Se é profissional (terceiro parágrafo)
É o prestador do serviço perante o cliente: responde pela execução e pelos
danos e cumpre as obrigações fiscais que lhe correspondem. Recebe através da
CLYON o valor que propôs, descontada a comissão — ou em dinheiro, no local,
quando o cliente escolhe essa forma de pagamento.

### 17. Litígios
Retirar «ou à plataforma europeia de resolução de litígios em linha».

## Decisões que só o dono pode tomar
1. Aprovar este texto e a data de entrada em vigor (30 dias depois do aviso).
2. O prazo **[X]** do reembolso.
3. Se a confirmação automática ao fim de 7 dias fica (`prazoAutomatico`) — e,
   se ficar, acrescentá-la ao ponto 7.
4. Confirmar com o contabilista: (a) se o IVA pode ser acrescentado «só com
   factura» — em Portugal a factura é obrigatória em todas as vendas a
   consumidores (CIVA, art. 29.º) e o IVA é devido pela operação; (b) o regime
   de IVA da Miragem Dourada; (c) se os preços para consumidores podem ser
   mostrados sem IVA (DL 138/90).
