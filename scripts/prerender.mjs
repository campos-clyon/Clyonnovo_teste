#!/usr/bin/env node

/**
 * Script de Pré-rendering Estático para CLYON
 * Gera HTML pré-renderizado para todas as páginas com meta tags dinâmicas
 * Melhora SEO sem reescrever o projeto em Next.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const distDir = path.resolve(projectRoot, 'dist/public');
const prerenderedDir = path.resolve(projectRoot, 'prerendered');

// Criar diretório de pré-renderização
if (!fs.existsSync(prerenderedDir)) {
  fs.mkdirSync(prerenderedDir, { recursive: true });
}

// Definir metadados de todas as páginas
const pages = [
  {
    path: 'index.html',
    title: 'CLYON - Recolha de Móveis e Entulho em Lisboa e Setúbal',
    description: 'Recolha profissional de móveis, entulho, monos e limpeza pós-obra. Orçamento grátis em 11 minutos. Serviço disponível em Lisboa, Setúbal e arredores.',
    keywords: 'recolha móveis, recolha entulho, recolha monos, limpeza pós-obra, mudanças, Lisboa, Setúbal',
    canonical: 'https://clyon.pt/',
  },
  {
    path: 'servicos/index.html',
    title: 'Serviços CLYON - Recolha e Limpeza Profissional',
    description: 'Conheça todos os serviços CLYON: recolha de móveis, entulho, monos, limpeza pós-obra, mudanças e muito mais. Orçamentos grátis.',
    keywords: 'serviços recolha, recolha móveis, recolha entulho, limpeza pós-obra, mudanças, desmantelamento',
    canonical: 'https://clyon.pt/servicos',
  },
  {
    path: 'blog/index.html',
    title: 'Blog CLYON - Dicas de Recolha e Limpeza',
    description: 'Leia dicas e artigos sobre recolha de móveis, entulho, limpeza pós-obra e sustentabilidade. Conselhos de especialistas.',
    keywords: 'blog recolha, dicas limpeza, recolha sustentável, reciclagem, entulho',
    canonical: 'https://clyon.pt/blog',
  },
  {
    path: 'faq/index.html',
    title: 'Perguntas Frequentes - CLYON',
    description: 'Respostas às perguntas mais frequentes sobre os serviços CLYON. Como funciona, preços, horários e muito mais.',
    keywords: 'FAQ, perguntas frequentes, dúvidas, recolha, CLYON',
    canonical: 'https://clyon.pt/faq',
  },
  {
    path: 'sobre-nos/index.html',
    title: 'Sobre CLYON - Empresa de Recolha e Limpeza',
    description: 'Conheça a história, missão e valores da CLYON. Somos especialistas em recolha de móveis, entulho e limpeza há anos.',
    keywords: 'sobre CLYON, história, missão, empresa, recolha profissional',
    canonical: 'https://clyon.pt/sobre-nos',
  },
  {
    path: 'trabalhos/index.html',
    title: 'Trabalhos Realizados - CLYON',
    description: 'Veja fotos e depoimentos de trabalhos realizados pela CLYON. Recolhas de móveis, entulho e limpezas profissionais.',
    keywords: 'trabalhos, projetos, portfolio, recolha, antes e depois',
    canonical: 'https://clyon.pt/trabalhos',
  },
  {
    path: 'avaliacoes/index.html',
    title: 'Avaliações de Clientes - CLYON',
    description: 'Leia as avaliações e depoimentos de clientes satisfeitos com os serviços CLYON. Classificação 5 estrelas.',
    keywords: 'avaliações, reviews, depoimentos, clientes, classificação',
    canonical: 'https://clyon.pt/avaliacoes',
  },
];

// Adicionar páginas de localização (20 cidades × 4 serviços = 80 páginas)
const cities = [
  'Lisboa', 'Setúbal', 'Almada', 'Caparica', 'Sesimbra', 'Sintra', 'Cascais', 'Oeiras',
  'Amadora', 'Odivelas', 'Loures', 'Mafra', 'Arruda dos Vinhos', 'Ericeira', 'Peniche',
  'Lourinhã', 'Sobral de Monte Agraço', 'Nazaré', 'Caldas da Rainha', 'Óbidos'
];

const services = [
  { slug: 'moveis', name: 'Móveis', icon: '🛋️' },
  { slug: 'entulho', name: 'Entulho', icon: '🏗️' },
  { slug: 'monos', name: 'Monos', icon: '♻️' },
  { slug: 'limpeza', name: 'Limpeza Pós-Obra', icon: '🧹' },
];

// Gerar páginas de localização
cities.forEach(city => {
  services.forEach(service => {
    const slug = `recolha-${service.slug.toLowerCase()}-${city.toLowerCase().replace(/\s+/g, '-')}`;
    pages.push({
      path: `${slug}/index.html`,
      title: `Recolha de ${service.name} em ${city} | CLYON`,
      description: `Serviço profissional de recolha de ${service.name.toLowerCase()} em ${city}. Orçamento grátis em 11 minutos. Equipa qualificada e rápida.`,
      keywords: `recolha ${service.name.toLowerCase()} ${city}, ${service.name.toLowerCase()} ${city}, recolha ${city}`,
      canonical: `https://clyon.pt/${slug}`,
    });
  });
});

console.log(`📄 Total de páginas a pré-renderizar: ${pages.length}`);

// Função para gerar HTML com meta tags
function generateHTML(page) {
  const baseHTML = fs.readFileSync(path.resolve(distDir, 'index.html'), 'utf-8');
  
  // Substituir meta tags
  let html = baseHTML
    .replace(/<title>.*?<\/title>/, `<title>${page.title}</title>`)
    .replace(/<meta name="description" content=".*?"/, `<meta name="description" content="${page.description}"`)
    .replace(/<meta name="keywords" content=".*?"/, `<meta name="keywords" content="${page.keywords}"`)
    .replace(/<link rel="canonical" href=".*?"/, `<link rel="canonical" href="${page.canonical}"`);

  // Adicionar og:title, og:description se não existirem
  if (!html.includes('og:title')) {
    html = html.replace(
      '</head>',
      `<meta property="og:title" content="${page.title}">
<meta property="og:description" content="${page.description}">
<meta property="og:url" content="${page.canonical}">
</head>`
    );
  }

  return html;
}

// Gerar arquivos HTML pré-renderizados
pages.forEach(page => {
  const outputPath = path.resolve(prerenderedDir, page.path);
  const outputDir = path.dirname(outputPath);

  // Criar diretório se não existir
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Gerar HTML
  const html = generateHTML(page);
  fs.writeFileSync(outputPath, html);
  console.log(`✓ ${page.path}`);
});

console.log(`\n✅ Pré-renderização concluída!`);
console.log(`📁 Arquivos salvos em: ${prerenderedDir}`);
