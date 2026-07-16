# Teste Completo do Novo Simulador Multi-Passo

## Resumo das Mudanças

**Antes**: Chat iterativo pedindo dados um campo de cada vez
**Depois**: Formulário visual com 6 passos, resumo colapsível, sucesso confirmado

## Arquitetura

### Novo Fluxo
```
Cliente acessa /simulador
  ↓
SimulatorMultiStepForm renderiza 6 passos
  ↓
Cliente preenche dados (com draft auto-save)
  ↓
Clica botão "Enviar Pedido" no passo 6
  ↓
POST /api/simulador/pedido chamado
  ├─ createSimulatorOrder() → INSERT em simulatorOrders
  ├─ pickLeastLoadedAssistant() → Retorna Miriam
  ├─ assignSimulatorOrder() → Status "atribuido"
  └─ Retorna { ok: true, id: 123, ... }
  ↓
Success screen mostra "Pedido Enviado com Sucesso"
  ↓
Cliente clica "Novo Pedido"
  ├─ localStorage cleared
  ├─ Form resetado
  └─ Retorna ao passo 1
```

## 6 Passos do Formulário

### Passo 1: Serviço (obrigatório)
- Campo: "Que serviço precisa?" (dropdown)
- Campo: "Descrição do que precisa recolher" (textarea)
- Campos opcionais: Volume, Objetos pesados, Desmontagem
- Próximo: Habilitado se serviceType + description preenchidos

### Passo 2: Fotos/Vídeos (opcional)
- Upload de ficheiros (drag & drop ou clique)
- Mostra previews de imagens
- Contador de ficheiros
- Próximo: Sempre habilitado

### Passo 3: Morada (obrigatório)
- Campo: "Morada completa" (ex: Rua Principal, 123)
- Campo: "Localidade" (ex: Lisboa)
- Próximo: Habilitado se address + city preenchidos

### Passo 4: Acesso (recomendado)
- "Em que andar está o material?" (dropdown)
- "Tem elevador?" (dropdown)
- "A carrinha consegue estacionar perto?" (dropdown)
- "Há acesso complicado?" (dropdown)

### Passo 5: Urgência (recomendado)
- "Quando precisa do serviço?" (dropdown: Hoje, Amanhã, Esta semana, Flexível)

### Passo 6: Contacto (obrigatório)
- Campo: "Nome" (obrigatório)
- Campo: "Telefone" (obrigatório)
- Campo: "E-mail" (opcional)
- Botão: "Enviar Pedido" (ativa POST /api/simulador/pedido)

### Passo 7: Sucesso
- Mostra checkmark verde
- Mensagem de confirmação
- Botão "Novo Pedido" (limpa tudo e volta ao passo 1)

## Teste Prático

### Teste 1: Pedido Completo (Eugênia Almeida)

**Dados de Entrada:**
```
Passo 1:
- Serviço: "Recolha de móveis"
- Descrição: "4 móveis velhos, 1 mesa redonda, 5 sacos grandes"
- Volume: "1/4 de carrinha"
- Objetos pesados: Marcar "Sofá grande"
- Desmontagem: "Sim, simples"

Passo 2:
- (Opcional) Upload 1-2 fotos de teste

Passo 3:
- Morada: "Rua Rui Coelho, Alto do Chapeleiro, Santa Clara, Lisboa"
- Localidade: "Lisboa"

Passo 4:
- Andar: "Rés-do-chão"
- Elevador: "Não tem elevador"
- Estacionamento: "Sim, até 20 metros"
- Acesso: "Não"

Passo 5:
- Urgência: "Tenho flexibilidade"

Passo 6:
- Nome: "Eugênia Almeida"
- Telefone: "911128863"
- Email: "menaga@hotmail.com"
- Clique: "Enviar Pedido"
```

**Resultado Esperado:**
1. ✓ Botão "Enviar Pedido" desabilitado até passo 6 estar completo
2. ✓ localStorage contém "clyon_simulator_form_draft" enquanto preenche
3. ✓ Clique em "Enviar Pedido" → loading state ("Guardando...")
4. ✓ Console mostra: `[v0] SimulatorMultiStepForm: Submitting order...`
5. ✓ Console mostra: `[v0] SimulatorMultiStepForm: ✓ Order saved { id: X, ... }`
6. ✓ Tela muda para "Pedido Enviado com Sucesso" (passo 7)
7. ✓ localStorage "clyon_simulator_form_draft" removido

### Teste 2: Validação de Campos Obrigatórios

**Fluxo:**
1. Acesso /simulador
2. Passo 1: Deixar campos vazios
3. Tentar avançar → Botão "Seguinte" desabilitado
4. Preencher "Serviço" mas deixar "Descrição" vazia
5. Botão ainda desabilitado
6. Preencher ambos → Botão habilitado
7. Avançar para Passo 3
8. Deixar "Morada" vazia → Botão "Seguinte" desabilitado
9. Preencher ambos (Morada + Localidade) → Habilitado

**Resultado:** Validação funciona corretamente, não permite avançar sem campos obrigatórios

### Teste 3: Auto-Save de Draft

**Fluxo:**
1. Acesso /simulador
2. Preencher Passo 1: Nome do serviço + descrição
3. Abrir DevTools → Application → localStorage
4. Procurar chave "clyon_simulator_form_draft"
5. Contenha valores preenchidos
6. Refresca página (F5)
7. Formulário recupera dados do draft
8. Avança para Passo 6 e clica "Enviar Pedido"
9. localStorage limpo

**Resultado:** Draft salvo, restaurado após refresh, limpo após sucesso

### Teste 4: Painel Miriam Recebe Pedido

**Fluxo:**
1. Submete pedido via Teste 1
2. Abre novo aba: `/colaboradores/admin?section=pedidos`
3. Login: Miriam / Miriam26
4. Painel carrega
5. Procura novo pedido com "Eugênia Almeida" na tabela

**Resultado Esperado:**
- ✓ Novo pedido aparece na tabela de Miriam
- ✓ Status é "Atribuído"
- ✓ Contacto é "Eugênia Almeida"
- ✓ Serviço é "Recolha de móveis"
- ✓ NÃO mostra "Nenhum pedido do simulador ainda"

### Teste 5: Painel Wanderson Vê Todos

**Fluxo:**
1. Submete pedido via Teste 1
2. Abre novo aba: `/colaboradores/admin?section=pedidos`
3. Login: Wanderson / [senha]
4. Painel carrega como ADMIN
5. Procura novo pedido na tabela

**Resultado Esperado:**
- ✓ Novo pedido aparece (porque admin vê todos)
- ✓ Atribuído a "Miriam"
- ✓ Contagem de "Atribuídos" aumentou em 1

### Teste 6: Reset Completo

**Fluxo:**
1. Completa Teste 1
2. Vê tela de sucesso
3. Clica "Novo Pedido"
4. Volta ao Passo 1
5. Formulário limpo (todos campos vazios)
6. localStorage "clyon_simulator_form_draft" vazio

**Resultado:** Reset funciona, novo pedido pode ser criado

## Checklist de Sucesso

- [ ] 6 passos renderizam com progress indicator
- [ ] Botão "Seguinte" desabilitado até campos obrigatórios preenchidos
- [ ] Draft salvo a cada keystroke em localStorage
- [ ] Fotos uploadeadas mostram previews
- [ ] Passo 6: Botão "Enviar Pedido" chama POST /api/simulador/pedido
- [ ] Tela de sucesso mostra após pedido guardado
- [ ] localStorage limpado após sucesso
- [ ] Botão "Novo Pedido" reseta tudo para Passo 1
- [ ] Painel Miriam recebe novo pedido imediatamente
- [ ] Painel Wanderson vê novo pedido
- [ ] Sem "Nenhum pedido do simulador ainda" quando pedidos existem
- [ ] Console mostra logs do processo completo

## Troubleshooting

### Problema: Botão "Enviar Pedido" não funciona
**Solução:**
1. Verificar se todos os campos obrigatórios preenchidos
2. Abrir DevTools → Console
3. Procurar erro "POST /api/simulador/pedido"
4. Verificar se POST route está acessível
5. Verificar logs do servidor

### Problema: Draft não salva
**Solução:**
1. Verificar se localStorage ativado
2. Verificar DevTools → Application → localStorage
3. Procurar chave "clyon_simulator_form_draft"
4. Se vazio, há erro no JSON.stringify()

### Problema: Painel não mostra novo pedido
**Solução:**
1. Verificar se POST /api/simulador/pedido retorna ok: true
2. Verificar se createSimulatorOrder() cria linha em BD
3. Fazer refresh do painel (botão "Actualizar")
4. Verificar logs: `[v0] GET /api/admin/pedidos: ...`
5. Confirmar que assignedToId = 2 (Miriam)

## Deployment

1. Verificar TypeScript: `pnpm tsc --noEmit` → Zero erros
2. Testar localmente com os 6 testes acima
3. Fazer push para GitHub
4. Vercel deployment automático
5. Testar em produção com dados reais
6. Comunicar à Miriam e Wanderson

## Notas

- Formulário é **responsivo** (mobile-first)
- **Sem WhatsApp buttons** no fluxo final
- **Integra com fluxo existente** (POST /api/simulador/pedido)
- **Auto-assignment** a Miriam/assistentes
- **localStorage draft** permite offline & refresh recovery
- **Success screen** com botão reset

---

**Data de Implementação:** 21/06/2026
**Commits:** d199a7a + correções
**Status:** Pronto para teste
