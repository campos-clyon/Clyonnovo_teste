# TESTE COMPLETO - FLUXO DE PEDIDOS DO SIMULADOR

**Commit:** a9c8658 (Auditoria completa e correções)

---

## PARTE 1: PRÉ-TESTE

### 1.1 Verificar Dados em Base de Dados

```bash
# Verificar se Miriam existe como assistente activa
SELECT id, nome, funcao, isAdmin, active, canReceiveSimulatorRequests 
FROM colaboradores 
WHERE nome = 'Miriam';

# Resultado esperado:
# id=2, nome=Miriam, funcao=assistente, isAdmin=0, active=1, canReceiveSimulatorRequests=1
```

### 1.2 Verificar Tabela simulatorOrders

```bash
# Confirmar que a tabela existe e tem a estrutura correcta
DESCRIBE simulatorOrders;

# Deve ter: id, contactName, contactPhone, contactEmail, serviceType, description, 
# address, city, floor, hasElevator, parkingDistance, status, assignedToId, assignedToName, etc.
```

---

## PARTE 2: TESTE PASSO A PASSO

### PASSO 1: Abrir Navegador e Consola

1. Aceder a: https://clyon.pt/simulador
2. Abrir DevTools: F12 → Console
3. Filtrar por `[v0]` para ver apenas logs relevantes

### PASSO 2: Preencher Formulário

**Dados de teste (Eugênia Almeida):**

```
Nome completo: Eugênia Almeida
Telefone: 911128863
Email: menaga@hotmail.com
Localidade: Agualva-Cacém (escrever para autocompletar)
ou Morada: Rua Rui Coelho, Alto do Chapeleiro, Santa Clara, Lisboa

Andar: R/C
Elevador: Não
Estacionamento: Sim, até 20 metros
Tipo de serviço: Recolha de móveis
Descrição: 4 móveis velhos, 1 mesa redonda, 1 cadeira e 5 sacos com lixo variado
Urgência: Flexível
```

### PASSO 3: Gerar Estimativa

1. Clica botão "Gerar estimativa"
2. Aguarda 3-5 segundos para cálculo
3. Verifica resultado: deve mostrar preço ~€125-150

**Logs esperados (Console):**
```
[v0] POST /simulador/estimate: ...
[v0] Estimativa gerada: status=estimated, preço=150€
```

### PASSO 4: Validação de Dados

**Dados devem estar preenchidos:**
- [x] Nome: Eugênia Almeida
- [x] Telefone: 911128863
- [x] Email: menaga@hotmail.com
- [x] Morada: (completa com cidade)
- [x] Andar: R/C
- [x] Elevador: Não
- [x] Estacionamento: Sim
- [x] Serviço: Recolha de móveis
- [x] Descrição: (preenchida)
- [x] Urgência: Flexível

### PASSO 5: Enviar Pedido

1. Clica botão "Enviar pedido para análise" (azul)
2. Aguarda 3-5 segundos

**Logs esperados na Consola:**

```
[v0] SimulatorPage.handleSaveOrder: Enviando pedido com dados: { servicoType: "Recolha de móveis", contactName: "Eugênia Almeida", contactPhone: "911128863", address: "...", hasEstimate: true, estimateStatus: "estimated" }

[v0] POST /api/simulador/pedido: Iniciando...
[v0] POST /api/simulador/pedido: Dados recebidos - serviceType=Recolha de móveis, contactName=Eugênia Almeida
[v0] POST /api/simulador/pedido: Prioridade calculada=normal

[v0] createSimulatorOrder: Iniciando com 29 campos
[v0] createSimulatorOrder: SQL com 29 colunas...
[v0] createSimulatorOrder: ✓ Pedido criado com insertId= 123 tipo= number

[v0] getActiveAssistants: ✓ Encontradas 1 assistentes: Miriam(id=2)

[v0] countActiveOrdersByAssistant: ✓ Contadores: { 2: 0 }

[v0] pickLeastLoadedAssistant: Iniciando...
[v0] pickLeastLoadedAssistant: Assistentes encontradas: 1 Miriam(id=2, isAdmin=0)
[v0] pickLeastLoadedAssistant: Contadores por assistente: { 2: 0 }
[v0] pickLeastLoadedAssistant: Avaliando Miriam (id=2): count=0, lastAt=0000-01-01
[v0] pickLeastLoadedAssistant: ✓ Novo melhor: Miriam (count=0)
[v0] pickLeastLoadedAssistant: Resultado final: Miriam (id=2)

[v0] POST /api/simulador/pedido: pickLeastLoadedAssistant() retornou={ id: 2, nome: Miriam }
[v0] POST /api/simulador/pedido: Atribuindo pedido #123 a Miriam (id=2)

[v0] assignSimulatorOrder: Iniciando para pedido #123 assignee=Miriam(id=2)
[v0] assignSimulatorOrder: Actualizando pedido #123 com assignedToId=2, status=atribuido
[v0] assignSimulatorOrder: ✓ Pedido #123 actualizado com sucesso

[v0] POST /api/simulador/pedido: ✓ Pedido #123 atribuído a Miriam

[v0] SimulatorPage.handleSaveOrder: ✓ Pedido criado com sucesso: { id: 123, status: "atribuido", assignedTo: "Miriam", assignedToId: 2, message: "Pedido #123 enviado para análise. Assistente atribuída: Miriam." }
```

**Chat deve mostrar:**
```
"Pedido #123 enviado para análise. Assistente atribuída: Miriam."
```

**Botão muda de:**
```
"Enviar pedido para análise" → Card verde com checkmark
"Pedido enviado com sucesso
A equipa CLYON recebeu os seus dados e irá analisar o pedido.
Entraremos em contacto em breve para confirmar o orçamento e agendamento."
```

### PASSO 6: Verificar Painel de Wanderson (Admin)

1. Abrir nova aba/janela
2. Aceder a: https://clyon.pt/colaboradores/admin?section=pedidos
3. Login: WANDERSON / <senha>
4. Seleccionar "Pedidos do Simulador"

**Esperado:**
- [x] Card com novo pedido aparece
- [x] Número: #123
- [x] Nome: Eugênia Almeida
- [x] Serviço: Recolha de móveis
- [x] Status: Atribuído
- [x] Assistente: Miriam
- [x] Contador "Atribuído": +1

**Logs na Consola (DevTools):**
```
[v0] GET /api/admin/pedidos: Utilizador=Wanderson, isAdmin=true, status filter=undefined, search=undefined
[v0] GET /api/admin/pedidos: Admin - carregando TODOS os pedidos
[v0] getAllSimulatorOrders: Iniciando com filters= undefined
[v0] getAllSimulatorOrders: ✓ Retornando 1 pedidos
[v0] GET /api/admin/pedidos: Admin - pedidos carregados: 1 contadores: { pendente: 0, atribuido: 1, ... }
```

### PASSO 7: Verificar Painel de Miriam (Assistente)

1. Abrir outra aba/janela
2. Aceder a: https://clyon.pt/colaboradores/admin?section=pedidos
3. **Logout** de Wanderson
4. Login: MIRIAM / Miriam26
5. Seleccionar "Pedidos do Simulador"

**Esperado:**
- [x] Card com novo pedido aparece
- [x] Número: #123
- [x] Nome: Eugênia Almeida
- [x] Serviço: Recolha de móveis
- [x] Status: Atribuído
- [x] Contador "Atribuído": +1
- [x] Miriam NÃO vê "Nenhum pedido do simulador ainda"

**Logs na Consola (DevTools):**
```
[v0] GET /api/admin/pedidos: Utilizador=Miriam, isAdmin=false, status filter=undefined, search=undefined
[v0] GET /api/admin/pedidos: Assistente (id=2) - carregando seus pedidos
[v0] getSimulatorOrdersByAssistant: Iniciando para assistante id= 2
[v0] getSimulatorOrdersByAssistant: ✓ Retornando 1 pedidos para assistente id= 2
[v0] GET /api/admin/pedidos: Assistente - pedidos encontrados: 1
[v0] GET /api/admin/pedidos: Assistente - após filtro: 1
[v0] GET /api/admin/pedidos: Assistente - contadores: { total: 1, atribuido: 1 }
```

---

## PARTE 3: VALIDAÇÃO FINAL

### Checklist de Sucesso

- [ ] Logs mostram: `✓ Pedido #[ID] CRIADO`
- [ ] Logs mostram: `✓ Pedido #[ID] atribuído a Miriam`
- [ ] SimulatorPage mostra card de sucesso
- [ ] Painel Wanderson mostra novo pedido
- [ ] Painel Miriam mostra novo pedido (não "Nenhum pedido...")
- [ ] Número do pedido é consistente em todos os painéis
- [ ] Dados estão correctos (nome, serviço, morada)
- [ ] Status é "Atribuído" com Miriam como assistente

### Se Algo Falhar

**Se card de sucesso não aparecer:**
1. Verificar logs para erro em `SimulatorPage.handleSaveOrder`
2. Verificar se dados estão completos (não faltam campos obrigatórios)
3. Verificar se POST retorna 200 OK

**Se pedido não aparece em Wanderson:**
1. Fazer F5 para refresh
2. Verificar logs para erro em `getAllSimulatorOrders`
3. Verificar se `insertId` foi retornado correctamente

**Se pedido não aparece em Miriam:**
1. Fazer F5 para refresh
2. Verificar logs para erro em `getSimulatorOrdersByAssistant`
3. Verificar se `assignedToId=2` foi gravado correctamente

**Se Miriam vê "Nenhum pedido do simulador ainda":**
1. Verificar logs: `getSimulatorOrdersByAssistant: ✓ Retornando 0 pedidos`
2. Significa que `assignedToId` não é 2 ou está NULL
3. Verificar database: `SELECT assignedToId FROM simulatorOrders WHERE id=123;`

---

## PARTE 4: CÓPIE DOS LOGS PARA ANÁLISE

Se o teste falhar, copie os logs completos:

1. DevTools → Console
2. Clique direito → Select All
3. Copia todo o texto
4. Cola em: https://v0.app (chat)
5. Descreve exatamente qual o passo que falhou

---

## NOTAS

- Confirmação esperada: "Pedido #123 enviado para análise. Assistente atribuída: Miriam."
- Se número for diferente (ex: 456), usar esse número em todas as referências
- Miriam deve VER o pedido no painel (não "Nenhum pedido...")
- Wanderson deve VER o pedido no painel (pode filtrar por "Atribuído" ou ver todos)

---

**Status: TESTE PRONTO PARA EXECUÇÃO** ✅
