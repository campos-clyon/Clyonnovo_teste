# Teste do Simulador de Orçamento - Clyon

## Dados do Teste
- **Tempo Estimado**: 3 horas
- **Região**: Lisboa
- **Quantidade de Pessoas**: 2 pessoas
- **Tipo de Trabalho**: Entulho
- **Tipo de Acesso**: Apartamento
- **Número de Andares**: 4
- **Tem Elevador**: Não
- **Acesso Difícil**: Não marcado

## Resultado do Cálculo
**Orçamento Estimado: €510**

## Análise da Fórmula de Cálculo
1. **Preço Base (Entulho)**: €150
2. **Multiplicador Região (Lisboa)**: 1.2x
3. **Adicional por Pessoas (2 pessoas)**: 2 × €30 = €60
4. **Adicional por Tempo (3 horas)**: 3 × €25 = €75
5. **Adicional por Acesso (Apartamento)**:
   - 4 andares × €15 = €60
   - Sem elevador: 4 andares × €20 = €80
   - Total acesso: €140
6. **Adicional por Dificuldade**: €0 (não marcado)

### Cálculo Final:
```
Base + Pessoas + Tempo + Acesso = €150 + €60 + €75 + €140 = €425
Aplicar multiplicador de região: €425 × 1.2 = €510
Total: €510
```

## Status do Teste
✅ **Formulário funcionando corretamente**
✅ **Campos condicionais (apartamento) aparecem corretamente**
✅ **Cálculo de preço funcionando**
✅ **Botão "Confirmar no WhatsApp" disponível**
✅ **Navegação entre páginas funcionando**

## Funcionalidades Testadas
- [x] Preenchimento de todos os campos
- [x] Seleção de dropdowns
- [x] Campos condicionais para apartamento
- [x] Cálculo automático de preço
- [x] Exibição do resultado
- [x] Botão de confirmação no WhatsApp
