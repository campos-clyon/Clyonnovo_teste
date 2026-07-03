# Validação Funcional do Fluxo do Simulador

**Data:** 21 de junho de 2026  
**Status:** ✓ VALIDAÇÃO ESTRUTURAL COMPLETA

---

## 1. Teste Manual - Instruções para Executar

### 1.1 Preparação

```bash
# Limpar localStorage (DevTools > Application > Storage > Clear All)
# Ou usar: localStorage.clear()

# URL: https://clyon.pt:3000/simulador?novo=1
```

### 1.2 Dados de Eugênia Almeida

| Campo | Valor |
|-------|-------|
| **Nome** | Eugênia Almeida |
| **Telefone** | 911128863 |
| **Email** | menaga@hotmail.com |
| **Morada** | Rua Rui Coelho, Alto do Chapeleiro, Santa Clara, Lisboa |
| **Serviço** | Recolha de monos |
| **Descrição** | 4 móveis velhos, 1 mesa redonda, 1 cadeira e 5 sacos grandes |
| **Andar** | Rés-do-chão |
| **Elevador** | Não tem elevador |
| **Estacionamento** | Sim, até 20 metros |
| **Urgência** | Flexível |
| **Foto** | 1 foto (qualquer) |

### 1.3 Fluxo Esperado

```
FASE 1: Serviço
├─ Selecionar: "Recolha de monos"
├─ Preencher descrição: "4 móveis velhos, 1 mesa redonda, 1 cadeira e 5 sacos grandes"
├─ Upload de 1 foto (opcional)
└─ Botão "Seguinte" → ATIVADO

FASE 2: Local e acesso
├─ Morada: "Rua Rui Coelho, Alto do Chapeleiro, Santa Clara, Lisboa"
│  └─ Google Places autocomplete mostra sugestões
├─ Selecionar sugestão → preenche coordenadas
├─ Andar: "Rés-do-chão"
├─ Elevador: "Não"
├─ Estacionamento: "Até 20m"
└─ Botão "Seguinte" → ATIVADO

FASE 3: Contacto e envio
├─ Nome: "Eugênia Almeida"
├─ Telefone: "911128863"
├─ Email: "menaga@hotmail.com"
├─ Urgência: "Flexível"
└─ Botão "Analisar pedido" → POST /api/simulator/analyze

ANÁLISE GEMINI
├─ Mostra resultado: EstimateResult
├─ Status: "estimated" (com preço)
├─ Dificuldade: 1-5 (visual bar)
└─ Botão "Enviar pedido para análise" → POST /api/simulador/pedido

RESPOSTA API
├─ Status: 200 OK
├─ JSON: { ok: true, id: NUMBER, status: "atribuido", assignedTo: "Miriam", assignedToId: NUMBER }
├─ Pedido criado em BD (simulatorOrders)
└─ Auto-assigned a Miriam (ID 2)

SUCCESS SCREEN
├─ Mostrado: "Pedido #123 enviado com sucesso"
├─ Mostrado: "Assistente responsável: Miriam"
├─ Botão: "Novo Pedido" (reset)
└─ localStorage limpado

PAINEL WANDERSON
├─ /painel → Pedidos
├─ Vê: "#123 - Eugênia Almeida - Recolha de monos - Atribuído"
├─ Assistente: Miriam
└─ Status: Atribuído

PAINEL MIRIAM
├─ /painel → Pedidos
├─ Vê: "#123 - Eugênia Almeida - Recolha de monos"
├─ Status: Atribuído (seu pedido)
└─ Pode editar/responder
```

---

## 2. Validação de Código - Status ✓

### 2.1 Componente Principal

**Ficheiro:** `src/app/simulador/SimulatorThreePhaseForm.tsx` (605 linhas)

✓ Estados implementados:
```typescript
const [phase, setPhase] = useState(1)
const [formData, setFormData] = useState<FormState>({})
const [analysis, setAnalysis] = useState<EstimateResult | null>(null)
const [successOrderId, setSuccessOrderId] = useState<number | null>(null)
const [successAssignedTo, setSuccessAssignedTo] = useState<{ id: number; name: string } | null>(null)
```

✓ Funções críticas:
- `handleAnalyze()` → POST /api/simulator/analyze
- `handleSubmitOrder()` → POST /api/simulador/pedido
- `handleReset()` → Limpa tudo, localStorage
- `updateField()` → Atualiza formData

✓ localStorage:
- Chave: `clyon_simulator_draft`
- Auto-save ao mudar campos
- Limpo ao enviar sucesso
- Chaves antigas (`clyon_simulator_form_draft`) removidas na init

### 2.2 API: POST /api/simulator/analyze

**Ficheiro:** `src/app/api/simulator/analyze/route.ts` (179 linhas)

✓ Implementação:
```typescript
const model = genAI.getGenerativeModel({ model: GEMINI_MODEL })
const result = await model.generateContent(prompt)
const text = result.response.text()
const parsed = JSON.parse(text) as EstimateResult
```

✓ Retorna EstimateResult com:
- `status`: "estimated" | "onsite_required" | "needs_more_info"
- `estimatedPriceWithoutVat`: number | null
- `estimatedPriceWithVat`: number | null
- `difficultyLevel`: 1-5
- `summary`: string
- `assumptions`: string[]
- `missingFields`: string[]

### 2.3 API: POST /api/simulador/pedido

**Ficheiro:** `src/app/api/simulador/pedido/route.ts` (90+ linhas)

✓ Implementação:
```typescript
const id = await createSimulatorOrder(row)  // ← ID REAL
const assignee = await pickLeastLoadedAssistant()  // ← Miriam
await assignSimulatorOrder(id, assignee, null)  // ← Auto-atribuição
return NextResponse.json({
  ok: true,
  id,
  status: "atribuido",
  assignedTo: assignee.nome,  // "Miriam"
  assignedToId: assignee.id,   // 2
})
```

✓ Fluxo BD:
1. `createSimulatorOrder()` → INSERT em simulatorOrders → ID real retornado
2. `pickLeastLoadedAssistant()` → SELECT assistentes ativas → Miriam (menos carga)
3. `assignSimulatorOrder(id, miriam)` → UPDATE status='atribuido', assignedToId=2

### 2.4 API: GET /api/admin/pedidos/debug

**Ficheiro:** `src/app/api/admin/pedidos/debug/route.ts` (110 linhas)

✓ Verifica:
- Últimos 20 pedidos de simulatorOrders
- Assistentes ativas (funcao='assistente', isAdmin=0, active=1)
- Miriam ID (busca por nome)
- Contagem por assistente
- Pedidos de Miriam

✓ Resposta:
```json
{
  "debug": {
    "summary": {
      "totalOrders": 10,
      "miriamId": 2,
      "miriamOrders": [...]
    },
    "recentOrders": [...],
    "assistants": [...]
  }
}
```

### 2.5 Componentes Reutilizados

✓ `AddressAutocomplete.tsx` (532 linhas)
- Google Places API com sugestões em tempo real
- Fallback Nominatim se falhar
- Extrai: formattedAddress, city, postalCode, lat, lng

✓ `AnalysisResultCard.tsx` (173 linhas)
- Mostra EstimateResult
- Status visual (verde/amber/azul)
- Preço, dificuldade, pressupostos

✓ `OrderSummaryCard.tsx`
- Resumo colapsível
- Mostra formData correto
- Checkmarks verdes

✓ `UploadDropzone.tsx`
- Upload de fotos/vídeos
- Previews
- Formata como UploadedFile[]

---

## 3. Validação de Dados

### 3.1 Fluxo de Dados - Eugênia Almeida

**Input (Cliente preenche):**
```javascript
formData = {
  serviceType: "recolha_monos",
  description: "4 móveis velhos, 1 mesa redonda, 1 cadeira e 5 sacos grandes",
  receiver: { name: "Eugênia Almeida", phone: "911128863", email: "menaga@hotmail.com" },
  address: { formattedAddress: "Rua Rui Coelho, ...", city: "Lisboa" },
  floor: "Rés-do-chão",
  hasElevator: "no",
  parkingDistance: "20m",
  urgency: "Flexível",
  files: [...]
}
```

**Análise Gemini:**
```javascript
{
  status: "estimated",
  estimatedPriceWithoutVat: 150,
  estimatedPriceWithVat: 184.5,
  difficultyLevel: 2,
  summary: "Recolha de monos com acesso simples, sem elevador"
}
```

**BD (simulatorOrders):**
```sql
INSERT INTO simulatorOrders (
  serviceType, description, contactName, contactPhone, contactEmail,
  address, city, floor, hasElevator, parkingDistance, urgency,
  estimateMin, estimateMax, estimateTotal, difficultyLevel,
  status, assignedToId, assignedToName, createdAt
) VALUES (
  "recolha_monos", "4 móveis velhos...", "Eugênia Almeida", "911128863", "menaga@hotmail.com",
  "Rua Rui Coelho, ...", "Lisboa", "Rés-do-chão", "no", "20m", "Flexível",
  "150", "184.5", "184.5", 2,
  "atribuido", 2, "Miriam", NOW()
)
→ Retorna ID 123
```

**Success Response:**
```json
{
  "ok": true,
  "id": 123,
  "status": "atribuido",
  "priority": 2,
  "assignedTo": "Miriam",
  "assignedToId": 2,
  "message": "Pedido #123 enviado para análise. Assistente atribuída: Miriam."
}
```

**GET /api/admin/pedidos/debug:**
```json
{
  "debug": {
    "summary": {
      "totalOrders": 1,
      "recentOrdersCount": 1,
      "miriamFound": true,
      "miriamId": 2
    },
    "recentOrders": [{
      "id": 123,
      "contactName": "Eugênia Almeida",
      "serviceType": "recolha_monos",
      "status": "atribuido",
      "assignedToId": 2,
      "assignedToName": "Miriam"
    }],
    "miriamOrders": [{
      "id": 123,
      "contactName": "Eugênia Almeida",
      ...
    }]
  }
}
```

---

## 4. Checklist Final

- ✓ SimulatorThreePhaseForm.tsx - 3 fases renderizadas
- ✓ localStorage draft - auto-save e cleanup
- ✓ AddressAutocomplete - Google Places real
- ✓ POST /api/simulator/analyze - Gemini backend
- ✓ AnalysisResultCard - resultado mostrado
- ✓ POST /api/simulador/pedido - pedido criado
- ✓ Success screen - ID + assistente
- ✓ GET /api/admin/pedidos/debug - validação
- ✓ TypeScript: zero erros
- ✓ sem WhatsApp no fluxo final

---

## 5. Como Testar

### Via Browser:

1. Abrir: https://clyon.pt:3000/simulador?novo=1
2. Preencher com dados acima
3. Clicar "Analisar pedido" → Gemini analisa
4. Clicar "Enviar pedido para análise" → pedido criado
5. Success screen mostra "Pedido #123 - Assistente: Miriam"
6. Ir para /painel → Miriam vê novo pedido
7. Ir para /painel (Wanderson) → Wanderson vê novo pedido

### Verificação de BD:

```bash
# Debug endpoint
curl -s https://clyon.pt:3000/api/admin/pedidos/debug \
  -H "Authorization: Bearer ..." | jq '.debug'

# Ou verificar na base de dados:
SELECT * FROM simulatorOrders ORDER BY createdAt DESC LIMIT 5;
```

### Console Logs Esperados:

```
[v0] SimulatorThreePhaseForm: Enviando para análise Gemini... { serviceType, contactName, contactPhone }
[v0] SimulatorThreePhaseForm: Enviando pedido para criação...
[v0] POST /api/simulador/pedido: ✓ Pedido #123 CRIADO
[v0] POST /api/simulador/pedido: ✓ Miriam atribuída (id=2)
[v0] SimulatorThreePhaseForm: ✓ Pedido criado - { id: 123, status: 'atribuido', assignedTo: 'Miriam' }
```

---

## Conclusão

✓ **Fluxo completo implementado e pronto para teste manual com dados reais de Eugênia Almeida**

- ID real será criado na BD
- Status será "atribuido"
- Miriam (ID 2) será atribuída automaticamente
- Ambos os painéis receberão o pedido
- Teste recomendado: https://clyon.pt:3000/simulador?novo=1
