# Plano de Redesign - Clyon Site

## Objetivo
Reestruturar o site Clyon inspirado em Yoojo, com foco em mudanças e desinstalação, mantendo funcionalidades existentes e cores Clyon.

## Arquitetura do Site

### 1. Homepage (Página Principal)
```
┌─────────────────────────────────────┐
│         HEADER/NAVEGAÇÃO            │
│  Logo | Menu | Login/Admin          │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│         HERO SECTION                │
│  Título + Barra de Busca            │
│  "Mudanças Rápidas e Sem Stress"    │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│      CATEGORIAS DE SERVIÇOS         │
│  [Mudanças] [Móveis] [Desinstal.]   │
│  Cards com ícones + descrição       │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│    COMO FUNCIONA (3 PASSOS)         │
│  1. Descrever serviço               │
│  2. Receber orçamento               │
│  3. Contratar profissional          │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│      AVALIAÇÕES/DEPOIMENTOS         │
│  Cards com fotos + comentários      │
│  Rating stars (4.9/5)               │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│    CALL-TO-ACTION PRINCIPAL         │
│  "Solicitar Orçamento Agora"        │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│         FOOTER                      │
│  Links + Contato + Redes Sociais    │
└─────────────────────────────────────┘
```

### 2. Páginas Principais
- **Home** - Landing page com hero
- **/servicos** - Listagem de serviços
- **/simulador** - Simulador de orçamento (existente)
- **/colaboradores** - Painel de colaboradores (existente)
- **/admin** - Painel administrativo (existente)
- **/sobre** - Sobre a Clyon
- **/contato** - Formulário de contato

### 3. Componentes Reutilizáveis
- **ServiceCard** - Card de serviço com ícone, título, descrição
- **TestimonialCard** - Card de depoimento com foto, nome, rating
- **HeroSection** - Seção hero com background, título, CTA
- **SearchBar** - Barra de busca com sugestões
- **CTAButton** - Botão de call-to-action destacado

### 4. Cores Clyon
- **Primária**: Azul escuro (#003D7A ou similar)
- **Secundária**: Verde (#00B050 ou similar)
- **Neutras**: Branco, Cinza claro, Preto

### 5. Tipografia
- **Títulos**: Sans-serif moderna (ex: Inter, Poppins)
- **Corpo**: Sans-serif legível (ex: Inter, Open Sans)
- **Tamanhos**: H1 (3-4rem), H2 (2-2.5rem), Body (1rem)

### 6. Categorias de Serviços
1. **Mudanças Completas** - Serviço completo de mudança
2. **Movimentação de Móveis** - Mover móveis dentro/fora de casa
3. **Desinstalação** - Desmontar e remover móveis/equipamentos
4. **Transporte** - Transporte de itens específicos

### 7. Fluxo de Conversão
1. **Busca/Seleção** → Usuário seleciona tipo de serviço
2. **Detalhes** → Preenche informações (endereço, data, descrição)
3. **Orçamento** → Simulador calcula preço (40% margem)
4. **Confirmação** → Solicita nome, email, telefone
5. **Contato** → Admin entra em contato para confirmar

### 8. Funcionalidades Mantidas
- ✅ Painel de Colaboradores (/colaboradores/admin)
- ✅ Simulador de Orçamento (/simulador)
- ✅ Sincronização com Google Sheets
- ✅ Gestão de registros de horas
- ✅ Autenticação de usuários

### 9. Melhorias de UX
- Responsividade total (mobile-first)
- Navegação intuitiva
- CTAs claros e destacados
- Social proof (avaliações, depoimentos)
- Busca inteligente
- Formulários simples e rápidos

## Fases de Implementação
1. ✅ Análise do Yoojo
2. ⏳ Planejar arquitetura (ATUAL)
3. ⏳ Redesenhar homepage
4. ⏳ Criar componentes de serviços
5. ⏳ Integrar funcionalidades existentes
6. ⏳ Modernizar logo
7. ⏳ Testar responsividade
8. ⏳ Otimizar para conversão
