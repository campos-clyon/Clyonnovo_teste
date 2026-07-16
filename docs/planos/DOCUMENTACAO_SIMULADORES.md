# 📊 Documentação Completa dos Simuladores de Orçamento - CLYON.pt

## Visão Geral

O sistema de simuladores de orçamento da CLYON.pt possui **4 categorias principais** de serviços, cada uma com sua própria lógica de cálculo:

1. **Móveis** - Recolha e remoção de móveis antigos ou danificados
2. **Entulho** - Remoção de entulho de obras e construção
3. **Móveis e Monos** - Combinação de móveis e limpeza de espaços
4. **Mudanças** - Serviço completo de mudança de residências ou comércios

---

## 1️⃣ SIMULADOR DE MÓVEIS

### Descrição
Serviço de recolha e remoção de móveis antigos ou danificados. O cliente pode escolher entre dois métodos de cálculo:
- **Por Item**: Especificar quantidade e tamanho de cada móvel
- **Por Carga**: Informar tempo estimado e número de pessoas

### Campos Disponíveis

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| Tipo de Móvel | Select | Sim | Escolher entre "Por Item" ou "Por Carga" |
| Tipo de Acesso | Select | Sim | "Casa" ou "Apartamento" |
| Número de Andares | Input | Condicional | Obrigatório se "Apartamento" |
| Tem Elevador? | Select | Condicional | "Sim" ou "Não" (se Apartamento) |
| Acesso Difícil | Checkbox | Não | Marcar se acesso é complicado |
| Região | Select | Sim | "Margem Sul", "Lisboa" ou "Regiões de Lisboa" |
| Quantidade de Pessoas | Input | Sim | Número de pessoas para o trabalho |
| Tempo Estimado | Input | Sim | Horas estimadas para conclusão |

---

### 1.1 MÓVEIS POR ITEM

#### Campos Específicos
- **Móvel Pequeno**: Quantidade (ex: cadeiras, mesas pequenas)
- **Móvel Médio**: Quantidade (ex: estantes, camas simples)
- **Móvel Grande**: Quantidade (ex: sofás, camas de casal, armários)

#### Preços Base por Item
```
Móvel Pequeno:  €5
Móvel Médio:    €7
Móvel Grande:   €13
```

#### Fórmula de Cálculo

```
SUBTOTAL_BASE = (Qtd_Pequeno × €5) + (Qtd_Médio × €7) + (Qtd_Grande × €13)
                + (Distância × €2)
                + Custo_Acesso
                + Custo_Dificuldade

MARGEM = SUBTOTAL_BASE × 0.40 (40%)

PREÇO_FINAL = SUBTOTAL_BASE + MARGEM
```

#### Detalhamento dos Componentes

**1. Custo de Itens**
```javascript
custoItens = (qtdPequeno * 5) + (qtdMedio * 7) + (qtdGrande * 13)
```
Soma simples do custo de cada móvel conforme quantidade e tamanho.

**2. Custo de Distância**
```javascript
custoDistancia = (distancia || 0) * 2  // €2 por km
```
Aplicado quando há distância entre origem e destino.

**3. Custo de Acesso (Apartamento)**
```javascript
if (tipoAcesso === "apartamento") {
  if (temElevador === "sim") {
    adicionalAcesso = andares * 3     // €3 por andar COM elevador
  } else if (temElevador === "nao") {
    adicionalAcesso = andares * 6     // €6 por andar SEM elevador
  }
}
```
- **Com Elevador**: €3 por andar (acesso facilitado)
- **Sem Elevador**: €6 por andar (acesso mais difícil, maior esforço)
- **Casa**: Sem custo adicional

**4. Custo de Acesso Difícil**
```javascript
adicionalDificuldade = acessoDificil ? 30 : 0  // €30 se marcado
```
Taxa fixa de €30 quando o acesso é complicado (escadas estreitas, portas pequenas, etc).

**5. Margem de 40%**
```javascript
margem = subtotalBase * 0.40
subtotal = subtotalBase + margem
```
Aplicada sobre o subtotal para cobrir custos operacionais e lucro.

#### Exemplo Prático

**Cenário**: Cliente em Lisboa, apartamento no 4º andar COM elevador, 1 móvel grande, sem distância adicional, acesso normal.

```
Custo de Itens:        €13 (1 × €13)
Custo de Distância:    €0
Custo de Acesso:       €12 (4 andares × €3)
Custo de Dificuldade:  €0
─────────────────────────────
SUBTOTAL_BASE:         €25

Margem 40%:            €10 (€25 × 0.40)
─────────────────────────────
PREÇO FINAL:           €35
```

---

### 1.2 MÓVEIS POR CARGA

#### Campos Específicos
- **Número de Cargas**: Quantas viagens/cargas serão necessárias
- **Tempo Estimado**: Horas totais de trabalho
- **Quantidade de Pessoas**: Número de trabalhadores

#### Fórmula de Cálculo

```
HORAS_REAIS = Tempo_Estimado + 2 horas (descarregar carrinha)
PESSOAS_REAIS = Quantidade_Pessoas + 1 (motorista/carrinha)

CUSTO_MAO_DE_OBRA = Horas_Reais × Pessoas_Reais × €8/hora

SUBTOTAL_BASE = Custo_Mão_de_Obra + Adicional_Região

MARGEM = SUBTOTAL_BASE × 0.35 (35%)

SUBTOTAL_COM_MARGEM = SUBTOTAL_BASE + Custo_Acesso + Custo_Dificuldade + MARGEM

PREÇO_FINAL = SUBTOTAL_COM_MARGEM × Número_Cargas
```

#### Detalhamento dos Componentes

**1. Cálculo de Horas e Pessoas Reais**
```javascript
const horasReais = horasUsuario + 2;      // +2 horas fixas para descarregar
const pessoasReais = pessoasUsuario + 1;  // +1 para motorista/carrinha
```
- **Horas Reais**: Tempo informado + 2 horas (tempo fixo para descarregar a carrinha)
- **Pessoas Reais**: Pessoas informadas + 1 (motorista que acompanha)

**2. Custo de Mão de Obra**
```javascript
custoMaoDeObra = horasReais * pessoasReais * 8  // €8/hora/pessoa
```
Tarifa: €8 por hora por pessoa (diferente dos €9 de outras categorias).

**3. Adicional de Região**
```javascript
if (regiao === "margem-sul") adicionalRegiao = 20;
else if (regiao === "lisboa") adicionalRegiao = 45;
else if (regiao === "regioes-lisboa") adicionalRegiao = 45;
```
- **Margem Sul**: €20
- **Lisboa**: €45
- **Regiões de Lisboa**: €45

**4. Custo de Acesso (igual ao "Por Item")**
```javascript
if (tipoAcesso === "apartamento") {
  if (temElevador === "sim") {
    adicionalAcesso = andares * 3
  } else if (temElevador === "nao") {
    adicionalAcesso = andares * 6
  }
}
```

**5. Custo de Acesso Difícil**
```javascript
adicionalDificuldade = acessoDificil ? 30 : 0
```

**6. Margem de 35%**
```javascript
margem = subtotalBase * 0.35  // 35% (menor que "Por Item")
```
Margem menor (35% vs 40%) porque o cálculo por carga é mais flexível.

**7. Multiplicação por Número de Cargas**
```javascript
numeroCargas = parseInt(moveisCargas) || 1
subtotal = subtotalComMargem * numeroCargas
```
O preço final é multiplicado pelo número de cargas necessárias.

#### Exemplo Prático

**Cenário**: Cliente em Lisboa, apartamento 3º andar COM elevador, 2 horas de trabalho, 2 pessoas, 2 cargas.

```
Horas Reais:           4 horas (2 + 2 fixas)
Pessoas Reais:         3 pessoas (2 + 1 motorista)
Custo Mão de Obra:     €96 (4 × 3 × €8)

Adicional Região:      €45 (Lisboa)
─────────────────────────────
SUBTOTAL_BASE:         €141

Custo Acesso:          €9 (3 andares × €3)
Custo Dificuldade:     €0
Margem 35%:            €49.35 (€141 × 0.35)
─────────────────────────────
SUBTOTAL_COM_MARGEM:   €199.35

Multiplicar por 2 cargas: €398.70
─────────────────────────────
PREÇO FINAL:           €398.70
```

---

## 2️⃣ SIMULADOR DE ENTULHO

### Descrição
Serviço de remoção de entulho de obras e construção. O cliente especifica a quantidade de entulho em sacos ou volume.

### Campos Disponíveis

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| Entulho em Sacos ou Chão | Select | Sim | "Sacos" ou "Chão" |
| Quantidade de Sacos | Input | Sim | Número de sacos de entulho |
| Tipo de Acesso | Select | Sim | "Casa" ou "Apartamento" |
| Número de Andares | Input | Condicional | Obrigatório se "Apartamento" |
| Tem Elevador? | Select | Condicional | "Sim" ou "Não" (se Apartamento) |
| Acesso Difícil | Checkbox | Não | Marcar se acesso é complicado |
| Região | Select | Sim | "Margem Sul", "Lisboa" ou "Regiões de Lisboa" |
| Quantidade de Pessoas | Input | Sim | Número de pessoas para o trabalho |
| Tempo Estimado | Input | Sim | Horas estimadas para conclusão |

### Preços Base

```
Mão de Obra:           €9/hora/pessoa
Entulho em Sacos:      €1/saco
Entulho no Chão:       €1.50/saco
Acesso com Elevador:   €3/andar
Acesso sem Elevador:   €6/andar
Acesso Difícil:        €30
Margem Sul:            €20
Lisboa/Regiões Lisboa: €45
```

### Fórmula de Cálculo

```
CUSTO_MAO_DE_OBRA = Tempo_Estimado × Quantidade_Pessoas × €9

CUSTO_MATERIAL = Quantidade_Sacos × (€1 se Sacos, €1.50 se Chão)

CUSTO_REGIAO = €20 (Margem Sul) ou €45 (Lisboa/Regiões)

CUSTO_ACESSO = (€3 × Andares com elevador) ou (€6 × Andares sem elevador)

CUSTO_DIFICULDADE = €30 se acesso difícil, €0 caso contrário

PREÇO_FINAL = Mão_de_Obra + Material + Região + Acesso + Dificuldade
```

#### Detalhamento dos Componentes

**1. Custo de Mão de Obra**
```javascript
custoMaoDeObra = horasTrabalho * pessoas * 9  // €9/hora/pessoa
```
Tarifa padrão para trabalho de remoção.

**2. Custo de Material (Entulho)**
```javascript
if (entulhoEmSacos === "sacos") {
  adicionalMaterial = sacos * 1      // €1 por saco
} else if (entulhoEmSacos === "chao") {
  adicionalMaterial = sacos * 1.5    // €1.50 por saco no chão
}
```
- **Em Sacos**: €1 por saco (mais fácil de manusear)
- **No Chão**: €1.50 por saco (mais trabalhoso)

**3. Custo de Região**
```javascript
if (regiao === "margem-sul") adicionalRegiao = 20;
else if (regiao === "lisboa") adicionalRegiao = 45;
else if (regiao === "regioes-lisboa") adicionalRegiao = 45;
```

**4. Custo de Acesso**
```javascript
if (tipoAcesso === "apartamento") {
  if (temElevador === "sim") {
    adicionalAcesso = andares * 3
  } else if (temElevador === "nao") {
    adicionalAcesso = andares * 6
  }
}
```

**5. Custo de Acesso Difícil**
```javascript
adicionalDificuldade = acessoDificil ? 30 : 0
```

**6. Soma Simples (Sem Margem Adicional)**
```javascript
subtotal = custoMaoDeObra + adicionalMaterial + adicionalRegiao 
           + adicionalAcesso + adicionalDificuldade
```
Diferente de outras categorias, não há margem percentual aplicada.

#### Exemplo Prático

**Cenário**: Cliente em Lisboa, apartamento 2º andar COM elevador, 50 sacos de entulho no chão, 3 horas de trabalho, 2 pessoas.

```
Custo Mão de Obra:     €54 (3 × 2 × €9)
Custo Material:        €75 (50 × €1.50)
Custo Região:          €45 (Lisboa)
Custo Acesso:          €6 (2 andares × €3)
Custo Dificuldade:     €0
─────────────────────────────
PREÇO FINAL:           €180
```

---

## 3️⃣ SIMULADOR DE MÓVEIS E MONOS

### Descrição
Combinação de serviços: recolha de móveis + limpeza de espaços. Utiliza a mesma lógica do simulador de Entulho, mas com aplicação de ambos os custos.

### Campos Disponíveis

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| Entulho em Sacos ou Chão | Select | Sim | "Sacos" ou "Chão" |
| Quantidade de Sacos | Input | Sim | Número de sacos de entulho |
| Tipo de Acesso | Select | Sim | "Casa" ou "Apartamento" |
| Número de Andares | Input | Condicional | Obrigatório se "Apartamento" |
| Tem Elevador? | Select | Condicional | "Sim" ou "Não" (se Apartamento) |
| Acesso Difícil | Checkbox | Não | Marcar se acesso é complicado |
| Região | Select | Sim | "Margem Sul", "Lisboa" ou "Regiões de Lisboa" |
| Quantidade de Pessoas | Input | Sim | Número de pessoas para o trabalho |
| Tempo Estimado | Input | Sim | Horas estimadas para conclusão |

### Fórmula de Cálculo

```
CUSTO_MAO_DE_OBRA = Tempo_Estimado × Quantidade_Pessoas × €9

CUSTO_MATERIAL = Quantidade_Sacos × (€1 se Sacos, €1.50 se Chão)

CUSTO_REGIAO = €20 (Margem Sul) ou €45 (Lisboa/Regiões)

CUSTO_ACESSO = (€3 × Andares com elevador) ou (€6 × Andares sem elevador)

CUSTO_DIFICULDADE = €30 se acesso difícil, €0 caso contrário

PREÇO_FINAL = Mão_de_Obra + Material + Região + Acesso + Dificuldade
```

**Nota**: A fórmula é idêntica ao Simulador de Entulho. A diferença está na descrição do serviço (combinação de móveis + limpeza) e no contexto de uso.

---

## 4️⃣ SIMULADOR DE MUDANÇAS

### Descrição
Serviço completo de mudança de residências ou comércios. Inclui cálculo de distância entre endereços de partida e chegada, com integração do Google Maps.

### Campos Disponíveis

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| Endereço de Partida | Input com Autocomplete | Sim | Endereço de origem (autocomplete Google Maps) |
| Endereço de Chegada | Input com Autocomplete | Sim | Endereço de destino (autocomplete Google Maps) |
| Distância | Display | Calculada | Distância em km (calculada automaticamente) |
| Tipo de Acesso | Select | Sim | "Casa" ou "Apartamento" |
| Número de Andares | Input | Condicional | Obrigatório se "Apartamento" |
| Tem Elevador? | Select | Condicional | "Sim" ou "Não" (se Apartamento) |
| Acesso Difícil | Checkbox | Não | Marcar se acesso é complicado |
| Região | Select | Sim | "Margem Sul", "Lisboa" ou "Regiões de Lisboa" |
| Quantidade de Pessoas | Input | Sim | Número de pessoas para o trabalho |
| Tempo Estimado | Input | Sim | Horas estimadas para conclusão |

### Preços Base

```
Mão de Obra:           €9/hora/pessoa
Distância:             €2/km
Acesso com Elevador:   €3/andar
Acesso sem Elevador:   €6/andar
Acesso Difícil:        €30
Margem Sul:            €20
Lisboa/Regiões Lisboa: €45
Margem Final:          40%
```

### Fórmula de Cálculo

```
CUSTO_MAO_DE_OBRA = Tempo_Estimado × Quantidade_Pessoas × €9

CUSTO_REGIAO = €20 (Margem Sul) ou €45 (Lisboa/Regiões)

CUSTO_ACESSO = (€3 × Andares com elevador) ou (€6 × Andares sem elevador)

CUSTO_DIFICULDADE = €30 se acesso difícil, €0 caso contrário

SUBTOTAL_BASE = Mão_de_Obra + Região + Acesso + Dificuldade

CUSTO_DISTANCIA = Distância_km × €2

SUBTOTAL_COM_DISTANCIA = SUBTOTAL_BASE + CUSTO_DISTANCIA

MARGEM = SUBTOTAL_COM_DISTANCIA × 0.40 (40%)

PREÇO_FINAL = SUBTOTAL_COM_DISTANCIA + MARGEM
```

#### Detalhamento dos Componentes

**1. Custo de Mão de Obra**
```javascript
custoMaoDeObra = horasTrabalho * pessoas * 9  // €9/hora/pessoa
```

**2. Custo de Região**
```javascript
if (regiao === "margem-sul") adicionalRegiao = 20;
else if (regiao === "lisboa") adicionalRegiao = 45;
else if (regiao === "regioes-lisboa") adicionalRegiao = 45;
```

**3. Custo de Acesso**
```javascript
if (tipoAcesso === "apartamento") {
  if (temElevador === "sim") {
    adicionalAcesso = andares * 3
  } else if (temElevador === "nao") {
    adicionalAcesso = andares * 6
  }
}
```

**4. Custo de Acesso Difícil**
```javascript
adicionalDificuldade = acessoDificil ? 30 : 0
```

**5. Custo de Distância**
```javascript
custoDistancia = distancia * 2  // €2 por km
```
Calculado usando Google Maps Directions API para obter a distância real de condução.

**6. Margem de 40%**
```javascript
margem = subtotalComDistancia * 0.40
subtotal = subtotalComDistancia + margem
```
Aplicada sobre o subtotal incluindo distância.

#### Cálculo de Distância

O sistema utiliza a **Google Maps Directions API** para calcular a distância real entre dois endereços:

```javascript
// 1. Geocodificar ambos os endereços
const coordPartida = await geocodificarEndereco(enderecoPartida);
const coordDestino = await geocodificarEndereco(enderecoCheagada);

// 2. Usar Directions Service para obter distância de condução
const result = await directionsServiceRef.current.route({
  origin: coordPartida,
  destination: coordDestino,
  travelMode: window.google.maps.TravelMode.DRIVING
});

// 3. Extrair distância em km
const distanciaMetros = result.routes[0].legs[0].distance.value;
const distanciaKm = distanciaMetros / 1000;
```

**Características**:
- Usa modo de condução (DRIVING) para calcular rotas reais
- Arredonda para 1 casa decimal (ex: 13.7 km)
- Valida ambos os endereços antes de calcular
- Exibe erro se não conseguir encontrar rota

#### Exemplo Prático

**Cenário**: Mudança de Lisboa para Almada, apartamento 4º andar SEM elevador, 5 horas de trabalho, 2 pessoas, distância 13.7 km.

```
Custo Mão de Obra:     €90 (5 × 2 × €9)
Custo Região:          €45 (Lisboa)
Custo Acesso:          €24 (4 andares × €6)
Custo Dificuldade:     €0
─────────────────────────────
SUBTOTAL_BASE:         €159

Custo Distância:       €27.40 (13.7 × €2)
─────────────────────────────
SUBTOTAL_COM_DISTANCIA: €186.40

Margem 40%:            €74.56 (€186.40 × 0.40)
─────────────────────────────
PREÇO FINAL:           €260.96
```

---

## 📋 Resumo Comparativo

| Aspecto | Móveis Por Item | Móveis Por Carga | Entulho | Mudanças |
|--------|-----------------|------------------|---------|----------|
| **Mão de Obra** | - | €8/hora/pessoa | €9/hora/pessoa | €9/hora/pessoa |
| **Custo Base** | €5-€13 por móvel | Horas × Pessoas × €8 | Horas × Pessoas × €9 | Horas × Pessoas × €9 |
| **Material** | - | - | €1-€1.50/saco | - |
| **Distância** | €2/km | - | - | €2/km |
| **Margem** | 40% | 35% | 0% | 40% |
| **Multiplicador** | - | Por número de cargas | - | - |
| **Google Maps** | Não | Não | Não | Sim |

---

## 🔧 Integração com WhatsApp

Após calcular o orçamento, o cliente pode confirmar via WhatsApp. O sistema redireciona para:

- **Mudanças**: +351 924 370 335 (com detalhes da mudança)
- **Outras Categorias**: +351 931 632 622 (número padrão)

A mensagem inclui:
- Valor do orçamento
- Endereços (se aplicável)
- Distância (se aplicável)
- Detalhes do serviço

---

## 📱 Fluxo do Usuário

1. **Selecionar Categoria**: Usuário escolhe entre Móveis, Entulho, Móveis e Monos ou Mudanças
2. **Preencher Formulário**: Campos específicos conforme categoria
3. **Calcular Orçamento**: Sistema aplica fórmula correspondente
4. **Visualizar Resultado**: Preço final exibido com breakdown
5. **Confirmar via WhatsApp**: Redirecionamento com detalhes

---

## ✅ Validações

- **Campos Obrigatórios**: Todos os campos marcados como obrigatórios devem ser preenchidos
- **Números Positivos**: Quantidade, horas e andares devem ser maiores que 0
- **Endereços (Mudanças)**: Ambos endereços devem ser válidos e diferentes
- **Distância**: Deve ser calculada antes de confirmar orçamento de mudança

---

## 🚀 Próximas Melhorias Sugeridas

1. **Descontos Progressivos**: 5% acima de €300, 10% acima de €500
2. **Histórico de Orçamentos**: Salvar cálculos no banco de dados
3. **Simulador de Entulho**: Adicionar opção de volume (m³) além de sacos
4. **Múltiplas Regiões**: Expandir para mais regiões além de Margem Sul e Lisboa
5. **Agendamento Direto**: Integrar calendário para agendar serviço após orçamento
6. **Notificações**: Enviar confirmação por email após WhatsApp

---

**Última atualização**: Fevereiro 2026
**Versão**: 1.0
**Status**: Todos os simuladores funcionais com 8 testes vitest passando
