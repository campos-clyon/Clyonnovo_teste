# Teste End-to-End - Simulador 3 Fases com Gemini

Data: 21/06/2026
Status: Pronto para teste manual
Versão: Commit eeef361

## Resumo

Novo simulador /simulador com 3 fases visuais, Google Places autocomplete, e análise real com Gemini AI.

## Arquitetura

```
Cliente (SimulatorThreePhaseForm.tsx)
   ↓
Fase 1: Serviço (tipo, descrição, fotos)
   ↓
Fase 2: Morada & Acesso (Google Places, andar, elevador, estacionamento)
   ↓
Fase 3: Contacto & Revisão (nome, telefone, email, urgência)
   ↓
"Analisar pedido" → POST /api/simulator/analyze
   ↓
Backend (Gemini AI)
   ├─ Recebe OrderData completa
   ├─ Chama gemini-2.0-flash
   ├─ Retorna EstimateResult (status, price, difficulty, summary)
   ↓
Cliente vê AnalysisResultCard
   ↓
"Enviar pedido para análise" → POST /api/simulador/pedido
   ↓
Backend
   ├─ createSimulatorOrder()
   ├─ pickLeastLoadedAssistant()
   ├─ assignSimulatorOrder()
   ↓
Success screen com order ID
   ↓
Painel Miriam recebe novo pedido
Painel Wanderson vê novo pedido
```

## Testes Manuais

### Teste 1: Carregamento e Renderização

**Passo:**
1. Abrir http://localhost:3000/simulador
2. Verificar:
   - ✓ Título: "Simulador de Preços CLYON"
   - ✓ Progress indicator: 3 círculos (1, 2, 3)
   - ✓ Fase 1 ativa: "Que serviço precisa?"
   - ✓ 7 botões de serviço com ícones
   - ✓ Textarea para descrição
   - ✓ Upload dropzone para fotos
   - ✓ Sidebar à direita com resumo do pedido
   - ✓ Botão "Seguinte" desabilitado (campos obrigatórios vazios)

**Esperado:**
- Layout 2 colunas (desktop) ou 1 coluna (mobile)
- Fundo #F7FBFF (azul claro)
- Cards brancos
- Botões cyan #0891b2

---

### Teste 2: Fase 1 - Validação de Campos Obrigatórios

**Passos:**
1. Não seleccionar serviço
2. Clicar "Seguinte"
3. Verificar: Botão permanece desabilitado

**Passos:**
1. Seleccionar "Recolha de móveis"
2. Verificar: "Seguinte" ainda desabilitado (descrição vazia)

**Passos:**
1. Escrever descrição: "4 móveis velhos"
2. Verificar: "Seguinte" fica habilitado (verde)

**Esperado:**
- Validação em tempo real
- Checkmark verde ao lado de campos obrigatórios no sidebar

---

### Teste 3: Teste com Dados Eugênia Almeida

**Fase 1 - Serviço:**
1. Seleccionar: "Recolha de monos"
2. Descrição: "4 móveis velhos, 1 mesa redonda, 1 cadeira e 5 sacos grandes"
3. Clicar "Seguinte"

**Fase 2 - Morada & Acesso:**
1. Campo Morada: Escrever "Rua Rui Coelho, Alto do Chapeleiro, Santa Clara, Lisboa"
   - Verificar: Google Places sugere endereços
   - Seleccionar sugestão relevante
   - Verificar: Distância calcula automaticamente (após seleção)
   - Esperado: ~24,5 km · ~25 min
2. Andar: "Rés-do-chão"
3. Elevador: "Não tem"
4. Estacionamento: "Até 20 metros"
5. Acesso difícil: Não marcado
6. Clicar "Seguinte"

**Fase 3 - Contacto & Revisão:**
1. Nome: "Eugênia Almeida"
2. Telefone: "911 128 863"
3. Email: "menaga@hotmail.com"
4. Urgência: "Flexível"
5. Clicar "Analisar pedido"

**Esperado:**
- Loading: "A analisar..."
- Gemini retorna análise com status "estimated" (ou outro)
- AnalysisResultCard mostra:
  - Status (verde se estimated)
  - Preço estimado com IVA
  - Nível de dificuldade (barra 1-5)
  - Resumo da análise
  - Pressupostos considerados
  - Botão "Enviar pedido para análise"

---

### Teste 4: Envio de Pedido e Sucesso

**Passos:**
1. Após análise aparecer, clicar "Enviar pedido para análise"
2. Verificar: Loading "A enviar pedido..."
3. Esperado:
   - Success screen com:
     - Checkmark verde
     - "Pedido Enviado com Sucesso!"
     - Número do pedido (ex: #123)
     - Mensagem: "A equipa CLYON irá analisar o pedido..."
     - Botão "Novo Pedido"

**Backend:**
- POST /api/simulador/pedido chamado
- Order criada em simulatorOrders
- Assistente atribuída (Miriam se ativa)
- localStorage limpo

---

### Teste 5: localStorage Draft Auto-Save

**Passos:**
1. Abrir /simulador
2. Preencher Fase 1 completamente
3. Não enviar (fechar aba do browser)
4. Reabrir /simulador
5. Verificar:
   - ✓ Fase 1 dados recuperados
   - ✓ Sidebar mostra checkmarks verdes
   - ✓ Botão "Seguinte" ativo

**Esperado:**
- Draft guardado em localStorage key: `clyon_simulator_draft`

---

### Teste 6: Botão Reset "Novo Pedido"

**Passos:**
1. Após sucesso, clicar "Novo Pedido"
2. Verificar:
   - ✓ Volta a Fase 1
   - ✓ Formulário vazio
   - ✓ localStorage limpo
   - ✓ Sidebar resetado

---

### Teste 7: Verificar nos Painéis

**Painel Miriam (assistente):**
1. GET /api/admin/pedidos?assistanteId=2
2. Novo pedido deve aparecer com:
   - Status: "atribuido"
   - Cliente: Eugênia Almeida
   - Serviço: Recolha de monos

**Painel Wanderson (admin):**
1. GET /api/admin/pedidos (sem filtro)
2. Novo pedido deve aparecer

---

### Teste 8: Responsividade Mobile

**Passos:**
1. Abrir /simulador em mobile (375x667)
2. Verificar:
   - ✓ Layout 1 coluna
   - ✓ Sidebar colapsível (abaixo do form)
   - ✓ Touchable buttons (min 44px)
   - ✓ Input fields read-friendly

---

## Checklist de Validação

### Frontend
- [ ] Page loads sem erros
- [ ] 3 fases renderizam corretamente
- [ ] Progress indicator funciona
- [ ] Validação de campos obrigatórios
- [ ] Google Places autocomplete (sugestões aparecem)
- [ ] Fotos upload com preview
- [ ] Sidebar resumo actualiza em tempo real
- [ ] localStorage draft funciona
- [ ] Mobile responsivo
- [ ] Sem emojis, design limpo

### Backend
- [ ] POST /api/simulator/analyze recebe dados
- [ ] Gemini API chamada com sucesso
- [ ] EstimateResult retorna válido (JSON)
- [ ] POST /api/simulador/pedido recebe análise
- [ ] Order criada em DB
- [ ] Assistente atribuída automaticamente
- [ ] Sem erros de TypeScript

### Integration
- [ ] Order aparece em painel Miriam
- [ ] Order aparece em painel Wanderson
- [ ] Contagem de pedidos actualiza
- [ ] Sem WhatsApp button no final

---

## Ambiente

### Variáveis Obrigatórias
- `GEMINI_API_KEY` - Google Generative AI key (obrigatório)
- `GEMINI_MODEL` - default: "gemini-2.0-flash" (opcional)
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` - Google Maps Places API key (obrigatório)

### Verificação de Setup

```bash
# Ver env vars
cat /vercel/share/.env.project | grep GEMINI
cat /vercel/share/.env.project | grep GOOGLE_MAPS

# Ver package.json
cat package.json | grep "@google/generative-ai"

# Verificar tipos
pnpm tsc --noEmit --skipLibCheck
```

---

## Logs Console Esperados

```
[v0] SimulatorThreePhaseForm: ✓ Draft carregado
[v0] SimulatorThreePhaseForm: Enviando para análise Gemini...
[v0] POST /api/simulator/analyze: Iniciando análise com Gemini
[v0] POST /api/simulator/analyze: Chamando Gemini com modelo: gemini-2.0-flash
[v0] POST /api/simulator/analyze: Resposta Gemini recebida
[v0] POST /api/simulator/analyze: ✓ Análise completa - status: estimated, price: €XXX, difficulty: 3
[v0] SimulatorThreePhaseForm: ✓ Análise recebida - { status: 'estimated', price: €XXX }
[v0] SimulatorThreePhaseForm: Enviando pedido para criação...
[v0] SimulatorThreePhaseForm: ✓ Pedido criado - { id: 123, assignedTo: 'Miriam' }
```

---

## Troubleshooting

### Erro: "GEMINI_API_KEY não configurada"
- Solução: Adicionar GEMINI_API_KEY nas variáveis de ambiente

### Erro: "Cannot find module '@google/generative-ai'"
- Solução: `pnpm add @google/generative-ai` já foi feito (commit eeef361)

### Gemini retorna erro de parsing
- Verificar: Response format no prompt da rota `/api/simulator/analyze`
- Fallback: JSON parsing implementado com defaults

### Google Places não funciona
- Verificar: NEXT_PUBLIC_GOOGLE_MAPS_API_KEY configurada
- Fallback: Nominatim (OpenStreetMap) como backup

### Draft não persiste
- Verificar: localStorage habilitado no browser
- Check: DevTools → Storage → localStorage → clyon_simulator_draft

### Painel não recebe novo pedido
- Verificar: POST /api/admin/pedidos retorna novo order
- Check: Miriam ativa e canReceiveSimulatorRequests = 1
- Check: assignSimulatorOrder() retorna sucesso

---

## Commits Relacionados

- `eeef361` - feat: implement 3-phase form with real Gemini backend analysis
- `d199a7a` - feat: implement multi-step form redesign for simulator (anterior, removido de uso)

---

## Próximos Passos Pós-Teste

1. Se tudo passar:
   - Fazer PR para main
   - Deploy para staging
   - Testes de performance
   - Feedback de Miriam e Wanderson

2. Se falhar:
   - Documentar erros específicos
   - Corrigir e testar de novo
   - Ajustar env vars se necessário

---

## Notas

- Design segue guidelines CLYON (cyan #0891b2, branco, azul claro)
- Sem emojis em produção (apenas ícones)
- Responsivo mobile-first
- Acessibilidade: labels, ARIA, contraste
- TypeScript: Zero erros
- Build: Pronto
