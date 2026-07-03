#!/usr/bin/env node

/**
 * Script para gerar sitemap.xml dinâmico
 * Inclui todas as 87 páginas pré-renderizadas
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const publicDir = path.resolve(projectRoot, 'client/public');

// Definir URLs de todas as páginas
const pages = [
  { url: '', priority: '1.0', changefreq: 'daily' },
  { url: 'servicos', priority: '0.9', changefreq: 'weekly' },
  { url: 'blog', priority: '0.8', changefreq: 'weekly' },
  { url: 'faq', priority: '0.8', changefreq: 'monthly' },
  { url: 'sobre-nos', priority: '0.7', changefreq: 'monthly' },
  { url: 'trabalhos', priority: '0.8', changefreq: 'weekly' },
  { url: 'avaliacoes', priority: '0.8', changefreq: 'weekly' },
];

// Adicionar páginas de localização
const cities = [
  'Lisboa', 'Setúbal', 'Almada', 'Caparica', 'Sesimbra', 'Sintra', 'Cascais', 'Oeiras',
  'Amadora', 'Odivelas', 'Loures', 'Mafra', 'Arruda dos Vinhos', 'Ericeira', 'Peniche',
  'Lourinhã', 'Sobral de Monte Agraço', 'Nazaré', 'Caldas da Rainha', 'Óbidos'
];

const services = [
  { slug: 'moveis', name: 'Móveis' },
  { slug: 'entulho', name: 'Entulho' },
  { slug: 'monos', name: 'Monos' },
  { slug: 'limpeza', name: 'Limpeza' },
];

cities.forEach(city => {
  services.forEach(service => {
    const url = `recolha-${service.slug.toLowerCase()}-${city.toLowerCase().replace(/\s+/g, '-')}`;
    pages.push({
      url,
      priority: '0.7',
      changefreq: 'monthly',
    });
  });
});

// Gerar XML do sitemap
const baseUrl = 'https://clyon.pt';
const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(page => `  <url>
    <loc>${baseUrl}/${page.url}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

// Salvar sitemap.xml
const sitemapPath = path.resolve(publicDir, 'sitemap.xml');
fs.writeFileSync(sitemapPath, sitemapXml);

console.log(`✅ Sitemap.xml gerado com sucesso!`);
console.log(`📄 Total de URLs: ${pages.length}`);
console.log(`📁 Salvo em: ${sitemapPath}`);
