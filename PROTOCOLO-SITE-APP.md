# Como o site e a app se mantêm alinhados

Dois agentes trabalham neste ecossistema. O **Bridge** é dono da base de dados
e da app; o **site** é dono do backoffice em `clyon.pt/admin`. Partilham uma
única base Supabase e nunca se chamam um ao outro directamente.

Este documento existe porque a coordenação já falhou de formas concretas, e
todas pela mesma razão: o que um lado sabia da base não estava escrito em
lado nenhum que o outro pudesse verificar.

## O que já está no sítio

Não é preciso inventar arquitectura nova. O que a boa prática pede, já existe:

| Prática | Onde vive |
|---|---|
| Base de dados única, sem acoplamento entre front-ends | Supabase; o site fala por `service_role`, só no servidor |
| Contrato escrito antes do código | `CONTRATO.md`, propriedade do Bridge |
| Sequência base de dados → app → painel | As notas do Bridge chegam depois da migração aplicada |
| Máquina de estados partilhada | `src/lib/order-status-flow.ts`, derivado do `CONTRATO.md` §2 |
| Histórico das decisões | `NOTA-BRIDGE-*.md`, copiadas para este repositório |

O que faltava não era um mapa da arquitectura. Era **o site dizer aquilo de que
depende**, numa forma que se possa verificar contra a base em vez de acreditar.

## O buraco, em três casos reais

Nenhum destes dá erro de compilação. Nenhum falha nos testes. Todos falham em
produção, em silêncio:

1. O painel juntava `partner_profiles.id` a um id de utilizador. A junção é
   válida, devolve zero linhas — a lista de profissionais aparecia sem
   serviços nem documentos, e parecia um problema de dados.
2. A visão geral lia `profiles.name`. A coluna chama-se `full_name`, e a API
   nem sequer a devolvia. Cada linha mostrou um traço durante semanas.
3. Uma função nova foi descrita por posição. O PostgREST só chama argumentos
   por nome — foi preciso ir ao `pg_proc` descobrir que se chamavam
   `_reference`, `_staff`, `_amount`, `_paid_at`, `_notes`.

## A verificação

O site declara as suas dependências em
[`src/lib/contrato-dependencias.ts`](src/lib/contrato-dependencias.ts): 25
tabelas e vistas, 5 funções, as colunas que lê pelo nome e os argumentos com
que chama cada função.

```bash
npm run contrato:sql
```

Imprime uma consulta. Cola-a no SQL editor do Supabase — **só lê catálogos do
sistema, não altera nada, pode correr em produção.** O resultado é uma linha
por dependência:

| veredicto | tipo | nome | em_falta | usado_em |
|---|---|---|---|---|
| ✗ NÃO EXISTE | vista | payment_reconciliation | | Ecrã de conciliação |
| ⚠ INCOMPLETO | tabela | payment_references | reminded_at | Conciliação de pagamentos |
| ✓ | tabela | profiles | | Nome do cliente |

O que está partido aparece primeiro. Se vier tudo `✓`, o painel assenta em
terreno que existe mesmo.

## Quando correr

- **O Bridge, depois de aplicar uma migração.** Se alguma linha ficar vermelha,
  a migração partiu o painel — e sabe-se qual ecrã, porque a coluna `usado_em`
  diz onde.
- **O site, antes de publicar.** Confirma que o que se assumiu ao escrever o
  código existe no ambiente para onde vai.
- **Quando um ecrã mostra traços ou listas vazias sem explicação.** É o sintoma
  típico de uma coluna que mudou de nome.

## A ordem do trabalho

A sequência que já usamos, escrita para não se perder:

1. **Base de dados.** O Bridge aplica a migração e escreve a nota.
2. **App.** O Bridge liga a app ao que criou.
3. **Painel.** O site implementa a parte administrativa e **corre a
   verificação** — sem isso, está a assumir.
4. **A nota volta.** O site responde com o que encontrou, incluindo o que a
   nota não dizia. Ainda hoje: uma vista sem as colunas que a nota anunciava,
   e uma função cujos argumentos vinham por posição.

## O que fica de fora deste protocolo

A verificação prova que uma coluna **existe**. Não prova o que ela contém, nem
que a regra de negócio está certa. Um `earning_share` a 0,65 quando devia ser
1,00 passa aqui a verde — foi preciso um humano reparar que o profissional via
250 € e recebia 162,50 €.

Para isso não há automatismo: há a nota, e alguém a lê-la com atenção.
