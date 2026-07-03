# Resultados dos Testes - Categoria Móveis

## Data do Teste
06/01/2026 - 18:01

## Cenário Testado: Móveis Por Item

### Dados de Entrada
- **Tipo de Material:** Móveis
- **Como deseja calcular:** Por Item
- **Móvel Pequeno:** 5 unidades (€25/un)
- **Móvel Médio:** 3 unidades (€50/un)
- **Móvel Grande:** 2 unidades (€60/un)
- **Tipo de Acesso:** Casa
- **Acesso Difícil:** Sim

### Campos Ocultados
✅ Tempo Estimado (horas)
✅ Região
✅ Quantidade de Pessoas Necessárias

### Cálculo Detalhado
1. **Custo dos Móveis:**
   - 5 × €25 = €125 (pequenos)
   - 3 × €50 = €150 (médios)
   - 2 × €60 = €120 (grandes)
   - **Subtotal móveis:** €395

2. **Custo de Acesso (Casa):** €0

3. **Acesso Difícil:** +€30

4. **Subtotal:** €395 + €0 + €30 = €425

5. **Margem de Lucro (50%):** €425 × 1.5 = €637,50

6. **Total Final:** €638 (arredondado)

### Resultado
✅ **Orçamento Estimado: €638**

### Validações
✅ Campos de tempo, região e pessoas foram ocultados corretamente
✅ Cálculo não inclui custo de horas × pessoas
✅ Cálculo não inclui custo de região
✅ Cálculo inclui apenas: Móveis + Acesso + Dificuldade × 1.5
✅ Margem de lucro de 50% aplicada corretamente
✅ Botão "Confirmar no WhatsApp" disponível

### Conclusão
A nova lógica de "Móveis Por Item" está funcionando perfeitamente. Os campos condicionais aparecem/desaparecem conforme esperado e o cálculo está correto.

---

## Próximo Teste Necessário
- [ ] Testar cenário "Móveis Por Carga" para validar que mantém a lógica antiga (horas × pessoas + região)
