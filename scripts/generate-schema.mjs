#!/usr/bin/env node

/**
 * Script para gerar schema.org JSON-LD
 * Melhora indexação e rich snippets no Google
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

// Schema.org LocalBusiness
const localBusinessSchema = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "CLYON",
  "image": "https://clyon.pt/logo-clyon-icon.png",
  "description": "Serviço profissional de recolha de móveis, entulho, monos e limpeza pós-obra em Lisboa e Setúbal",
  "url": "https://clyon.pt",
  "telephone": "+351965785395",
  "email": "info@clyon.pt",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Rua da Recolha, 123",
    "addressLocality": "Lisboa",
    "addressRegion": "Lisboa",
    "postalCode": "1000-000",
    "addressCountry": "PT"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": "38.7223",
    "longitude": "-9.1393"
  },
  "areaServed": [
    {
      "@type": "City",
      "name": "Lisboa"
    },
    {
      "@type": "City",
      "name": "Setúbal"
    },
    {
      "@type": "City",
      "name": "Almada"
    },
    {
      "@type": "City",
      "name": "Cascais"
    }
  ],
  "priceRange": "€€",
  "openingHoursSpecification": {
    "@type": "OpeningHoursSpecification",
    "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    "opens": "08:00",
    "closes": "18:00"
  },
  "sameAs": [
    "https://www.facebook.com/clyon"
  ]
};

// Schema.org Organization
const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "CLYON",
  "url": "https://clyon.pt",
  "logo": "https://clyon.pt/logo-clyon-icon.png",
  "description": "Empresa de recolha profissional e limpeza",
  "sameAs": [
    "https://www.facebook.com/clyon"
  ],
  "contactPoint": {
    "@type": "ContactPoint",
    "contactType": "Customer Service",
    "telephone": "+351965785395",
    "email": "info@clyon.pt"
  }
};

// Schema.org AggregateRating
const ratingSchema = {
  "@context": "https://schema.org",
  "@type": "AggregateRating",
  "ratingValue": "5.0",
  "ratingCount": "150",
  "bestRating": "5",
  "worstRating": "1"
};

// Gerar arquivo de schemas
const schemaContent = `// Generated schema.org JSON-LD schemas for CLYON

export const localBusinessSchema = ${JSON.stringify(localBusinessSchema, null, 2)};

export const organizationSchema = ${JSON.stringify(organizationSchema, null, 2)};

export const ratingSchema = ${JSON.stringify(ratingSchema, null, 2)};

export const serviceSchema = (serviceName, description) => ({
  "@context": "https://schema.org",
  "@type": "Service",
  "name": serviceName,
  "description": description,
  "provider": {
    "@type": "Organization",
    "name": "CLYON",
    "url": "https://clyon.pt"
  },
  "areaServed": {
    "@type": "Country",
    "name": "PT"
  },
  "priceRange": "€€"
});

export const breadcrumbSchema = (items) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": items.map((item, index) => ({
    "@type": "ListItem",
    "position": index + 1,
    "name": item.name,
    "item": item.url
  }))
});

export const faqSchema = (faqs) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": faqs.map(faq => ({
    "@type": "Question",
    "name": faq.question,
    "acceptedAnswer": {
      "@type": "Answer",
      "text": faq.answer
    }
  }))
});
`;

const schemaPath = path.resolve(projectRoot, 'client/src/lib/schemas.ts');
fs.writeFileSync(schemaPath, schemaContent);

console.log(`✅ Schema.org JSON-LD gerado com sucesso!`);
console.log(`📁 Salvo em: ${schemaPath}`);
console.log(`\n📊 Schemas disponíveis:`);
console.log(`  - localBusinessSchema`);
console.log(`  - organizationSchema`);
console.log(`  - ratingSchema`);
console.log(`  - serviceSchema()`);
console.log(`  - breadcrumbSchema()`);
console.log(`  - faqSchema()`);
