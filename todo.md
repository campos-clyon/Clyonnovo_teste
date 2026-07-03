# Project TODO

## Correção de Header e Ícone WhatsApp
- [x] Remover header duplicado superior (branco com "Serviço")
- [x] Trocar ícone de telefone vermelho pelo ícone do WhatsApp no botão "Ligar Agora"

## Simulador de Orçamento
- [x] Criar página de simulação de orçamento (/simulador)
- [x] Implementar formulário com campos:
  - [x] Tempo estimado para recolha
  - [x] Região (Margem Sul / Lisboa / Regiões de Lisboa)
  - [x] Quantidade de pessoas (1-6)
  - [x] Tipo de trabalho (Entulho / Móveis / Monos)
  - [x] Tipo de acesso (Apartamento / Casa)
  - [x] Se apartamento: número de andares + elevador sim/não
  - [x] Checkbox: Acesso fácil ou difícil
- [x] Implementar lógica de cálculo de preço
- [x] Adicionar botão "Simular Orçamento" na landing page
- [x] Adicionar rota no App.tsx
- [x] Testar fluxo completo

## Ajustes no Simulador de Orçamento - Valores Reais
- [x] Ajustar cálculo de horas: €8/hora por pessoa
- [x] Adicionar automaticamente 2h para depositar no cálculo
- [x] Renomear "Tipo de Trabalho" para "Tipo de Material"
- [x] Adicionar opção "Misto" em Tipo de Material
- [x] Testar nova fórmula de cálculo

## Ajustes de Preços - Valores Reais por Região e Acesso
- [x] Alterar região para valores fixos adicionais:
  - [x] Lisboa: +€45
  - [x] Regiões de Lisboa: +€45
  - [x] Margem Sul: +€20
- [x] Ajustar custos de apartamento por andar:
  - [x] Sem elevador: €10 por andar
  - [x] Com elevador: €3 por andar
- [x] Testar nova fórmula com valores atualizados

## Nova Lógica de Precificação - Entulho e Acesso Difícil
- [x] Adicionar custo de €30 quando "Acesso Difícil" está marcado
- [x] Implementar nova lógica para Entulho:
  - [x] Adicionar alerta informativo: "Uma carga transporta até 120 sacos (25-30kg cada). Peso máximo: 3500kg"
  - [x] Adicionar pergunta: "O entulho está em sacos ou no chão?"
  - [x] Se "Em sacos": perguntar quantidade → calcular: quantidade × €0,40
  - [x] Se "No chão": perguntar quantidade estimada → calcular: quantidade × €0,75
  - [x] Manter cálculo de mão de obra: (horas + 2h depósito) × pessoas × €8
  - [x] Cálculo final: Custo sacos + Mão de obra + Região + Acesso + Dificuldade
- [x] Manter lógica atual para Móveis, Monos e Misto (apenas horas × pessoas)
- [x] Testar cenário completo com entulho em sacos
- [x] Testar cenário completo com entulho no chão
- [x] Testar com acesso difícil marcado

## Simplificação da Lógica de Entulho e Margem de Lucro
- [x] Remover campo "Quantos sacos?"
- [x] Simplificar opções de entulho:
  - [x] "O entulho está em sacos" → Sem custo adicional (€0)
  - [x] "O entulho está no chão" → +€20
- [x] Remover alerta informativo sobre capacidade de carga (não mais necessário)
- [x] Adicionar margem de lucro de 50% ao valor final
- [x] Atualizar fórmula: Total = Subtotal × 1.5
- [x] Testar nova fórmula simplificada
- [x] Atualizar mensagem do WhatsApp

## Nova Lógica para Categoria Móveis
- [x] Adicionar pergunta "Como deseja calcular?" quando selecionar Móveis
- [x] Implementar opção "Por Carga":
  - [x] Perguntar "Quantas cargas?"
  - [x] Manter cálculo atual: (Horas × Pessoas × €8) + Região + Acesso + Dificuldade × 1.5
- [x] Implementar opção "Por Item":
  - [x] Ocultar campos "Tempo Estimado" e "Quantidade de Pessoas"
  - [x] Adicionar 3 campos de quantidade (máx 20 cada):
    - [x] Móvel Pequeno: €25/unidade
    - [x] Móvel Médio: €50/unidade
    - [x] Móvel Grande: €60/unidade
  - [x] Cálculo especial: (Soma itens) + Acesso + Dificuldade × 1.5
  - [x] Remover do cálculo: Horas × Pessoas e Região
- [ ] Testar cenário Por Carga
- [x] Testar cenário Por Item
- [ ] Atualizar mensagem do WhatsApp

## Alteração de Preços dos Móveis
- [x] Alterar Móvel Pequeno de €25 para €5
- [x] Alterar Móvel Médio de €50 para €10
- [x] Alterar Móvel Grande de €60 para €15
- [x] Testar nova precificação

## Ajustes Finais no Simulador de Orçamento

### Entulho em Sacos
- [x] Adicionar campo de quantidade (oculto visualmente)
- [x] Se quantidade > 80 sacos: cobrar €1,50 por saco
- [x] Se quantidade ≤ 80 sacos: manter lógica atual (€0 adicional)
- [x] Alterar margem de lucro de 50% para 40%

### Móveis - Item
- [x] Ocultar valores dos labels (remover €5/un, €10/un, €15/un)
- [x] Adicionar descrições:
  - [x] Pequeno: "micro-ondas, forno, máquina de café, mesinha de cabeceira..."
  - [x] Médio: "fogão, frigorífico bar..."
  - [x] Grande: "geladeira, máquina de lavar (pesada), sofá, armário..."

### Ajuste de Fórmulas
- [x] Ajustar valores para Móveis/Monos resultar em €200-250 (dependendo da região)
- [x] Ajustar valores para Entulho resultar em €2-2,50/saco (Lisboa) e €1,90-2,10 (Margem Sul)
- [x] Testar cenários realistas e validar aproximação aos valores praticados

## Sistema de Gestão de Horas para Colaboradores

### Autenticação
- [x] Criar sistema de login com senha
- [x] Implementar 5 usuários colaboradores:
  - [x] YANNICK JR (senha inicial: YANNICK26)
  - [x] VINICIUS (senha inicial: VINICIUS26)
  - [x] MATHEUS (senha inicial: MATHEUS26)
  - [x] RODRIGO (senha inicial: RODRIGO26)
  - [x] EDUARDO (senha inicial: EDUARDO26)
- [x] Criar usuário administrador
- [x] Implementar funcionalidade de alterar senha

### Registro de Horas
- [ ] Criar página de registro de horas
- [ ] Campo de data (automática com opção de alterar)
- [ ] Campo de horário de entrada
- [ ] Campo de horário de pausa
- [ ] Campo de horário de saída
- [ ] Campo de número de trabalhos realizados
- [ ] Seleção de função: Motorista (€8/h) ou Ajudante (€7/h)
- [ ] Cálculo automático de horas trabalhadas
- [ ] Cálculo automático de valor a receber

### Dashboard Pessoal
- [ ] Mostrar horas trabalhadas na semana atual
- [ ] Mostrar horas trabalhadas nos últimos 15 dias
- [ ] Mostrar horas trabalhadas no mês atual
- [ ] Mostrar valores a receber (semana, 15 dias, mês)
- [ ] Histórico de registros do colaborador

### Painel Administrativo
- [ ] Visão resumida de todos os colaboradores
- [ ] Horas e valores por colaborador (semana, 15 dias, mês)
- [ ] Histórico completo de todos os registros
- [ ] Filtros por colaborador e período

### Integração Google Sheets
- [x] Configurar Google Sheets API
- [x] Conectar com planilha fornecida
- [ ] Salvar registros de horas na planilha (implementar depois do frontend)
- [ ] Ler dados da planilha para exibição (implementar depois do frontend)
- [ ] Sincronização automática (implementar depois do frontend)

### Design e UX
- [ ] Seguir padrão visual da Clyon
- [ ] Interface intuitiva e responsiva
- [ ] Validações de formulário
- [ ] Feedback visual de ações

## Reorganização do Cabeçalho
- [x] Mover botão WhatsApp para a esquerda
- [x] Adicionar menu hambúrguer (3 riscos) na direita
- [x] Criar menu dropdown com opções
- [x] Adicionar "Colaboradores" como primeira opção do menu
- [x] Adicionar outras opções do menu (Início, Simulador, etc.)

- [x] Corrigir erro no menu hambúrguer que impede dropdown de aparecer

- [x] Corrigir erro de login (API retornando HTML em vez de JSON)
- [x] Adicionar botão de mostrar/ocultar senha na página de login

- [x] Corrigir valores/hora dos colaboradores (Vinicius e Yannick = 7€, Eduardo/Matheus/Rodrigo = 8€)
- [x] Adicionar funcionalidade de alterar senha no dashboard do colaborador

- [x] Expandir dashboard do admin com gerenciamento de horários, usuários e edição de perfis
- [x] Ocultar saldo do colaborador no dashboard (mostrar apenas para admin)
- [x] Reordenar Simulador de Orçamento (Material em primeiro)
- [x] Implementar multiplicação de valores por quantidade no Simulador

- [x] Corrigir erro de login do usuário VINICIUS
- [x] Adicionar funcionalidade de editar horas registradas no painel admin
- [x] Corrigir cálculo de Móveis/Por Carga para usar fórmula: (horas × pessoas × €8) + região + andares + deslocación + 40%

- [x] Adicionar RODRIGO como administrador
- [x] Melhorar design e layout da dashboard do admin (mais profissional)
- [x] Expandir seção de histórico de registros com melhor visualização

- [x] Corrigir erro no histórico de registros (não mostra registros)
- [x] Corrigir funcionalidade de editar horas registradas

- [x] Corrigir erro de buttons aninhados no painel admin

- [x] Corrigir funcionalidade de salvar edições de horas (não atualiza dados)

- [x] Corrigir problema de acesso ao painel admin (não consegue entrar)

- [x] Corrigir painel admin que não mostra informações dos colaboradores

- [x] Corrigir cálculo dos totais de KPIs no painel admin (mostrando 0.00h)

- [x] Corrigir problema de horas do VINICIUS não aparecendo no painel

- [x] Corrigir conta negativa do MATHEUS após deletar registro (deveria mostrar 0)

- [x] Corrigir erro NaN nos registros do dashboard do colaborador (VINICIUS)

- [x] Centralizar título "Histórico Completo de Registros" no painel admin

- [ ] Implementar sistema de registro progressivo de horas (entrada → pausa → saída)
  - [ ] Modificar backend para aceitar registros parciais (apenas entrada, sem saída obrigatória)- [x] Implementar sistema de registro progressivo de horas
  - [x] Permitir registrar apenas entrada (sem saída obrigatória)
  - [x] Mostrar registro em aberto no topo do dashboard
  - [x] Permitir editar registro em aberto para adicionar pausa/saída
  - [x] Validar que não pode registrar nova entrada se já existe registro em aberto
  - [x] Testar fluxo completo: entrada às 08:36 → pausa às 12:00 → saída às 17:00

- [x] Modernizar menu hambúrguer
  - [x] Reorganizar ordem: Colaboradores → Simular Orçamento → Início
  - [x] Aplicar visual moderno: gradientes, ícones maiores, hover effects
  - [x] Melhorar espaçamento e tipografia

- [x] Adicionar Header em todas as páginas do site
  - [x] Incluir Header no login de colaboradores
  - [x] Incluir Header no dashboard do colaborador
  - [x] Incluir Header no painel admin
  - [x] Incluir Header no simulador de orçamento
  - [x] Incluir Header na página de alterar senha
  - [x] Tornar logo CLYON clicável para redirecionar ao início

- [x] Aumentar tamanho do ícone do menu hambúrguer e logo CLYON no header

- [x] Reorganizar página de simulador de orçamento
  - [x] Reordenar campos: Tipo Material → Região → Tipo Acesso → Quantidade Pessoas → Tempo Estimado
  - [x] Melhorar visual e layout
  - [x] Testar fluxo completo

- [x] Modificar cálculo de Móveis Por Carga
  - [x] Remover preço fixo (€200 por carga)
  - [x] Usar fórmula: horas × pessoas × 8 (como Monos)
  - [x] Manter preço fixo apenas para Móveis Por Item
  - [x] Testar cálculo

- [x] Sincronizar cálculo de Móveis Por Carga com Monos
  - [x] Verificar fórmula de Monos
  - [x] Aplicar mesma fórmula a Móveis Por Carga
  - [x] Testar que ambos retornam mesmo valor (€82 = €82 ✓)

- [x] Refazer precificação de Móveis Por Carga
  - [x] Adicionar descrições: Por Carga (carga completa) vs Por Item (pouca quantidade)
  - [x] Implementar tempo real = tempo usuário × 2 (carregar + descarregar)
  - [x] Implementar pessoas reais = pessoas usuário + 1 (carrinha)
  - [x] Implementar margem de 40% sobre subtotal
  - [x] Fórmula: ((tempo×2) × (pessoas+1) × €8 + região) + acesso + 40% margem
  - [x] Testar com exemplo: 2h, 2 pessoas, Lisboa = €197.40 + acesso (✓ Passou!)

- [x] Implementar multiplicador de cargas
  - [x] Campo "Quantas cargas?" deve multiplicar o resultado final
  - [x] Exemplo: 1 carga = €197.40, 2 cargas = €394.80, 3 cargas = €591.20
  - [x] Testar com 2 cargas (€394.80 = €394.80 ✓)

- [x] Corrigir cálculo de tempo em Móveis Por Carga
  - [x] Mudar de: tempo × 2 para: tempo + 2 (2 horas fixas de descarregar)
  - [x] Exemplo: 3h do usuário = 3 + 2 = 5h (não 3 × 2 = 6h)
  - [ ] Testar com 3 horas

- [x] Ocultar informações técnicas de cálculos
  - [x] Remover texto de fórmula de Móveis Por Carga
  - [x] Remover exemplos de cálculo
  - [x] Remover breakdown detalhado
  - [x] Manter apenas resultado final do orçamento
  - [x] Testar que apenas o valor aparece (✓ Confirmado!)

- [x] Reduzir margem de lucro de 40% para 35%
  - [x] Modificar cálculo em Móveis Por Carga
  - [x] Testar com exemplo anterior (deve reduzir valor) - €222.75 ✓

- [x] Reduzir preços de entulho
  - [x] Entulho em Sacos: €1.00 por saco (era €2.00)
  - [x] Entulho no Chão: €1.50 por saco (era €2.50)
  - [x] Testar cálculo com 100 sacos (100 × €1.00 = €165 total ✓)

- [x] Corrigir fuso horário para Lisboa (ocultar indicador Z)
  - [x] Converter timestamps UTC para fuso horário de Lisboa
  - [x] Ocultar "Z" e indicador de fuso horário
  - [x] Formatar como: "18/01/2026 • 08:30 - 15:10" (sem fuso horário visível)
  - [x] Aplicar em: Dashboard colaborador, Painel admin, Histórico
  - [x] Testar formatação em diferentes registros

- [x] BUG: Exclusão de registros de horas falha silenciosamente no painel admin (mostra "carregando" mas não deleta)
  - [x] Adicionada rota DELETE `/api/colaboradores/:colaboradorId/registros/:registroId` no backend
  - [x] Rota DELETE agora funciona corretamente e deleta registros

- [x] Restaurar usuário YANNICK com registros de horas originais
  - [x] Criar usuário YANNICK (Ajudante, 7€/hora)
  - [x] Restaurar registro: 18/01/2026 • 08:30 - 15:10 (sem pausa)
  - [x] Restaurar registro: 17/01/2026 • 08:30 - 18:40 (sem pausa)
  - [x] Restaurar registro: 16/01/2026 • 10:10 - 19:45 (com 1 hora de pausa)
  - [x] Restaurar registro: 15/01/2026 • 12:30 - 14:15 (sem pausa)

- [x] Ajustar período da semana para segunda-domingo (em vez de domingo-sábado)
- [x] Simplificar mensagem de login para apenas: "Esqueceu a senha? Entre em contato com o suporte"

- [x] Mover campo de edição de registro para logo abaixo do botão Editar (em vez de muito longe)
- [x] Tornar "Histórico Completo de Registros" um botão clicável que mostra/esconde o histórico

- [x] Adicionar 40% de margem de lucro ao cálculo final de Móveis Por Item no Simulador de Orçamento

- [x] Reordenar botões do menu: Início → Colaboradores → Simular Orçamento
- [x] Centralizar botões do menu

- [x] BUG: Menu dropdown não é responsivo e sai da página em telas pequenas
  - [x] Adicionado fixed !inset-x-4 para garantir que não sai da página em mobile
  - [x] Usado md: breakpoint para mudar para absolute em telas maiores
  - [x] Usado !important para forçar inset-x-4 em todas as telas
- [x] BUG: Alguns testes estão falhando
  - [x] Verificado: Todos os testes passando (2/2 tests passed)

- [x] Implementar sincronização automática de registros de horas com Google Sheets
  - [x] Verificar estrutura da planilha Google Sheets (Página 1)
  - [x] Configurar integração com Google Sheets API
  - [x] Implementar sincronização automática ao criar/editar/deletar registros
  - [x] Adicionar rota de sincronização manual no painel admin (/admin/sincronizar-sheets)
  - [x] Testar sincronização com dados reais (testes passando 5/5)

- [x] Reestruturação completa do site inspirado em Yoojo
  - [x] Analisar design e UX do Yoojo (CONCLUÍDO - ver ANALISE_YOOJO.md)
  - [x] Planejar nova arquitetura do site
  - [x] Redesenhar homepage com hero section, busca, categorias
  - [x] Criar seção de serviços (Mudanças, Desinstalação, Movimentação de Móveis)
  - [x] Implementar social proof (avaliações, depoimentos)
  - [x] Integrar Painel de Colaboradores
  - [x] Integrar Simulador de Orçamento
  - [x] Modernizar logo Clyon
  - [x] Manter cores Clyon (azul + verde)
  - [x] Testar responsividade em mobile/tablet/desktop
  - [x] Otimizar para conversão (CTAs, persuasão)

- [x] Redesenhar header e hero do site (estilo antigo)
  - [x] Header: WhatsApp à esquerda (verde), logo CLYON no centro, menu à direita
  - [x] Hero: "Recolhas e Limpezas Rápidas e Sem Stress" (com "Rápidas e Sem Stress" em azul)
  - [x] Descrição: "Entulho, móveis velhos ou limpeza pós-obra? Resolvemos o seu problema com eficiência máxima e o melhor preço-benefício do mercado."
  - [x] Stats: "Resposta em até 2h", "100% de Clientes Satisfeitos", "Top Pro no Fixando"

- [x] Atualizar logo para nova versão (apenas ícone azul água)
- [x] Aumentar tamanho do ícone do WhatsApp
- [x] Remover botão "Menu" e adicionar: "Serviço", "Cadastre-se / Faça login", "Torne se um CLYON"

- [x] Adicionar ícone flutuante do WhatsApp no body (canto inferior direito)

- [x] Alinhar conteúdo na horizontal (grid/flex layout)
- [x] Manter header fixo no topo

- [x] Remover ícone do WhatsApp do cabeçalho
- [x] Remover linha cinza embaixo do cabeçalho (border-b)

- [x] Mudar tempo de resposta de 2h para 11 minutos
- [x] Usar regra de três no conteúdo (ajustar descrições)
- [x] Criar página de Serviços com todos os 9 serviços + imagens
- [x] Conectar botão "Serviço" do header para página de serviços

- [x] Atualizar estimativa de tempo de resposta para "11 min" (em vez de "2h")

- [x] Gerar imagens profissionais para cada serviço:
  - [x] Recolha de Móveis - Móveis antigos/danificados
  - [x] Recolha de Monos - Monos e objetos volumosos
  - [x] Recolha de Entulho - Entulho de obra no chão
  - [x] Demolição - Parede sendo demolida
  - [x] Mudanças - Móveis dentro de uma carrinha
  - [x] Aluguel Caminhão + Motorista - Caminhão profissional
  - [x] Assistência na Mudança - Equipa ajudando
  - [x] Movimentação de Móveis - Pessoas movimentando móveis
  - [x] Mudança de Eletrodomésticos - Eletrodomésticos sendo movidos
- [x] Atualizar página de Serviços com imagens geradas

## Páginas de Autenticação e Registro

- [x] Criar página de Cadastro/Login de usuários
  - [x] Formulário de login com email/senha
  - [x] Formulário de cadastro com nome, email, senha
  - [x] Validações de formulário
  - [x] Integração com sistema de autenticação
  - [x] Redirecionar após login bem-sucedido
  - [x] Design consistente com o site

- [x] Criar página de Registro de Profissionais (Torne se um CLYON)
  - [x] Formulário com dados pessoais (nome, email, telefone)
  - [x] Seleção de profissão/especialidade
  - [x] Termos e condições
  - [x] Validações de formulário
  - [x] Enviar para análise/aprovação
  - [x] Design consistente com o site

- [x] Conectar botões do header às novas páginas
  - [x] Botão "Cadastre-se / Faça login" → /auth
  - [x] Botão "Torne se um CLYON" → /profissional

- [x] Testar fluxos de autenticação e navegação
  - [x] Testar login de usuário
  - [x] Testar cadastro de novo usuário
  - [x] Testar registro de profissional
  - [x] Testar redirecionamentos

## Bugs Encontrados

- [x] Links não funcionam nas páginas de autenticação e registro
  - [x] Links "Cadastre-se" / "Faça Login" na página Auth alternam entre os formulários corretamente
  - [x] Link "Voltar ao Início" redireciona para a página inicial
  - [x] Botões de alternância entre abas funcionam corretamente

- [x] Botões do header navegam para as páginas corretas
  - [x] Botão "Cadastre-se / Faça login" leva a /auth
  - [x] Botão "Torne se um CLYON" leva a /profissional
## Melhorias no Histórico de Horas

- [x] Adicionar data ao "Histórico Recente" das horas do usuário
  - [x] Localizar o componente de histórico recente
  - [x] Adicionar campo de data em cada registro
  - [x] Formatar a data de forma legível (DD/MM/YYYY com dia da semana)
  - [x] Testar a exibição da data

- [x] Data não está sendo exibida no histórico recente
  - [x] Investigar por que a data formatada não aparece
  - [x] Corrigir o componente para exibir a data corretamente

- [x] Data agora aparece no histórico recente (dataFormatada renderizado corretamente)
  - [x] Debugar por que o campo dataFormatada não vinha do servidor
  - [x] Corrigir o componente para exibir a data de forma visível

- [x] Investigar erro: datas não aparecem no histórico recente
  - [x] Verificar logs do servidor
  - [x] Verificar console do navegador
  - [x] Identificar por que dataFormatada não era renderizado
  - [x] Corrigir o problema - RESOLVIDO! Datas agora aparecem corretamente

- [x] Data não aparecia para o usuário YANNICK (mas aparecia para VINICIUS) - RESOLVIDO!
  - [x] Fazer login com YANNICK e verificar o histórico
  - [x] Investigar por que a data não aparecia
  - [x] Corrigir o problema - A data agora aparece para todos os usuários

## Melhorias de Layout e Design

- [x] Centralizar conteúdo do site
  - [x] Centralizar página inicial (Home)
  - [x] Centralizar página de Serviços
  - [x] Centralizar páginas de Autenticação e Registro
  - [ ] Melhorar espaçamento e alinhamento
  - [ ] Testar responsividade em mobile

## Centralização Melhorada de Conteúdo

- [x] Centralizar Home.tsx com melhor alinhamento
- [x] Centralizar Services.tsx com melhor alinhamento
- [x] Centralizar Auth.tsx com melhor alinhamento
- [x] Centralizar ProfissionalRegistro.tsx com melhor alinhamento
- [x] Testar responsividade em mobile e desktop

## Atualização de Imagens de Serviços

- [x] Gerar imagens profissionais com marca CLYON
- [x] Salvar imagens no diretório public
- [x] Atualizar referências no Services.tsx
- [x] Testar carregamento das imagens

## Atualização para Estrutura Yoojo

- [x] Atualizar Home.tsx com perfil CLYON (avaliações, créditos, status)
- [x] Expandir categorias de serviços para 9 categorias
- [x] Atualizar Services.tsx com nova estrutura de cards
- [x] Adicionar seção CTA para prestadores de serviços
- [x] Atualizar Footer com links e informações
- [x] Testar responsividade e validar mudanças
- [x] Remover seção de perfil CLYON e integrar 5.0 e 95 nos stats
- [x] Remover botão "Cadastre-se / Faça login" do header
- [x] Manter apenas botões "Serviço" e "Torne se um CLYON"
- [x] Atualizar "56 vezes contratado" para "95 vezes contratado"
- [x] Atualizar "56 clientes satisfeitos" para "95 clientes satisfeitos"
- [x] Remover todos os botões "Cadastre-se / Faça login" do site
  - [x] Remover de Header.tsx (desktop)
  - [x] Remover de Header.tsx (mobile)
- [x] Mudar botão "Serviço" para "Início" quando em página "Torne se um CLYON"
- [x] Remover botão "Torne se um CLYON" quando em página de profissional

## Otimização de Imagens de Serviços

- [x] Gerar 9 imagens otimizadas com alta qualidade
- [x] Substituir imagens antigas pelas novas
- [x] Testar carregamento e qualidade
  - [x] Recolha de Móveis
  - [x] Recolha de Monos
  - [x] Recolha de Entulho
  - [x] Demolição
  - [x] Mudanças
  - [x] Aluguel de Caminhão com Motorista
  - [x] Assistência na Mudança
  - [x] Movimentação de Móveis
  - [x] Mudança de Eletrodomésticos

## Simplificação de Categorias de Serviços

- [x] Remover seção de imagens dos cards de categorias
- [x] Manter ícone, nome e descrição
- [x] Aumentar tamanho dos ícones
- [x] Centralizar conteúdo dos cards

## Atualização do Footer

- [x] Remover nome CLYON em branco do footer
- [x] Adicionar botão Colaboradores destacado em cyan
- [x] Manter logo e informações de contato
- [x] Remover emoji do botão Colaboradores
- [x] Adicionar navegação para link externo https://clyonsales.com/colaboradores

## Dashboard de Colaboradores

- [x] Criar tabela de registros de horas no banco de dados
- [x] Criar página de dashboard de colaboradores
- [x] Implementar formulário de registro de entrada/saída
- [x] Implementar histórico de registros com cálculo de horas
- [x] Integrar com Google Sheets para rastreamento
- [x] Testar funcionalidades completas
- [x] Verificar rotas e integração com App.tsx

## Links do Footer

- [x] Conectar "Solicitar um serviço" para /servicos
- [x] Conectar "Encontrar um emprego" para /profissional
- [x] Testar navegação dos links do footer

## Correção Botão Colaboradores

- [x] Mudar botão Colaboradores para rota interna /colaboradores
- [x] Remover link externo https://clyonsales.com/colaboradores
- [x] Testar navegação

## Dados de Exemplo de Colaboradores

- [x] Criar script para inserir colaboradores de exemplo
- [x] Adicionar Vinícius com registros de horas
- [x] Adicionar Eduardo com registros de horas
- [x] Adicionar Yannick com registros de horas
- [x] Adicionar Matheus com registros de horas
- [x] Testar dados no dashboard
- [x] Criar função seedColaboradores() em server/db.ts
- [x] Adicionar testes vitest para validar seed
- [x] Criar endpoint tRPC para chamar seed (seed.colaboradores mutation)

## Adicionar Datas aos Registros de Horas no Dashboard

- [x] Adicionar data aos registros no "Histórico Recente" do dashboard
- [x] Formatar data de forma clara e legível (DD/MM/YYYY com dia da semana)
- [x] Mostrar data acima dos horários de entrada/pausa/saída
- [x] Testar exibição em diferentes resoluções (mobile/desktop)
- [x] Validar que a data aparece para todos os colaboradores
- [x] Melhorar contraste das cores (fundo claro com textos escuros)
- [x] Aumentar visibilidade dos textos no histórico recente
- [x] Corrigir cores para melhor legibilidade (bg-slate-50, text-slate-800)

## Remover Categorias de Serviços

- [x] Remover categoria "Animais"
- [x] Remover categoria "Crianças"
- [x] Remover categoria "Ciência da Computação"
- [x] Remover categoria "Aulas particulares"
- [x] Testar página de serviços sem as categorias removidas


## Criar Páginas do Footer

- [x] Criar página "Solicitar um serviço"
- [x] Criar página "Encontrar um emprego"
- [x] Criar página "Aplicativo móvel"
- [x] Criar página "Aplicativo móvel para prestadores"
- [x] Criar página "Avaliações de clientes"
- [x] Criar página "Convide amigos"
- [x] Criar página "Central de Ajuda"
- [x] Criar página "Crédito fiscal"
- [x] Criar página "Confiança e segurança"
- [x] Criar página "Serviços empresariais"
- [x] Criar página "Perguntas frequentes"
- [x] Remover link "Capa de CLYON" do footer
- [x] Atualizar rotas em App.tsx
- [x] Testar todos os links do footer
- [x] Adicionar links de WhatsApp e Email em todas as páginas do footer

## Adicionar Botão Voltar

- [x] Criar componente de botão "Voltar"
- [x] Adicionar botão "Voltar" em todas as páginas do footer
- [x] Testar navegação com botão "Voltar"
- [x] Salvar checkpoint

## Melhorar Simulador de Orçamento

- [x] Criar tela de seleção de categorias para o Simulador
- [x] Adicionar categoria "Remoção de Lixo e Entulho" ao Simulador
- [x] Integrar seleção de categoria com o fluxo de simulação
- [x] Testar fluxo completo do Simulador com novas categorias
- [x] Salvar checkpoint

## Atualizar Categorias do Simulador

- [x] Remover categoria "Remoção de Lixo e Entulho"
- [x] Adicionar categoria "Mudanças"
- [x] Atualizar categorias para: Móveis, Entulho, Móveis e Monos, Mudanças
- [x] Testar todas as categorias atualizadas
- [x] Salvar checkpoint

## Customizar Simulador de Mudanças

- [x] Renomear página para "Simulador Mudanças"
- [x] Substituir campo "Região" por "Endereço de Partida"
- [x] Adicionar campo "Endereço de Chegada"
- [x] Atualizar lógica de cálculo para usar endereços
- [x] Testar Simulador de Mudanças com novos campos
- [x] Salvar checkpoint

## Reduzir Tamanho das Caixas de Categorias do Simulador

- [x] Reduzir tamanho dos ícones emoji nas categorias
- [x] Reduzir tamanho das caixas (cards) de categorias
- [x] Testar visual das categorias com caixas menores
- [x] Salvar checkpoint

## Configurar Favicon

- [x] Salvar favicon na pasta public
- [x] Atualizar referência do favicon no HTML
- [x] Testar favicon em todas as páginas
- [x] Salvar checkpoint

## Remover Valores por Hora da Seção de Ajudantes

- [x] Remover valores €9/h dos cards de ajudantes
- [x] Testar visual da seção "Contrate um Ajudante"
- [x] Salvar checkpoint

## Corrigir Problemas de SEO da Página Inicial

- [x] Atualizar título da página para 30-60 caracteres
- [x] Verificar e otimizar meta description
- [x] Verificar tags de heading (H1, H2, etc)
- [x] Verificar alt text em imagens
- [x] Testar SEO com ferramentas
- [x] Salvar checkpoint

## Corrigir Incremento de Tempo Estimado

- [x] Alterar incremento de "Tempo Estimado" de 0.50 para 0.30 horas
- [x] Testar campo de Tempo Estimado com novo incremento
- [x] Salvar checkpoint

## Corrigir Sistema de Registro de Horas

- [x] Implementar identificação dinâmica da semana baseada na data atual
- [x] Corrigir cálculo do total mensal (do dia 1 ao último dia do mês)
- [x] Investigar e corrigir discrepância de €1,77 no cálculo de horas
- [x] Testar cálculos com diferentes datas e períodos
- [x] Salvar checkpoint

## Exportar Relatório de Horas em PDF e Excel

- [x] Criar rota de API para exportar em PDF
- [x] Criar rota de API para exportar em Excel
- [ ] Adicionar botões de exportação no dashboard do colaborador
- [ ] Testar exportação de PDF
- [ ] Testar exportação de Excel
- [ ] Salvar checkpoint

## Atualizar Texto "Esta Semana" com Número Dinâmico

- [x] Alterar "Esta Semana" para mostrar número da semana (ex: "Semana 6 - 02/02 a 08/02")
- [x] Testar exibição do número da semana
- [x] Salvar checkpoint

## Mostrar Número da Semana e Valor ao Usuário

- [x] Atualizar texto para mostrar "Semana 6" em vez de "Esta Semana"
- [x] Mostrar valor em euros em vez de "Valor oculto"
- [x] Testar exibição de semana e valor
- [x] Salvar checkpoint

## Ativar Localização de Endereços Reais no Simulador de Mudanças

- [x] Implementar autocomplete com Google Places API para campos de endereço
- [x] Implementar cálculo de distância com Google Directions API
- [x] Atualizar orçamento automaticamente baseado na distância calculada
- [x] Adicionar custo de €1,00 por km ao orçamento final
- [x] Atualizar mensagem WhatsApp com distância e endereços
- [x] Testar autocomplete com endereços reais em Portugal
- [x] Testar cálculo de distância entre diferentes cidades
- [x] Adicionar tratamento de erros para endereços inválidos
- [x] Exibir mensagem de erro clara ao usuário
- [x] Validar atualização automática do orçamento
- [ ] Salvar checkpoint

## Corrigir Autocomplete de Endereços

- [ ] Verificar função buscarSugestoesCheagada
- [ ] Verificar inicialização do Google Places API
- [ ] Testar autocomplete com digitação
- [ ] Validar sugestões aparecem corretamente

## Corrigir Erro de Geocodificação do Endereço de Partida

- [ ] Implementar Geocoding API para validar endereço de partida
- [ ] Converter endereço para coordenadas (latitude/longitude)
- [ ] Usar coordenadas na Directions API em vez de endereço
- [ ] Testar cálculo de distância com novo método

## Corrigir Botão "Calcular Orçamento" Desabilitado

- [ ] Verificar função podeCalcular
- [ ] Corrigir lógica de validação para não exigir distância em categorias sem endereço
- [ ] Testar botão com todos os campos preenchidos

## Aumentar Valor por km para €2,00

- [ ] Encontrar e substituir valor de €1 por €2 por km
- [ ] Verificar se há outras referências ao valor
- [ ] Testar simuladores com novo valor

## Corrigir Cálculo para km Incluído na Base dos 40%

- [x] Reorganizar cálculos: km incluído na base dos 40%
- [x] Testar novo cálculo com diferentes valores

## Corrigir Problemas de SEO na Página Inicial

- [x] Reduzir título para 30-60 caracteres (atualmente tem 61)
- [x] Testar título no navegador

## Adicionar Botão "Calcular" para Distância

- [x] Adicionar botão "Calcular" abaixo do campo "Endereço de Destino"
- [x] Implementar função para calcular distância manualmente
- [x] Testar botão em todas as categorias

## Corrigir Bot\u00e3o "Calcul## Corrigir Botão "Calcular" Não Aparecendo

- [x] Verificar se botão está sendo renderizado
- [x] Corrigir condição de visibilidade (movido para acima da distância)
- [x] Testar em todas as categorias

## Reposicionar Botão "Calcular Distância"

- [x] Mover botão para logo abaixo do campo "Endereço de Destino"
- [x] Testar em todas as categorias

## Remover Cálculo Automático de Distância

- [x] Remover debounce de 5 segundos do cálculo automático
- [x] Remover indicador visual "Aguardando"
- [x] Manter botão "Calcular Rota" como única forma de calcular
- [x] Testar em todas as categorias (Móveis, Entulho, Móveis e Monos, Mudanças)

## Alterar Valor Padrão de Cargas

- [x] Definir campo "Quantas cargas?" com valor padrão de 1
- [x] Testar em todas as categorias (Móveis, Móveis e Monos)

## Corrigir Bug de Cache no Orçamento

- [x] Analisar problema de cache na função calcularOrcamento
- [x] Implementar invalidação de cache quando distância muda
- [x] Adicionar dependência de distância no cálculo
- [x] Testar recalculo com diferentes distâncias (337km → 6km)

## Painel de Administração de Colaboradores

- [x] Analisar schema de usuários no banco de dados
- [x] Usar página ColaboradorAdmin.tsx existente
- [x] Adicionar campo de senha no formulário de edição
- [x] Implementar botão mostrar/ocultar senha
- [x] Implementar salvamento de alterações com senha
- [x] Testar edição e salvamento de dados

## Corrigir Erro de Validacao ao Salvar Colaborador

- [x] Analisar erro "Todos os campos sao obrigatorios"
- [x] Verificar validacao no backend da API
- [x] Corrigir validacao para aceitar senha opcional
- [x] Testar salvamento com todos os campos preenchidos

## Modal de Detalhes de Categorias

- [x] Criar dados descritivos para cada categoria
- [x] Implementar modal que abre ao clicar em categoria
- [x] Adicionar botão "Fazer Orçamento" no modal
- [x] Implementar navegação para simulador com categoria pré-selecionada
- [x] Testar modal em todas as categorias

## Aumentar Contraste no Painel de Entrada/Saída

- [x] Aumentar contraste dos textos "Hora Pausa", "Hora Saída", "Nº de Trabalhos"
- [x] Usar cores mais escuras e fortes para melhor legibilidade
- [x] Testar em diferentes resoluções

## Corrigir Cálculo de Móveis por Item

- [x] Analisar código de cálculo para opção "Por Item"
- [x] Remover tempo estimado da fórmula (não deve impactar)
- [x] Adicionar cálculo de distância (km × €2/km)
- [x] Testar com diferentes distâncias

## Corrigir Cálculo de Horas Semanais

- [x] Analisar código de cálculo de horas semanais (está perdendo ~4 horas)
- [x] Verificar se a semana está sendo calculada corretamente (segunda-domingo)
- [x] Corrigir discrepância: 47h 22m esperado vs 43.28h mostrado (adicionado limite superior ao filtro)
- [x] Testar com dados de Vinicius (5 dias, 2 pausas)


## Otimização de SEO e Visibilidade Online

### SEO Técnico
- [x] Implementar schema.org markup (LocalBusiness, Service, Review)
- [x] Criar sitemap.xml dinâmico
- [x] Criar robots.txt otimizado
- [x] Adicionar meta tags Open Graph (OG)
- [x] Adicionar meta tags Twitter Card
- [x] Otimizar meta descriptions para todas as páginas
- [x] Adicionar canonical tags
- [x] Implementar breadcrumb schema
- [x] Adicionar JSON-LD para FAQ schema
- [ ] Otimizar Core Web Vitals (LCP, FID, CLS)

### Conteúdo e Palavras-chave
- [ ] Pesquisar palavras-chave com alto volume (remoção de entulho, mudanças, etc.)
- [ ] Otimizar títulos e descrições com palavras-chave
- [ ] Criar landing pages para cada categoria de serviço
- [ ] Criar FAQ section com perguntas frequentes
- [ ] Adicionar conteúdo de blog (mínimo 5 posts)
- [ ] Otimizar imagens com alt text descritivo

### Google My Business
- [ ] Registrar CLYON no Google My Business
- [ ] Adicionar fotos profissionais
- [ ] Adicionar descrição detalhada
- [ ] Adicionar horários de funcionamento
- [ ] Adicionar telefone e email
- [ ] Adicionar endereço com mapa

### Diretórios Locais
- [ ] Registrar em Fixando.pt
- [ ] Registrar em Zaask.pt
- [ ] Registrar em OLX.pt
- [ ] Registrar em Google Maps
- [ ] Registrar em Yelp (se aplicável)
- [ ] Registrar em Yellow Pages Portugal

### Backlinks e Autoridade
- [ ] Criar perfil em redes sociais (Facebook, Instagram, LinkedIn)
- [ ] Adicionar links sociais no site
- [ ] Criar estratégia de guest posting
- [ ] Buscar mencionar em blogs locais
- [ ] Adicionar link do site em assinatura de email

### Analytics e Monitoramento
- [ ] Configurar Google Analytics 4
- [ ] Configurar Google Search Console
- [ ] Configurar Bing Webmaster Tools
- [ ] Monitorar ranking de palavras-chave
- [ ] Rastrear tráfego e conversões
- [ ] Criar relatório mensal de SEO


## Histórico de Horas para Colaboradores
- [x] Usar tabela de histórico existente (registrosHoras)
- [x] Implementar API/tRPC para buscar histórico de horas
- [x] Criar componente de modal/página de histórico com filtros
- [x] Adicionar botão "Histórico de Horas" no dashboard
- [x] Implementar paginação no histórico
- [x] Testar funcionalidade completa (6 testes passando)


## Correções e Bugs Reportados
- [x] Botão de Histórico não funcionava (colaboradorId não estava sendo salvo no localStorage)

- [x] Corrigir cálculo de horas para registros sem pausa (mostra NaNh e €NaN)

- [x] Inverter ordem do histórico (mais recente primeiro, não mais antigo primeiro)


## Otimização de Conteúdo e SEO (Fase 2)
- [x] Criar seção de Blog no site com 5 artigos otimizados para palavras-chave alvo
- [x] Artigo 1: "Remoção de Entulho em Lisboa - Guia Completo 2026"
- [x] Artigo 2: "Mudança Rápida e Segura - Como a CLYON Faz Diferença"
- [x] Artigo 3: "Limpeza Pós-Obra: Serviços Profissionais em Lisboa"
- [x] Artigo 4: "Quanto Custa Remover Entulho? Preços e Orçamentos"
- [x] Artigo 5: "Serviços de Mudança Econômica em Lisboa - Sem Stress"
- [ ] Criar página de Depoimentos com integração a Google Reviews
- [ ] Otimizar meta descriptions de todas as páginas
- [ ] Adicionar breadcrumb navigation ao site
- [ ] Implementar schema.org LocalBusiness com endereço e telefone
- [ ] Criar página de Contato com formulário e mapa

- [x] Bug: Registros de segunda não aparecem nas horas de "Esta Semana" (mostra 0.00h mas há registros)

- [x] Adicionar seção "Hoje" com horas e valor do dia no dashboard
- [x] Ocultar fuso horário visualmente (manter nos dados, exibir apenas YYYY-MM-DD)

- [x] Bug: "Esta Semana" mostra 0.00h mas "Hoje" mostra 8.50h (admins eram excluídos da lista)

- [ ] Investigar por que "Esta Semana" ainda mostra 0.00h quando "Hoje" mostra 8.50h
- [ ] Verificar dados no banco de dados (formato de data, fuso horário)
- [ ] Adicionar logs de debug para entender o cálculo de semana

- [x] Corrigir cálculo de "Esta Semana" para usar fuso horário de Portugal (GMT+1) em vez de UTC

- [ ] Corrigir card "Hoje" no dashboard admin para mostrar total de TODOS os colaboradores (não apenas admin logado)
- [ ] Corrigir card "Esta Semana" para mostrar total de TODOS os colaboradores
- [ ] Corrigir card "Últimos 15 Dias" para mostrar total de TODOS os colaboradores
- [ ] Corrigir card "Este Mês" para mostrar total de TODOS os colaboradores

- [x] Corrigir bug "Esta Semana" mostrando 0.00h no painel admin
  - [x] Diagnosticar causa raiz: mistura de métodos locais (setDate/setHours/getDate) com datas UTC (Date.UTC)
  - [x] Corrigir função calcularEstatisticas para usar exclusivamente métodos UTC
  - [x] Corrigir parsing de datas de registros para usar Date.UTC com substring YYYY-MM-DD
  - [x] Escrever testes unitários cobrindo todos os cenários de timezone
  - [x] Verificar correção no browser (MATHEUS AMORIN: 8.50h esta semana)

- [x] Corrigir cálculo de valor de "Hoje" no painel admin
  - [x] Bug: totalValorHoje usa valorHora do primeiro colaborador (colaboradores[0]) em vez de somar individualmente
  - [x] Corrigir para calcular horas × valorHora de cada colaborador e somar
  - [x] Testar com MATHEUS (8.50h × €8 = €68.00) - Confirmado: Hoje e Esta Semana agora ambos mostram €68.00

- [x] Corrigir formatação de data no dashboard do colaborador
  - [x] Bug: registro de 09/02 (segunda) aparece como "domingo, 08/02/2026" no histórico
  - [x] Problema: conversão de timezone ao formatar data (UTC → hora local)
  - [x] Corrigir para usar UTC ao formatar data e dia da semana (getUTCDay, getUTCDate, getUTCMonth, getUTCFullYear)
  - [x] Testar que 2026-02-09 aparece como "segunda-feira, 09/02/2026" - Confirmado no dashboard do MATHEUS

## SEO Quick Wins (Prioridade Máxima - 1-3 dias)

- [x] Adicionar noindex em /colaboradores (portal do colaborador)
  - [x] Adicionar meta tag noindex no componente ColaboradorLogin
  - [x] Adicionar meta tag noindex no componente ColaboradorAdmin
  - [x] Adicionar meta tag noindex no componente ColaboradorDashboard

- [x] Corrigir links 404 no rodapé
  - [x] Corrigir link /perguntas-frequentes → /central-ajuda (rotas corrigidas no App.tsx)
  - [x] Criar página /confianca-seguranca ou remover link (rota já existe)

- [ ] Transformar /central-ajuda em FAQ com respostas visíveis
  - [ ] Modificar componente para mostrar respostas expandidas por padrão (ou visíveis no HTML)
  - [ ] Garantir que respostas são rastreáveis pelo Google

- [ ] Adicionar área de atuação na homepage
  - [ ] Adicionar seção "Onde Operamos" com cidades/regiões servidas
  - [ ] Colocar acima da dobra (visível sem scroll)

- [x] Corrigir linguagem PT-BR → PT-PT
  - [x] "Aluguel" → "Aluguer" (Home, Services)
  - [x] "Cadastre-se" → "Registe-se" (Home, Auth, EncontrarEmprego)
  - [x] "Fale Conosco" → "Contacte-nos" (EncontrarEmprego, CreditoFiscal)
  - [x] Remover mistura de francês no rodapé (Home, AplicativoMovel)
  - [ ] Definir lang="pt-PT" no HTML (próxima fase)

- [ ] Implementar dados estruturados (Schema.org)
  - [ ] LocalBusiness/ProfessionalService com área servida
  - [ ] Service para cada tipo de serviço
  - [ ] AggregateRating (avaliações)
  - [ ] FAQPage na central de ajuda

- [ ] Criar sitemap.xml
  - [ ] Gerar sitemap com todas as páginas públicas
  - [ ] Excluir páginas noindex (/colaboradores)
  - [ ] Adicionar ao robots.txt

## Análise e Correção de FAQ

- [x] Analisar todas as páginas do FAQ
  - [x] Navegar por /central-ajuda e verificar todas as 8 perguntas
  - [x] Identificar links quebrados (2 encontrados)
  - [x] Identificar conteúdo incorreto ou desatualizado (nenhum)
  - [x] Identificar problemas de layout ou UX (respostas ocultas)
  - [x] Verificar se respostas são visíveis (para SEO) - PROBLEMA ENCONTRADO

- [x] Corrigir erros encontrados
  - [x] Corrigir links quebrados:
    - [x] Adicionar link "Solicitar um serviço" → /solicitar-servico
    - [x] Adicionar link "Encontrar um emprego" → /encontrar-emprego
  - [x] Atualizar conteúdo incorreto (nenhum necessário)
  - [x] Corrigir problemas de layout:
    - [x] Deixar todas as respostas visíveis por padrão (melhor para SEO)
    - [x] Implementar dados estruturados FAQPage (Schema.org)
  - [x] Garantir que respostas são rastreáveis pelo Google

- [x] Testar todas as páginas corrigidas
  - [x] Testar link "Solicitar um serviço" → Funciona ✓
  - [x] Testar link "Encontrar um emprego" → Funciona ✓
  - [x] Verificar respostas visíveis → Todas expandidas ✓
  - [x] Verificar Schema.org no HTML → Implementado ✓

## Implementação Completa de SEO (TODAS as melhorias)

### Fase 1: Quick Wins Restantes
- [x] Adicionar lang="pt-PT" no HTML
- [x] Adicionar seção "Onde Operamos" na homepage
  - [x] Listar cidades/regiões servidas (Lisboa, Setúbal, Margem Sul, Almada, Seixal, Barreiro, Moita, Palmela, Sesimbra)
  - [x] Posicionar logo após Hero Section
- [x] Otimizar meta tags de todas as páginas
  - [x] Title tags com palavras-chave + localização (já otimizado no index.html)
  - [x] Meta descriptions com CTA claro (já otimizado)
  - [x] Open Graph tags para redes sociais (já implementado)

### Fase 2: Dados Estruturados (Schema.org)
- [x] Implementar LocalBusiness/ProfessionalService
  - [x] Nome, telefone, URL, áreas servidas (8 cidades)
  - [x] Preço range
  - [x] Logo e imagem
- [x] Implementar Service schema
  - [x] Lista de 7 serviços oferecidos
  - [x] Descrição de cada serviço via hasOfferCatalog
- [x] Implementar AggregateRating
  - [x] Rating value: 5.0
  - [x] Review count: 95
  - [x] Best/worst rating definidos
- [x] FAQPage já implementado ✓

### Fase 3: Páginas por Serviço+Cidade
- [x] Criar componente reutilizável ServiceCityPage.tsx
- [ ] Criar estrutura de URLs
  - [ ] /recolha-entulho-lisboa
  - [ ] /recolha-entulho-setubal
  - [ ] /recolha-moveis-almada
  - [ ] /recolha-monos-seixal
  - [ ] /demolicao-controlada-lisboa
  - [ ] /mudancas-lisboa-margem-sul
- [ ] Conteúdo de cada página (600-1200 palavras):
  - [ ] H1 com "serviço + cidade"
  - [ ] O que inclui, prazos, fatores de preço
  - [ ] Como funciona, o que não recolhem
  - [ ] Descarte legal, certificações
  - [ ] FAQ específico do serviço
  - [ ] Fotos reais, testemunhos, antes/depois
  - [ ] CTA claro (WhatsApp/telefone/email)

### Fase 4: Performance e Otimizações Técnicas
- [ ] Comprimir imagens
  - [ ] Converter para WebP/AVIF
  - [ ] Implementar lazy-load
- [ ] Criar sitemap.xml
  - [ ] Incluir todas as páginas públicas
  - [ ] Excluir páginas noindex (/colaboradores)
- [ ] Atualizar robots.txt
  - [ ] Adicionar sitemap
  - [ ] Bloquear /colaboradores
- [ ] Otimizar Core Web Vitals
  - [ ] Reduzir JS desnecessário
  - [ ] Melhorar LCP, FID, CLS

### Fase 5: Páginas Institucionais
- [ ] Criar página "Sobre"
  - [ ] História da empresa
  - [ ] Missão e valores
  - [ ] Equipa (se aplicável)
- [ ] Criar página "Contactos"
  - [ ] Formulário de contacto
  - [ ] Telefone, email, WhatsApp
  - [ ] Morada (se aplicável)
  - [ ] Mapa (Google Maps)
- [ ] Criar página "Licenças e Conformidade"
  - [ ] Certificações de descarte
  - [ ] Seguros
  - [ ] Conformidade legal
  - [ ] Parcerias com centros de reciclagem

### Fase 6: Testes e Validação
- [ ] Testar todas as páginas novas
- [ ] Validar dados estruturados (Google Rich Results Test)
- [ ] Testar performance (PageSpeed Insights)
- [ ] Verificar responsividade mobile
- [ ] Testar todos os links internos
- [ ] Submeter sitemap ao Google Search Console

## Redesign da Seção "Onde Operamos"
- [x] Melhorar design visual da seção
  - [x] Adicionar gradiente de fundo (cyan/dark)
  - [x] Cards com elevação e hover effects
  - [x] Ícones mais destacados
  - [x] Melhorar tipografia e espaçamento
  - [x] Adicionar animações sutis
- [x] Testar responsividade mobile
- [x] Verificar consistência com identidade visual CLYON


## Correções Críticas de SEO (Diagnóstico Completo)

### Prioridade A - Indexação e Conteúdo

- [x] **A1: Corrigir conteúdo vazio em FAQ/Central de Ajuda**
  - [x] Garantir que respostas estão renderizadas no HTML (não apenas em acordeões ocultos)
  - [x] Testar que Google consegue "ver" o conteúdo das respostas
  - [x] Validar schema FAQPage está correto

- [ ] **A2: Resolver domínio duplicado (clyon.pt vs clyonsales.com)**
  - [ ] Escolher clyon.pt como domínio principal
  - [ ] Configurar redirect 301 de clyonsales.com → clyon.pt
  - [ ] Adicionar canonical tags apontando para clyon.pt
  - [ ] Atualizar links internos e perfis

- [x] **A3: Melhorar indexação no Google**
  - [x] Validar Google Search Console
  - [x] Submeter sitemap.xml
  - [x] Corrigir problemas de noindex/robots/canonicals
  - [x] Garantir páginas essenciais não bloqueadas por JS

- [x] **A4: Marcar páginas internas como noindex**
  - [x] Portal do Colaborador (/colaboradores) - noindex
  - [x] Login de colaboradores - noindex
  - [x] Dashboard de colaboradores - noindex
  - [x] Painel admin - noindex

### Prioridade B - Páginas Money Pages

- [x] **B1: Criar landing pages por serviço+cidade**
  - [x] /recolha-entulho-lisboa (900-1500 palavras)
  - [x] /recolha-moveis-lisboa (900-1500 palavras)
  - [x] /recolha-entulho-setubal (900-1500 palavras)
  - [x] /recolha-moveis-setubal (900-1500 palavras)
  - [x] /recolha-monos-lisboa (900-1500 palavras)
  - [x] /recolha-monos-setubal (900-1500 palavras)

- [x] **B2: Conteúdo de cada landing page deve incluir:**
  - [x] H1 exato (ex: "Recolha de Entulho em Lisboa — Rápido e Legal")
  - [x] Tipos de entulho (RCD, madeiras, gesso, cerâmicos)
  - [x] Como funciona (visita/WhatsApp → orçamento → recolha)
  - [x] Zonas atendidas (freguesias/municípios)
  - [x] Prazos (no próprio dia/24h)
  - [x] Prova social (fotos reais, reviews, casos)
  - [x] Descarte legal (muito importante para confiança)
  - [x] FAQ com respostas completas
  - [x] CTA repetido (WhatsApp + formulário)

- [ ] **B3: Corrigir foco e linguagem do site**
  - [ ] Remover/reorganizar categorias genéricas (eletricista, encanador)
  - [ ] Reposicionar como especialista em recolha de entulho/móveis
  - [ ] Adaptar linguagem PT-BR → PT-PT (camião, canalizador, o seu)
  - [ ] Revisar preços (€9/h pode prejudicar confiança)

### Prioridade C - SEO Local

- [ ] **C1: Criar página /contactos com NAP completo**
  - [ ] Nome completo da empresa
  - [ ] Morada (ou área de cobertura)
  - [ ] Telefone
  - [ ] Email
  - [ ] Horários de funcionamento
  - [ ] Áreas Lisboa/Setúbal/Margem Sul

- [ ] **C2: Otimizar Google Business Profile (GBP)**
  - [ ] Categoria principal (Serviço de gestão de resíduos / Remoção de lixo)
  - [ ] Descrição completa
  - [ ] Serviços listados
  - [ ] Áreas de cobertura
  - [ ] Fotos reais
  - [ ] Horários
  - [ ] Postagens semanais

- [ ] **C3: Implementar schema local**
  - [ ] LocalBusiness com NAP
  - [ ] Service schema para cada serviço
  - [ ] FAQPage schema
  - [ ] Review schema (com conformidade)

### Prioridade D - Técnica

- [ ] **D1: Sitemap e robots corretos**
  - [ ] Criar sitemap.xml com todas as páginas públicas
  - [ ] Excluir páginas noindex (/colaboradores, /login, etc)
  - [ ] Atualizar robots.txt

- [ ] **D2: Core Web Vitals**
  - [ ] Reduzir tamanho de imagens
  - [ ] Implementar lazy-load
  - [ ] Otimizar fontes
  - [ ] Reduzir JS desnecessário

- [ ] **D3: Validar conteúdo acessível sem JS**
  - [ ] FAQ renderizado no HTML
  - [ ] Conteúdo não depender de JavaScript para ser indexado
  - [ ] Testar com curl/wget

### Próximas Fases (2-3 meses)

- [ ] Criar páginas locais adicionais (Almada, Seixal, Barreiro, etc)
- [ ] Conteúdo educativo (big bag, regras, coimas)
- [ ] Link building local (parcerias, diretórios)
- [ ] Rotina de reviews no GBP (5-10/mês)


## Correções Técnicas Críticas de SEO (Diagnóstico Adicional)

### Schema Markup

- [x] **Implementar Schema LocalBusiness**
  - [x] Nome: CLYON
  - [x] Endereço: Rua dos Jasmins 3, Belverde, Amora, 2845-513
  - [x] Telefone: +351 931 632 622
  - [x] Email: wwcampss@gmail.com
  - [x] Áreas servidas: Lisboa, Setúbal, Almada, Seixal, etc.
  - [x] Horário de funcionamento

- [x] **Implementar Schema Service para cada serviço**
  - [x] Recolha de Entulho
  - [x] Recolha de Móveis
  - [x] Recolha de Monos
  - [x] Demolições
  - [x] Mudanças

- [x] **Implementar Schema FAQPage nas páginas com FAQ**
  - [x] Home
  - [x] Money pages (6 páginas)
  - [x] Central de Ajuda

- [x] **Implementar Schema Review/AggregateRating**
  - [x] Avaliação média: 5.0
  - [x] Número de reviews: 95+

### Otimização On-Page

- [x] **Otimizar meta tags em todas as páginas**
  - [x] Title tag único e otimizado (50-60 caracteres)
  - [x] Meta description persuasiva (150-160 caracteres)
  - [x] Open Graph tags (og:title, og:description, og:image)
  - [x] Twitter Card tags

- [ ] **Garantir H1 único e otimizado em cada página**
  - [ ] Home: "Recolha de Entulho e Móveis em Lisboa e Setúbal"
  - [ ] Contactos: "Contacte a CLYON"
  - [ ] Money pages: já otimizados

- [ ] **Adicionar alt text em todas as imagens**
  - [ ] Logo CLYON
  - [ ] Imagens de serviços
  - [ ] Fotos da equipa (quando adicionadas)

### Acessibilidade para Crawlers

- [ ] **Garantir conteúdo acessível sem JavaScript**
  - [ ] FAQ renderizado no HTML (já feito)
  - [ ] Conteúdo principal não depende de JS
  - [ ] Testar com curl/wget

- [ ] **Verificar robots.txt não bloqueia páginas importantes**
  - [ ] Já atualizado

- [ ] **Adicionar canonical tags**
  - [ ] Apontar para clyon.pt (domínio principal)
  - [ ] Evitar conteúdo duplicado

### Performance e Mobile

- [ ] **Otimizar velocidade (PageSpeed Insights >90)**
  - [ ] Comprimir imagens
  - [ ] Implementar lazy-load
  - [ ] Minificar CSS/JS
  - [ ] Usar CDN

- [ ] **Garantir design mobile-first**
  - [ ] Já implementado com Tailwind responsive

### Backlinks e Autoridade (Futuro)

- [ ] Registrar em diretórios locais (Fixando, Zaask, OLX, Páginas Amarelas)
- [ ] Criar/otimizar Google Business Profile
- [ ] Buscar parcerias com imobiliárias/construção
- [ ] Guest posts em blogs locais


## Revisão Final - Análise Detalhada

### Meta Tags e SEO
- [x] Title tag otimizado (já implementado)
- [x] Meta description otimizada (já implementada)
- [x] Viewport tag (já implementado)
- [x] Open Graph tags (já implementados)
- [x] Twitter Card (já implementado)
- [x] Canonical tag (já implementado)

### Imagens
- [x] Adicionar alt text em todas as imagens
  - [x] Logo CLYON
  - [x] Imagens de serviços
  - [x] Imagens de fundo
  - [x] Ícones

### Responsividade
- [x] Design mobile-first com Tailwind (já implementado)
- [x] Verificar se todas as páginas são responsivas
- [x] Testar em dispositivos móveis

### Google Business Profile
- [ ] Criar/otimizar perfil no Google Business
- [ ] Adicionar fotos de serviços
- [ ] Solicitar reviews de clientes

### Performance
- [ ] Otimizar imagens (comprimir)
- [ ] Implementar lazy-load
- [ ] Minificar CSS/JS (Vite já faz isso)

### Conteúdo
- [x] H1 otimizado em cada página
- [x] FAQ com respostas visíveis
- [x] Prova social (testemunhos)
- [x] CTA repetido (WhatsApp)

## Correção de Erro 404 no Google Search Console
- [x] Investigar causa do erro 404 (www.clyon.pt/contato vs clyon.pt/contactos)
- [x] Corrigir redirecionamento de www para domínio principal
- [x] Adicionar redirect 301 de /contato para /contactos
- [x] Solicitar reindexação no Google Search Console

## Correção de Duplicação DNS e HTTPS
- [x] Criar guia para forçar HTTPS no cPanel
- [x] Criar guia para redirecionar www para domínio principal
- [x] Documentar configuração de canonical tags
- [x] Implementar redirects no código Express.js
- [x] Testar redirects com vitest (6 testes passaram)


## Página de Política de Privacidade
- [x] Criar página /privacidade com conteúdo RGPD-compliant
- [x] Integrar rota no App.tsx
- [x] Atualizar link no footer (Home.tsx e Contactos.tsx)
- [x] Testar página e links


## Categorias de Serviços Interativas
- [x] Tornar ícones de categorias clicáveis
- [x] Criar modal com descrição da categoria
- [x] Adicionar botão "Simular Orçamento" no modal
- [x] Implementar redirecionamento para simulador com categoria pré-selecionada
- [x] Testar interatividade das categorias


## Integração WhatsApp no Simulador de Mudanças
- [x] Localizar página/componente do simulador de mudanças
- [x] Adicionar botão "Contactar via WhatsApp" (já existia)
- [x] Implementar lógica para gerar link WhatsApp com valor simulado
- [x] Testar redirecionamento WhatsApp com valor incluído


## Remover Referências a App Móvel
- [x] Remover links de "Aplicativo Móvel" do footer e navegação
- [x] Remover links de "Encontrar Emprego" e "Ser Profissional"
- [x] Remover links de "Avaliações de Clientes"
- [x] Remover links de "Convide Amigos"
- [x] Remover links de "Perguntas Frequentes"
- [x] Remover links de "Confiança e Segurança"
- [x] Remover rotas do App.tsx (/aplicativo-movel, /profissional, etc.)
- [x] Adicionar redirects 301 para homepage para páginas removidas
- [x] Bloquear /auth e /colaboradores/admin com noindex
- [x] Corrigir /contato para redirecionar para /contactos
- [x] Atualizar sitemap.xml
- [x] Atualizar robots.txt
- [x] Testar todas as mudanças


## Melhorias de Performance (PageSpeed Insights)

### Prioridade 1: Otimizar Logo
- [ ] Converter logo CLYON para WebP/AVIF (de 181,8 KiB para ~30-50 KiB)
- [ ] Redimensionar logo para 205x84px (tamanho exibido)
- [ ] Adicionar width/height explícitos na tag img
- [ ] Testar economia de 179 KiB

### Prioridade 2: Otimizar CSS e Renderização
- [ ] Inline CSS crítico (acima da dobra)
- [ ] Defer CSS não-crítico
- [ ] Verificar font-display: swap no Google Fonts
- [ ] Testar economia de 1.420 ms

### Prioridade 3: Code Splitting e Lazy-Loading
- [ ] Lazy-load páginas de serviço (/recolha-*, /blog/*)
- [ ] Lazy-load componentes pesados (Maps, modais)
- [ ] Remover código não utilizado (tree-shaking)
- [ ] Testar economia de 191 KiB

### Prioridade 4: Validação
- [ ] Executar novo teste PageSpeed após mudanças
- [ ] Verificar se Desempenho ≥ 80
- [ ] Verificar Core Web Vitals (LCP < 2.5s, TBT < 100ms)


## Correções de Indexação GSC (14 páginas não indexadas)

- [ ] Diagnosticar 14 páginas não indexadas
- [ ] Corrigir canonical tags duplicadas
- [ ] Remover redirects desnecessários
- [ ] Corrigir erros 404 e soft 404
- [ ] Solicitar reindexação no GSC


## Correção de Bug - Margem Dupla no Simulador de Móveis Por Item
- [x] Identificar problema: Margem de 40% estava sendo aplicada DUAS VEZES
  - [x] Resultado incorreto: €194.04 em vez de €138.60
  - [x] Causa: Código aplicava margem na fórmula de móveis por item E novamente na fórmula de mudanças
- [x] Corrigir código do simulador (SimuladorOrcamento.tsx)
  - [x] Remover aplicação dupla de margem
  - [x] Aplicar margem apenas uma vez para móveis por item
  - [x] Manter margem correta para mudanças
- [x] Adicionar teste vitest para validar correção
  - [x] Teste específico para cenário do usuário (€138.60)
  - [x] Todos os 42 testes passando
- [x] Documentação completa criada (DOCUMENTACAO_SIMULADORES.md)


## Correção de Bug - Cálculo Incorreto de Horas Trabalhadas (Adilson)
- [x] Identificar problema: Cálculo de horas estava retornando +43 minutos a mais
  - [x] Esperado: 34h05 = €238.58 (com 7€/h)
  - [x] Sistema mostrava: 34h48 = €243.60 (diferença de 43 minutos)
  - [x] Causa: Função calcularHoras() usava Math.round() sem padStart(), causando perda de precisão
- [x] Corrigir função calcularHoras() em server/routes/colaboradores.ts
  - [x] Substituir `Math.round((minutos / 60) * 100)` por versão com padStart()
  - [x] Garantir formato decimal correto: ".08" em vez de ".8"
- [x] Adicionar 14 testes vitest para validar cálculo de horas
  - [x] Testes para cenários específicos do Adilson (dias 18-21/02)
  - [x] Testes para diferentes pausas (30min, 45min, 1h)
  - [x] Todos os 56 testes passando
- [x] Validar que total agora retorna 34h05 = €238.58


## Correção de Login - Admin WANDERSON
- [x] Identificar problema: WANDERSON não existia no banco de dados
- [x] Verificar que nenhum usuário admin existia (isAdmin = 0 para todos)
- [x] Criar usuário WANDERSON como admin com senha WWclyon26
  - [x] Gerar hash bcrypt da senha
  - [x] Inserir no banco de dados com isAdmin = 1
  - [x] Validar que usuário foi criado com sucesso
- [ ] Testar login com WANDERSON / WWclyon26


## Melhoria de Contraste - Registro de Saída
- [x] Identificar problema: Inputs de hora pausa, saída e trabalhos invisíveis
  - [x] Causa: bg-white/10 (10% opacidade) com texto branco
  - [x] Afetava: ColaboradorDashboard.tsx linhas 365, 379, 394
- [x] Corrigir contraste com cores nítidas e fortes
  - [x] Hora Pausa: bg-white + borda azul (#0097b2)
  - [x] Hora Saída: bg-white + borda vermelha
  - [x] Nº Trabalhos: bg-white + borda laranja
  - [x] Texto cinza escuro (font-semibold) para máximo contraste
  - [x] Focus ring com cores correspondentes
- [x] Validar que todos os 56 testes passam


## Carrossel de Imagens - Hero Section
- [x] Criar componente ImageCarousel com auto-play
- [x] Integrar 6 imagens reais na Hero Section
- [x] Adicionar indicadores de posição (dots)
- [x] Testar transições suaves
- [x] Validar responsividade mobile


## Ajuste de Posicionamento do Carrossel
- [x] Reposicionar carrossel para canto inferior direito
- [x] Reduzir tamanho do carrossel
- [x] Manter conteúdo da esquerda intacto
- [x] Testar layout responsivo
- [x] Adicionar novo favicon (favicon.ico, favicon-16x16.png, favicon-32x32.png)


## Implementar Funcionalidades clyonsales.com - Mantendo Cores Atuais
- [ ] Atualizar Header com navegação (Serviços, Trabalhos, Avaliações, Sobre Nós, Contacto)
- [ ] Adicionar botão "Ligar Agora" no header
- [ ] Redesenhar Hero com layout 2 colunas (esquerda conteúdo, direita carrossel)
- [ ] Mover carrossel para ocupar coluna direita inteira
- [ ] Manter paleta de cores atual (sem alterar)
- [ ] Testar responsividade

## BUG: Cálculo de Horas por Período Invertido
- [x] Corrigir lógica de cálculo: Esta Semana (183.08h) > Últimos 15 Dias (29.69h) > Este Mês (76.03h)
- [x] Verificar filtros de data para cada período
- [x] Testar com dados reais para validar correção


## BUG: Google Maps API Key Inválida em Setúbal
- [x] Corrigir erro "Google Maps Platform rejected your request. The provided API key is invalid."
- [x] Validar e atualizar chave da API do Google Maps
- [x] Testar mapa na página de Setúbal

## SEO Local - Páginas Regionais
- [ ] Criar estrutura de dados com todas as regiões (Grande Lisboa + Margem Sul)
- [ ] Implementar rotas dinâmicas por região (/recolha-moveis-lisboa, etc)
- [ ] Criar componente de página regional com conteúdo único
- [ ] Adicionar schema markup local (JSON-LD) com endereço e telefone
- [ ] Implementar meta tags dinâmicas por região
- [ ] Gerar sitemap com todas as páginas regionais
- [ ] Testar páginas em Google Search Console
- [ ] Adicionar breadcrumbs estruturados


## SEO Local - Páginas Regionais (34 Regiões)
- [x] Criar 34 páginas regionais para recolha de móveis
- [x] Adicionar 34 rotas no App.tsx
- [ ] Corrigir renderização de conteúdo nas páginas regionais
- [ ] Implementar schema markup local (JSON-LD)
- [ ] Gerar sitemap com todas as URLs regionais
- [ ] Testar indexação no Google Search Console


## Remover Páginas Antigas
- [x] Remover rota /auth
- [x] Remover rota /contato (redirect para /contactos)


## BUG: Erro ao Criar Novo Admin
- [x] Investigar erro "Erro ao criar colaborador" ao tentar criar novo admin
- [x] Verificar logs do servidor
- [x] Corrigir bug no backend (aceitar parâmetro isAdmin)
- [x] Adicionar modal de criação com opção de admin
- [x] Corrigir tipo de valorHora (decimal em vez de string)
- [x] Adicionar 'admin' como opção válida no enum de funcao
- [x] Executar migração do banco de dados
- [ ] Testar criação de novo admin (Rodrigo, 8 euros/hora, senha MILITA26)


## SEO - Indexação Google Search Console
- [x] Adicionar tags canônicas em todas as páginas (CanonicalTag.tsx já implementado)
- [x] Criar sitemap.xml com todas as 34 URLs regionais
- [ ] Submeter sitemap ao Google Search Console
- [ ] Testar redirecionamento de http para https
- [ ] Testar redirecionamento de www.clyon.pt para clyon.pt
- [ ] Validar que apenas https://clyon.pt é a versão canônica


## SEO Agressivo - Top 5 Google para Todas as Regiões
- [ ] Otimizar títulos únicos por região (ex: "Recolha de Móveis em Seixal - Clyon")
- [ ] Otimizar meta descriptions com keywords locais
- [ ] Enriquecer conteúdo com keywords de cauda longa (ex: "recolha gratuita de móveis em Seixal")
- [ ] Implementar schema markup LocalBusiness em cada página regional
- [ ] Adicionar FAQ schema com perguntas frequentes por região
- [ ] Otimizar velocidade de página (Core Web Vitals)
- [ ] Adicionar estratégia de backlinks internos (links de home para regionais)
- [ ] Submeter sitemap atualizado ao Google Search Console
- [ ] Monitorar rankings semanalmente e ajustar estratégia


## Otimizações de SEO Local (Fase 1)
- [x] Criar 34 páginas regionais com conteúdo único para cada região
- [x] Adicionar campos SEO em regions.ts:
  - [x] title: Título único otimizado para cada região (60 caracteres)
  - [x] metaDescription: Meta description única (120-160 caracteres)
  - [x] keywords: Array de keywords regionais otimizadas
- [x] Implementar meta tags dinâmicas em ServiceCityPage.tsx
  - [x] Atualizar document.title dinamicamente
  - [x] Atualizar meta description dinamicamente
- [x] Implementar schema markup LocalBusiness em cada página regional
  - [x] JSON-LD estruturado com dados da empresa
  - [x] Incluir nome, descrição, telefone, endereço, área de serviço
- [x] Criar testes vitest para validar SEO:
  - [x] Validar 34 regiões com slugs únicos
  - [x] Validar campos SEO completos
  - [x] Validar títulos e descriptions únicos
  - [x] Validar coordenadas geográficas
  - [x] Validar números de telefone
  - [x] Validar keywords otimizadas
  - [x] Validar formato SEO-friendly dos títulos
  - [x] Todos os 12 testes passando ✓

## Próximas Etapas de SEO Local (Fase 2)
- [ ] Enriquecer conteúdo das páginas regionais com:
  - [ ] Descrições únicas para cada região (não duplicadas)
  - [ ] Informações específicas sobre a região (bairros, características)
  - [ ] Casos de sucesso locais
- [ ] Implementar breadcrumb schema markup
- [ ] Otimizar imagens com alt text regional
- [ ] Criar internal linking strategy entre páginas regionais
- [ ] Implementar FAQ schema markup
- [ ] Submeter sitemap atualizado ao Google Search Console
- [ ] Configurar 301 redirects (http → https, www → non-www)
- [ ] Monitorar rankings no Google Search Console
- [ ] Implementar Local Citations (Google My Business, Yelp, etc.)
- [ ] Criar conteúdo de blog com keywords regionais


## Estratégia Agressiva de SEO Local e Nacional (Fase 3)

### Otimizacao Tecnica Imediata
- [x] Implementar FAQ Schema Markup em todas as 34 paginas regionais
- [x] Implementar Breadcrumb Schema Markup
- [x] Implementar AggregateRating Schema (5 estrelas, 8 avaliacoes)
- [x] Implementar Organization Schema Markup (nome, logo, contato)
- [ ] Otimizar Core Web Vitals (LCP, FID, CLS)

### Internal Linking Estratégico
- [x] Criar links entre páginas regionais (ex: "Veja também recolha em Almada")
- [ ] Adicionar links internos na homepage para top 5 regiões
- [ ] Criar hub page "Recolha de Móveis em Portugal" com links para todas as regiões
- [x] Implementar related posts em cada página regional

### Conteúdo de Blog (Keywords Long-Tail)
- [ ] Artigo 1: "Quanto custa recolha de móveis em Lisboa? Preços 2025"
- [ ] Artigo 2: "Recolha de móveis em Setúbal - Guia Completo"
- [ ] Artigo 3: "Como descartar móveis antigos legalmente em Portugal"
- [ ] Artigo 4: "Recolha de entulho pós-obra - Tudo o que precisa saber"
- [ ] Artigo 5: "Diferença entre recolha de móveis e entulho"
- [ ] Artigo 6: "Recolha de móveis em Almada - Serviço rápido e profissional"
- [ ] Artigo 7: "Recolha de monos - O que é e como funciona"
- [ ] Artigo 8: "Recolha de móveis usados - Reutilização vs Reciclagem"
- [ ] Artigo 9: "Recolha de entulho em Seixal - Preços e Disponibilidade"
- [ ] Artigo 10: "Limpeza pós-obra + Recolha de entulho - Serviço completo"

### Local Citations (Diretórios Portugueses)
- [ ] Registar em Google My Business (verificar estabelecimento)
- [ ] Registar em Yelp Portugal
- [ ] Registar em TripAdvisor (Local Services)
- [ ] Registar em Páginas Amarelas
- [ ] Registar em Bolsa de Empresas
- [ ] Registar em Diretório de Empresas Portuguesas
- [ ] Registar em Facebook Business
- [ ] Registar em LinkedIn Company Page

### Estratégia de Backlinks
- [ ] Identificar 20 blogs relacionados (mudanças, limpeza, construção)
- [ ] Propor guest posts com links para clyon.pt
- [ ] Contactar influenciadores locais (YouTubers, TikTokers)
- [ ] Criar partnerships com empresas complementares
- [ ] Solicitar links de associações de empresas
- [ ] Mencionar em press releases locais

### Otimização de Páginas Regionais
- [ ] Adicionar conteúdo único para cada região (200-300 palavras)
- [ ] Adicionar informações específicas (bairros, características)
- [ ] Adicionar casos de sucesso locais
- [ ] Adicionar FAQ específica da região
- [ ] Adicionar imagens locais (antes/depois)
- [ ] Adicionar vídeo de apresentação regional

### Monitoramento e Análise
- [ ] Configurar Google Search Console
- [ ] Configurar Google Analytics 4
- [ ] Monitorar rankings para keywords principais
- [ ] Criar relatório semanal de progresso
- [ ] Analisar concorrência (Remar, Betel, etc.)
- [ ] Ajustar estratégia baseado em resultados


## Correção de Problemas de Indexação (Fase 4 - URGENTE)

### Erros de Indexação no Google Search Console
- [x] Bloquear /colaboradores/admin no robots.txt (página admin não deve ser indexada)
- [x] Criar redirecionamento 301 para /contato (erro 404)
- [x] Criar redirecionamento 301 para /privacidade (erro 404)
- [x] Criar redirecionamento 301 para /servicos (erro 404)
- [x] Criar redirecionamento 301 para /servicos-empresariais (erro 404)
- [x] Criar redirecionamento 301 para /simulador (erro 404)
- [x] Criar redirecionamento 301 para /solicitar-servico (erro 404)
- [x] Remover /recolha-monos-setubal (página não existe - redirecionada para /recolha-moveis-setubal)
- [x] Adicionar noindex em páginas de admin
- [ ] Corrigir canonical tags em todas as páginas

### Otimização de Performance (PageSpeed)
- [ ] Reduzir Largest Contentful Paint (LCP) - Desktop: 79 → 90+
- [ ] Reduzir Cumulative Layout Shift (CLS) - Desktop: 79 → 90+
- [ ] Reduzir First Input Delay (FID) - Mobile: 77 → 90+
- [ ] Otimizar imagens (compressão, lazy loading)
- [ ] Implementar cache de browser
- [ ] Minificar CSS e JavaScript
- [ ] Remover CSS não utilizado
- [ ] Otimizar fontes (Google Fonts)
- [ ] Implementar code splitting

### Validação Final
- [ ] Testar todas as URLs no Google Search Console
- [ ] Verificar se páginas foram indexadas após correções
- [ ] Executar PageSpeed novamente e comparar scores
- [ ] Validar redirecionamentos 301
- [ ] Testar robots.txt


## Melhorias de Design (Fase 5)

- [x] Remover nome "CLYON" da seção "Onde Operamos"
- [x] Adicionar grade/grid no fundo da seção (cyan grid pattern)
- [ ] Ajustar espaçamento da seção após remover CLYON


## Navegação Funcional do Menu (Fase 6)

- [x] Criar página Trabalhos (/trabalhos)
- [x] Criar página Sobre Nós (/sobre-nos)
- [x] Adicionar rotas no App.tsx para Trabalhos, SobreNos e AvaliacoesClientes
- [x] Atualizar links do header para apontar a páginas reais
  - [x] Serviços → /servicos
  - [x] Trabalhos → /trabalhos
  - [x] Avaliações → /avaliacoes
  - [x] Sobre Nós → /sobre-nos
  - [x] Contacto → /contactos


## SEO Agressivo - Plano Top 5 (Relatório Externo)

### PRIORIDADE 0 (Esta Semana) - Impacto Imediato
- [ ] Resolver clyonsales.com (301 redirect para clyon.pt ou 410 Gone)
- [ ] Remover clyonsales.com do Google Search Console
- [ ] Padronizar rodapé (ano 2026 em todas as páginas)
- [ ] Fortalecer página "Sobre Nós" com morada completa, NIF, políticas
- [ ] Adicionar links internos na Home para money pages (Entulho Lisboa, Móveis Lisboa, Monos Lisboa, etc.)

### PRIORIDADE 1 (2-4 Semanas) - Top 10 → Top 5
- [ ] Reescrever página Recolha Entulho Lisboa com seções: Trabalhos Reais, Preços Exemplos, FAQ Local, Mapa Áreas
- [ ] Reescrever página Recolha Móveis Lisboa com termos: "remoção", "retirada", "móveis velhos"
- [ ] Criar páginas de concelhos: Amadora, Odivelas, Sintra, Cascais, Loures, Oeiras, Almada, Seixal, Barreiro
- [ ] Implementar Schema Markup: LocalBusiness, Service, FAQPage, AggregateRating

### PRIORIDADE 2 (30-90 Dias) - Autoridade e Topical Authority
- [ ] Criar blog posts: "Como descartar entulho legalmente", "Quanto custa recolha de entulho", "Guia retirar sofá/colchão"
- [ ] Construir backlinks locais com empresas de remodelação, pintores, condomínios
- [ ] Parcerias com IPSS e associações locais


## Remoção do Sistema de Autenticação Deprecado (/auth)
- [x] Remover rota /auth do App.tsx
- [x] Remover arquivo Auth.tsx
- [x] Remover referência /auth do middleware noindex em server/_core/index.ts
- [x] Executar testes para verificar que tudo funciona (85 testes passando)
- [x] Verificar que não há mais erros 404 para /auth

## Remoção de Emails Expostos (cdn-cgi/l/email-protection)
- [x] Remover email wwcampss@gmail.com de SchemaMarkup.tsx (LocalBusiness e ContactPoint)
- [x] Remover email de OrganizationSchema.tsx
- [x] Remover email de CookieConsent.tsx
- [x] Remover link mailto: de CentralAjuda.tsx
- [x] Remover link mailto: e seção de email de Contactos.tsx
- [x] Remover link mailto: de PerguntasFrequentes.tsx
- [x] Verificar que não há mais referências a wwcampss no código
- [x] Todos os 85 testes passando após remover emails


## Resolução de Duplicação de Conteúdo (Google Search Console)
- [ ] Adicionar redirecionamento de www.clyon.pt para clyon.pt
- [ ] Forçar HTTPS em todas as URLs
- [ ] Adicionar canonical tags em todas as páginas
- [ ] Testar URLs (http, https, www, non-www)
- [ ] Verificar que apenas clyon.pt é indexado

## Resolução de Duplicação de Conteúdo (Google Search Console)
- [x] Adicionar redirecionamento de www.clyon.pt para clyon.pt (já existia)
- [x] Forçar HTTPS em todas as URLs (já existia)
- [x] Adicionar canonical tags em todas as páginas (CanonicalTag.tsx)
- [x] Testar URLs (http, https, www, non-www) - Todos redirecionam corretamente
- [x] Adicionar redirecionamentos 301 para URLs antigas
- [x] Verificar que todos os 85 testes passam
- [x] Confirmar que /contactos está acessível (HTTP 200)

## Remoção de /contato
- [x] Remover redirect de /contato do server/_core/index.ts
- [x] Remover /contato de server/redirects.ts
- [x] Remover /contato de server/redirects-test.test.ts
- [x] Verificar que não há mais referências a /contato no código
- [x] Todos os 85 testes passando
- [x] URL /contato agora retorna página padrão (sem redirect)

## Remoção de Versões Alternativas (HTTP e www)
- [x] Fortalecer redirecionamento de www para non-www com X-Robots-Tag noindex
- [x] Fortalecer redirecionamento de HTTP para HTTPS com X-Robots-Tag noindex
- [x] Adicionar X-Robots-Tag noindex em todas as versões alternativas
- [x] Todos os 85 testes passando
- [x] Apenas https://clyon.pt será indexado

## Atualização de robots.txt
- [x] Atualizar robots.txt com regras mais agressivas
- [x] Bloquear bots maliciosos (AhrefsBot, SemrushBot, DotBot, MJ12bot, YandexBot)
- [x] Adicionar comentário sobre versão canônica
- [x] Manter Sitemap apontando para https://clyon.pt
- [x] Todos os 85 testes passando
- [x] robots.txt acessível em /robots.txt

## Correção de Dados Estruturados - FAQPage Duplicado
- [x] Localizar duplicação de FAQPage nos componentes (SchemaMarkup, FAQSchema, CentralAjuda)
- [x] Remover FAQPage duplicado de SchemaMarkup.tsx
- [x] Manter FAQSchema.tsx para componentes dinâmicos
- [x] Manter FAQPage em CentralAjuda.tsx para página específica
- [x] Todos os 85 testes passando
- [x] Erro crítico "FAQPage duplicado" resolvido


## Alteração de Preços do Simulador
- [x] Alterar valor de distância de €2,00/km para €2,50/km (Mudanças)


## Remoção de Categorias Monos e Misto
- [x] Remover categoria "Monos" do simulador
- [x] Remover categoria "Misto" do simulador
- [x] Remover valores adicionais fixos (€30 e €40)
- [x] Atualizar lógica de cálculo
- [x] Testar simulador com categorias restantes (85 testes passando)

## Alteração de Mão de Obra
- [x] Alterar mão de obra de €8/h para €9/h (Móveis Por Carga)


## Remoção de Adicionais por Região
- [x] Remover campo "Região" do simulador
- [x] Remover adicionais: €20 (Margem Sul), €45 (Lisboa), €45 (Regiões de Lisboa)
- [x] Atualizar lógica de cálculo em todas as categorias
- [x] Testar simulador sem adicionais por região (85 testes passando)


## Remoção da Seção de Adicionais por Região da UI
- [x] Remover campo Select de Região do formulário
- [x] Remover label e descrição de Região
- [x] Remover seção inteira de "ADICIONAIS" da UI
- [x] Testar simulador sem campo de Região (85 testes passando)

## Adição de Margem 30% em Móveis Por Item e Entulho
- [x] Adicionar margem de 30% em Móveis Por Item
- [x] Adicionar margem de 30% em Entulho
- [x] Testar cálculos com nova margem (85 testes passando)

## Atualização de Avaliações
- [ ] Atualizar total de avaliações para 163 (118 Fixando + 45 Google)

## Redesign Visual — Paleta Ciano e Branco
- [x] Redesign completo do Home.tsx (Hero, Como Funciona, Serviços, Onde Operamos, Depoimentos, Por que Clyon, CTA, Footer)
- [x] Redesign do Header.tsx (linha ciano no topo, botão CTA clean)
- [x] Redesign do AvaliacoesClientes.tsx (fundo branco, cards ciano)
- [x] Redesign do Contactos.tsx (fundo branco, hero ciano, cards clean)
- [x] Redesign do CentralAjuda.tsx (fundo branco, hero ciano, accordion clean)

## Redesign com Design de Referência (pasted_content.txt)
- [x] Aplicar estilo de referência ao Header.tsx (manter logo real, nav clean, botão CTA)
- [x] Redesign do Hero com layout 2 colunas (texto + card de passos)
- [x] Redesign da secção de Serviços (cards com hover lift, rounded-[28px])
- [x] Redesign da secção Como Funciona (fundo cyan-50, cards brancos)
- [x] Redesign da secção Cobertura (chips de cidades + bloco escuro)
- [x] Manter imagens de exemplos de trabalhos no body (carrossel/galeria)
- [x] Redesign da secção Depoimentos (fundo escuro, cards glassmorphism)
- [x] Redesign do CTA final (gradiente ciano, botões brancos)
- [x] Preservar logo e botão no rodapé do colaborador

## Ajustes Hero e Galeria
- [x] Remover card "Peça o serviço em 3 passos" do Hero
- [x] Reduzir tamanho da grelha de imagens de trabalhos

## Ajustes Carrossel Hero
- [x] Reduzir altura do carrossel para caber no viewport sem scroll
- [x] Centrar foco das imagens (object-position: center)

## Ajuste Secção Depoimentos
- [x] Converter fundo escuro da secção de depoimentos para fundo claro (cyan-50/branco)

## Certificação APA
- [x] Adicionar bloco de certificação APA no CTA (banner ciano com logo APA e texto sobre resíduos acreditados)

## Texto CTA Final
- [x] Atualizar texto do CTA final com conteúdo relevante ao serviço Clyon

## Mensagem Monos Via Pública
- [x] Adicionar mensagem sobre não descartar monos na via pública no CTA ciano

## Menu Fixo e WhatsApp Flutuante
- [x] Tornar o Header fixo (sticky) com backdrop blur ao fazer scroll
- [x] Adicionar botão flutuante WhatsApp com animação pulse no canto inferior direito

## Botão Colaboradores no Rodapé
- [x] Adicionar botão Colaboradores no rodapé junto ao logo

## Ajuste Carrossel e Card Cobertura
- [x] Aumentar carrossel do Hero em ~10% (de 340px para 374px)
- [x] Ajustar card Cobertura desalinhado abaixo do carrossel

## Redesign Página Sobre a CLYON
- [x] Atualizar cabeçalho escuro da página Sobre a CLYON para estilo branco/ciano

## Atualização Cabeçalhos Escuros para Branco/Ciano
- [ ] Atualizar cabeçalho escuro da página Serviços (Services.tsx)
- [ ] Atualizar cabeçalho escuro da página Trabalhos (Trabalhos.tsx)
- [ ] Atualizar cabeçalho escuro da página ServiceCityPage.tsx (páginas SEO locais)
- [ ] Atualizar cabeçalho escuro da página ServicosEmpresariais.tsx
- [ ] Atualizar cabeçalho escuro da página SolicitarServico.tsx
- [ ] Atualizar cabeçalho escuro da página FAQ.tsx / PerguntasFrequentes.tsx

## Atualização Cabeçalhos Escuros (Mar 2026)

- [x] Atualizar hero escuro da página Serviços (Services.tsx) para fundo ciano
- [x] Atualizar hero escuro da página Trabalhos (Trabalhos.tsx) para fundo ciano
- [x] Atualizar hero escuro da página Serviços Empresariais para fundo ciano
- [x] Atualizar hero escuro da página Solicitar Serviço para fundo ciano
- [x] Atualizar hero escuro da página FAQ para fundo ciano
- [x] Atualizar hero escuro da página Perguntas Frequentes para fundo ciano
- [x] Atualizar hero escuro das páginas ServiceCityPage (SEO local) para fundo ciano
- [x] Remover redirect 301 de /servicos para /servicos-empresariais

## Redesign Blog (Mar 2026)

- [x] Redesenhar página Blog com layout editorial moderno
- [x] Adicionar imagens ilustrativas reais nos cards de blog
- [x] Melhorar hero section do Blog
- [x] Melhorar cards com tipografia e layout editorial
- [x] Melhorar página de artigo individual
- [ ] Redesenhar secção "Como Funciona" com layout moderno e criativo

## SEO - Melhorias para subir no Google (Mar 2026)
- [ ] Corrigir title da página (de "Clyon" para título SEO completo com keywords)
- [ ] Corrigir canonical duplicado (tem 2 tags canonical)
- [ ] Melhorar schema LocalBusiness com geo, horário, email, reviewCount actualizado
- [ ] Adicionar hreflang pt-PT e x-default
- [ ] Criar páginas SEO locais para recolha de entulho por cidade (40+ páginas)
- [ ] Criar páginas SEO para esvaziamento de casas por cidade
- [ ] Criar páginas SEO para limpeza pós-obra por cidade
- [ ] Criar páginas SEO para mudanças por cidade
- [ ] Adicionar FAQ schema markup na página principal
- [ ] Melhorar sitemap com changefreq e priority
- [ ] Adicionar meta tags geo.position com coordenadas
- [ ] Melhorar conteúdo textual da Home com mais keywords


## Melhorias de SEO - Fase 1 (Críticas)
- [x] Implementar meta keywords em todas as páginas principais
  - [x] Homepage (Home.tsx)
  - [x] Página de Serviços (Services.tsx)
  - [x] Página Blog (Blog.tsx)
  - [x] Página FAQ (FAQ.tsx)
- [x] Otimizar títulos (title tags) e meta descriptions para cada página
  - [x] Homepage: "Recolha de Móveis e Entulho em Lisboa e Setúbal | CLYON"
  - [x] Serviços: "Serviços de Recolha e Limpeza | CLYON"
  - [x] Blog: "Blog de Dicas sobre Recolha e Limpeza | CLYON"
  - [x] FAQ: "Perguntas Frequentes | CLYON"
- [x] Melhorar robots.txt com regras para bots de redes sociais
- [ ] Testar meta tags e validar com Google Search Console

## Melhorias de SEO - Fase 2 (Performance)
- [ ] Otimizar performance do site
  - [ ] Comprimir imagens (converter para WebP)
  - [ ] Minificar CSS e JavaScript
  - [ ] Implementar lazy loading para imagens
  - [ ] Reduzir tamanho do HTML (atualmente ~1.5 MB)
- [ ] Criar páginas de localização específicas
  - [ ] /recolha-moveis-lisboa
  - [ ] /recolha-entulho-lisboa
  - [ ] /recolha-monos-lisboa
  - [ ] /limpeza-pos-obra-lisboa
  - [ ] /recolha-moveis-setubal
  - [ ] /recolha-entulho-setubal
  - [ ] E outras combinações de serviço + localização

## Melhorias de SEO - Fase 3 (Autoridade)
- [ ] Criar estratégia de blog
  - [ ] "O que fazer com móveis velhos em Lisboa"
  - [ ] "Como funciona a recolha de entulho de obras"
  - [ ] "Guia completo de recolha de monos"
  - [ ] "Limpeza pós-obra: dicas profissionais"
- [ ] Implementar estratégia de backlinks
  - [ ] Parcerias com empresas de construção
  - [ ] Links de imobiliárias e condomínios
  - [ ] Menção em diretórios locais
- [ ] Submeter sitemap ao Google Search Console


## Migração para Next.js - Fase 1

- [ ] Criar novo projeto Next.js com App Router
- [ ] Copiar estrutura de pastas e componentes
- [ ] Configurar Tailwind CSS 4 com Next.js
- [ ] Migrar componentes React para Next.js
- [ ] Implementar SSR com next/head para meta tags dinâmicas
- [ ] Migrar todas as páginas (Home, Services, Blog, FAQ, etc.)
- [ ] Implementar API routes para backend
- [ ] Gerar sitemap.xml dinâmico
- [ ] Adicionar schema.org JSON-LD
- [ ] Testar todas as páginas e funcionalidades
- [ ] Fazer deploy e validar SEO


## Correção de Design da Página Inicial (Comparação com Referência)
- [ ] Mudar header: botão "Pedir Orçamento" com fundo azul cyan (não branco)
- [ ] Adicionar fundo azul claro/light cyan na hero section
- [ ] Colorir parte do título em azul cyan ("rápida, moderna e sem stress")
- [ ] Melhorar badge de avaliações com fundo azul claro e ícone de ponto
- [ ] Botão "Simular Orçamento" em azul cyan sólido
- [ ] Botão "Ver Trabalhos Reais" com border azul
- [ ] Adicionar botão flutuante WhatsApp verde no canto inferior direito
- [ ] Aumentar espaçamento geral (padding/margin mais generoso)
- [ ] Melhorar layout visual para corresponder ao design desejado
- [ ] Corrigir fundo azul claro da hero section (CSS não está sendo aplicado)
- [ ] Corrigir cores cyan do título e botões
- [ ] Verificar se há conflito com tema claro/escuro
