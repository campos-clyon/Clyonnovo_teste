# Teste do Simulador de Orçamento - Nova Fórmula Clyon

## Dados do Teste
- **Tempo Estimado**: 3 horas
- **Região**: Lisboa
- **Quantidade de Pessoas**: 2 pessoas
- **Tipo de Material**: Entulho
- **Tipo de Acesso**: Apartamento
- **Número de Andares**: 4
- **Tem Elevador**: Não
- **Acesso Difícil**: Não marcado

## Resultado do Cálculo
**Orçamento Estimado: €264**

## Análise da Nova Fórmula de Cálculo

### Fórmula Implementada:
```
Custo Base = (Horas Trabalho + 2h Depósito) × Pessoas × €8/hora
Adicional Acesso = Apartamento (andares × €15) + Sem Elevador (andares × €20)
Adicional Dificuldade = €50 se marcado, €0 se não
Multiplicador Região = Margem Sul (1.1x), Lisboa (1.2x), Regiões Lisboa (1.15x)

Total = (Custo Base + Adicional Acesso + Adicional Dificuldade) × Multiplicador Região
```

### Cálculo Detalhado:

**1. Custo Base:**
- Horas de trabalho: 3h
- Horas de depósito (automático): 2h
- Total de horas: 5h
- Pessoas: 2
- **Custo base: 5h × 2 pessoas × €8/hora = €80**

**2. Adicional por Acesso (Apartamento):**
- 4 andares × €15 = €60
- Sem elevador: 4 andares × €20 = €80
- **Total acesso: €140**

**3. Adicional por Dificuldade:**
- Não marcado: **€0**

**4. Subtotal:**
- €80 (base) + €140 (acesso) + €0 (dificuldade) = **€220**

**5. Aplicar Multiplicador de Região (Lisboa 1.2x):**
- €220 × 1.2 = **€264**

## Alterações Implementadas
✅ **Cálculo de horas**: Agora usa €8/hora por pessoa
✅ **Depósito automático**: Sempre adiciona 2h ao tempo estimado
✅ **Campo renomeado**: "Tipo de Trabalho" → "Tipo de Material"
✅ **Nova opção**: "Misto" adicionada às opções de material
✅ **Mensagem WhatsApp**: Atualizada para refletir "Tipo de Material"

## Comparação com Fórmula Anterior
- **Fórmula Antiga**: Preço base fixo por tipo + adicionais = €510
- **Fórmula Nova**: Baseada em horas reais × pessoas = €264
- **Diferença**: A nova fórmula é mais precisa e reflete os valores reais da Clyon

## Status do Teste
✅ **Formulário funcionando corretamente**
✅ **Campos condicionais (apartamento) aparecem corretamente**
✅ **Cálculo de preço com nova fórmula funcionando**
✅ **Opção "Misto" disponível**
✅ **Botão "Confirmar no WhatsApp" funcionando**
✅ **Navegação entre páginas funcionando**
