# Teste Completo - Simulador Redesenhado (Form-Based)

## Resumo da Mudança

O simulador foi completamente redesenhado:
- **Antes**: Chat-based, conversa iterativa coletando dados
- **Depois**: Form-based, formulário completo em 6 seções + análise Gemini

## Arquitetura Nova

```
Cliente preenche formulário (7 seções)
         ↓
POST /api/simulator/analyze (Gemini)
         ↓
Review card (preço, complexidade, resumo)
         ↓
Cliente confirma
         ↓
POST /api/simulador/pedido (salva em BD)
         ↓
Order auto-assigned a Miriam
         ↓
Success card + Painéis atualizados
```

## Novos Ficheiros

1. **src/app/api/simulator/analyze/route.ts** (286 linhas)
   - Endpoint para análise com Gemini
   - Recebe dados do formulário
   - Retorna: status, preço, complexidade, resumo
   - Calcula VAT automaticamente (23%)

2. **src/app/simulador/SimulatorFormClient.tsx** (790 linhas)
   - Componente principal do formulário
   - 7 seções: Serviço, Fotos, Morada, Acesso, Urgência, Contacto
   - Form state management + localStorage draft
   - Validação de campos obrigatórios
   - Transitions: form → review → success

3. **src/app/simulador/components/SimulatorReviewCard.tsx** (322 linhas)
   - Card de revisão antes de confirmar
   - Mostra preço, complexidade, resumo
   - Opções: confirmar ou editar

4. **src/app/simulador/components/SimulatorSuccessCard.tsx** (71 linhas)
   - Screen de sucesso após pedido salvo
   - Mostra número do pedido
   - Botão para novo pedido

## Teste Passo a Passo

### Teste 1: Pedido Padrão (Eugênia Almeida)

**URL**: https://seu-site.pt/simulador

**Dados**:
- Nome: Eugênia Almeida
- Telefone: 911128863
- Email: menaga@hotmail.com
- Serviço: Recolha de móveis
- Descrição: 4 móveis velhos, 1 mesa redonda, 1 cadeira e 5 sacos com lixo
- Volume: 1/4 de carrinha
- Objetos pesados: Sofá grande, Cadeiras
- Morada: Rua Rui Coelho, Alto do Chapeleiro, Santa Clara, Lisboa
- Localidade: Lisboa
- Andar: Rés-do-chão
- Elevador: Não tem elevador
- Estacionamento: Sim, até 20 metros
- Urgência: Tenho flexibilidade
- Preferência: Telefone

**Verificações**:
1. ✓ Formulário carrega com 7 seções
2. ✓ Pode preencher todos os campos
3. ✓ Botão "Analisar pedido" ativa quando dados obrigatórios preenchidos
4. ✓ POST /api/simulator/analyze chamado
5. ✓ Gemini retorna análise em ~3-5 segundos
6. ✓ Review card mostra:
   - Preço estimado (ex: 140-180€ sem IVA)
   - IVA (23%)
   - Total com IVA
   - Complexidade (nível 2)
   - Resumo e pressupostos
7. ✓ Clica "Enviar pedido para análise"
8. ✓ POST /api/simulador/pedido chamado
9. ✓ Success card mostra:
   - Checkmark verde
   - "Pedido enviado com sucesso"
   - Número do pedido (ex: #123)
10. ✓ localStorage limpo

**Verificação no Backend**:
- Painel Wanderson: Vê novo pedido com dados de Eugênia
- Painel Miriam: Vê novo pedido (atribuído a si)
- Base de dados: simulatorOrders tem nova linha com status="atribuido"

### Teste 2: Pedido Grande (Onsite Recomendado)

**Dados Especiais**:
- Descrição: 100 sacos de entulho pesado
- Objetos pesados: Entulho pesado, Vasos/terra/pedra
- Andar: 4.º andar ou superior
- Elevador: Não tem elevador

**Resultado Esperado**:
- Gemini retorna status="onsite_required"
- Review card mostra alerta: "Análise presencial recomendada"
- Preço pode ser null (a ser confirmado presencialmente)
- Botão "Enviar pedido" ainda funciona
- Pedido salvo mesmo assim

### Teste 3: Reset (Novo Pedido)

**Ações**:
1. Após sucesso, clica "Criar Novo Pedido"
2. Formulário limpa completamente
3. F5 refresh não restaura dados antigos
4. localStorage_clyon_simulator_form_draft limpo

**Verificação**:
- ✓ Formulário vazio novamente
- ✓ Pode preencher novo pedido do zero
- ✓ Sem dados fantasma do pedido anterior

### Teste 4: Campos Obrigatórios

**Ação**: Tentar enviar sem preencher campos obrigatórios

**Resultado Esperado**:
- Botão "Analisar pedido" desativado
- Mensagem: "Campos obrigatórios em falta: [lista]"
- POST /api/simulator/analyze NÃO chamado

**Campos Obrigatórios**:
- Nome
- Telefone
- Tipo de serviço
- Descrição OU Fotos
- Morada
- Andar
- Elevador
- Estacionamento

### Teste 5: Upload de Fotos

**Ação**:
1. Clica no upload de fotos
2. Seleciona 2-3 imagens
3. Previews aparecem
4. Remove uma imagem
5. Submete form

**Resultado Esperado**:
- ✓ Fotos exibidas como previews
- ✓ Contador "2 ficheiros"
- ✓ Pode remover individual
- ✓ Análise e pedido salvos com referência às fotos

### Teste 6: Erro de API

**Simular Erro**:
1. Desativar internet ou mockear erro em /api/simulator/analyze
2. Tentar submeter form
3. Aguardar timeout

**Resultado Esperado**:
- ✓ Mensagem de erro amigável exibida
- ✓ Não mostra erro técnico
- ✓ Pode tentar novamente

## Verificação de Logs

Abrir DevTools → Console e procurar por:

### Logs de Análise (Gemini)
```
[v0] POST /api/simulator/analyze: Starting...
[v0] POST /api/simulator/analyze: ✓ Validated form data
[v0] POST /api/simulator/analyze: Calling Gemini with model=gemini-2.0-flash
[v0] POST /api/simulator/analyze: ✓ Gemini responded
[v0] POST /api/simulator/analyze: Parsing Gemini response...
[v0] POST /api/simulator/analyze: ✓ Analysis complete
```

### Logs de Confirmação
```
[v0] SimulatorReviewCard: Confirming order
[v0] SimulatorReviewCard: ✓ Order saved with ID: 123
```

### Logs de Backend
```
[v0] POST /api/simulador/pedido: Iniciando...
[v0] POST /api/simulador/pedido: Dados recebidos
[v0] POST /api/simulador/pedido: ✓ Pedido #123 CRIADO
[v0] pickLeastLoadedAssistant: ✓ Resultado final: Miriam (id=2)
[v0] POST /api/simulador/pedido: ✓ Pedido #123 atribuído a Miriam
```

## Checklist de Sucesso

- [ ] Formulário carrega com design moderno
- [ ] 7 seções visíveis (Serviço, Fotos, Morada, Acesso, Urgência, Contacto)
- [ ] Campos obrigatórios identificados com asterisco
- [ ] Validação funciona (botão desativa se campos faltam)
- [ ] Upload de fotos funciona
- [ ] Gemini API responde (3-5 segundos)
- [ ] Review card mostra preço estimado
- [ ] Preço calcula VAT corretamente
- [ ] Complexidade mostrada em 1-5
- [ ] Botão "Enviar pedido" funciona
- [ ] Pedido salvo em simulatorOrders
- [ ] Success card mostra número do pedido
- [ ] Painel Wanderson vê novo pedido
- [ ] Painel Miriam vê novo pedido
- [ ] Reset funciona ("Novo pedido")
- [ ] localStorage limpo após sucesso
- [ ] NENHUM botão WhatsApp em todo o fluxo
- [ ] Sem chat (interface é apenas form)

## Troubleshooting

### Problema: Botão "Analisar pedido" não funciona
**Solução**: Verificar se GOOGLE_GENAI_API_KEY está configurada em environment variables

### Problema: Gemini retorna erro
**Solução**: Verificar logs em console.error - pode ser timeout ou erro de modelo

### Problema: Pedido não aparece no painel de Miriam
**Solução**: Verificar se POST /api/simulador/pedido executou com sucesso (procurar "Pedido #X CRIADO" nos logs)

### Problema: Preço mostra como null
**Solução**: Esperado para onsite_required - será confirmado manualmente pela equipa

### Problema: Fotos não salvam
**Solução**: Atualmente fotos são apenas referências - Vercel Blob storage será adicionado depois

## Deploy

```bash
# Build
pnpm run build

# Teste local
pnpm run dev

# Deploy
vercel deploy --prod
```

## Próximos Passos

1. ✓ Form-based interface pronta
2. ✓ Gemini integration pronta
3. ✓ Auto-assignment pronta
4. ⏳ Google Places Autocomplete (address lookup)
5. ⏳ Distance calculation (Google Maps API)
6. ⏳ Vercel Blob storage (photo storage)
7. ⏳ Email notifications para cliente e equipa
8. ⏳ SMS notifications
9. ⏳ Admin notifications
10. ⏳ Agendamento automático via calendário

## Notas

- Chat-based flow completamente removido
- Nenhum botão WhatsApp no novo fluxo
- CLYON inicia contacto via telefone (stored em BD)
- localStorage draft garante não perder dados se browser crash
- Formulário responsivo (mobile-first approach)
- Validação client-side + server-side
- Gemini análise real (não hardcoded)
