import fs from "fs";
import path from "path";

const regions = [
  { name: "Cascais", slug: "cascais" },
  { name: "Lisboa", slug: "lisboa" },
  { name: "Setúbal", slug: "setubal" },
  { name: "Almada", slug: "almada" },
  { name: "Sintra", slug: "sintra" },
  { name: "Montijo", slug: "montijo" },
  { name: "Seixal", slug: "seixal" },
  { name: "Barreiro", slug: "barreiro" },
  { name: "Sesimbra", slug: "sesimbra" },
  { name: "Loures", slug: "loures" },
  { name: "Oeiras", slug: "oeiras" },
  { name: "Olivais", slug: "olivais" },
  { name: "Alcochete", slug: "alcochete" },
  { name: "Odivelas", slug: "odivelas" },
  { name: "Moita", slug: "moita" },
  { name: "Amora", slug: "amora" },
  { name: "Palmela", slug: "palmela" },
  { name: "Estoril", slug: "estoril" },
  { name: "Amadora", slug: "amadora" },
  { name: "Sacavém", slug: "sacavem" },
  { name: "Parque das Nações", slug: "parque-das-nacoes" },
  { name: "Campo Grande", slug: "campo-grande" },
  { name: "Telheiras", slug: "telheiras" },
  { name: "Rio de Mouro", slug: "rio-de-mouro" },
  { name: "Campo Pequeno", slug: "campo-pequeno" },
  { name: "Chiado", slug: "chiado" },
  { name: "Agualva-Cacém", slug: "agualva-cacem" },
  { name: "Carnaxide", slug: "carnaxide" },
  { name: "Quinta do Conde", slug: "quinta-do-conde" },
  { name: "Costa da Caparica", slug: "costa-da-caparica" },
  { name: "Monte da Caparica", slug: "monte-da-caparica" },
  { name: "Trafaria", slug: "trafaria" },
  { name: "Laranjeiro", slug: "laranjeiro" },
  { name: "Corroios", slug: "corroios" },
];

const pagesDir = "client/src/pages";

regions.forEach((region) => {
  const componentName = `Recolha${region.name.replace(/\s+/g, "").replace(/[àáâãäåèéêëìíîïòóôõöùúûü]/gi, (c) => ({
    à: "a", á: "a", â: "a", ã: "a", ä: "a", å: "a",
    è: "e", é: "e", ê: "e", ë: "e",
    ì: "i", í: "i", î: "i", ï: "i",
    ò: "o", ó: "o", ô: "o", õ: "o", ö: "o",
    ù: "u", ú: "u", û: "u", ü: "u",
  }[c] || c))}Moveis`;

  const fileName = `${componentName}.tsx`;
  const filePath = path.join(pagesDir, fileName);

  const content = `import ServiceCityPage from "./ServiceCityPage";

export default function ${componentName}() {
  return (
    <ServiceCityPage
      service="Recolha de Móveis"
      city="${region.name}"
      description="Serviço especializado de recolha e remoção de móveis antigos, danificados ou indesejados em ${region.name}. Remoção segura de sofás, armários, camas, mesas, eletrodomésticos e todo o tipo de mobiliário. Transporte responsável até centro de reciclagem certificado com descarte legal. Resposta rápida, preços competitivos e 100% de satisfação garantida."
      whatIncludes={[
        "Avaliação gratuita do volume e tipo de móveis",
        "Mão de obra especializada para desmontagem (se necessário)",
        "Carregamento cuidadoso para evitar danos ao imóvel",
        "Transporte até centro de reciclagem ou doação",
        "Limpeza final do local após recolha",
        "Seguro de responsabilidade civil",
        "Atendimento em toda a região de ${region.name} e arredores",
        "Subida/descida de escadas incluída",
        "Doação de móveis em bom estado a IPSS locais",
      ]}
      whatNotIncluded={[
        "Móveis com infestação de pragas (cupins, percevejos)",
        "Resíduos perigosos (produtos químicos, tintas)",
        "Lixo orgânico ou doméstico comum",
        "Entulho de obras (serviço separado)",
        "Demolição de móveis fixos (armários embutidos)",
        "Desmontagem de móveis complexos sem aviso prévio",
      ]}
      howItWorks={[
        "Contacte-nos via WhatsApp (+351 965 785 395) ou telefone com fotos dos móveis",
        "Receba orçamento gratuito em até 11 minutos",
        "Agendamos a recolha para o dia e hora que preferir (incluindo sábados)",
        "Nossa equipa chega, desmonta (se necessário), carrega e transporta tudo",
        "Móveis em bom estado são doados a instituições locais; restante vai para reciclagem",
        "Pagamento apenas após conclusão do serviço",
      ]}
      pricing="O preço varia conforme o volume, peso e dificuldade de acesso. Em média: sofá 2-3 lugares (€35-55), armário grande (€45-75), cama de casal (€25-45), mesa + cadeiras (€35-55), frigorífico/máquina de lavar (€30-50). Recolha de conjunto completo de apartamento: €180-350. Preços em ${region.name} podem variar conforme a localização. Orçamento sempre gratuito e sem compromisso."
      timeline="Resposta ao orçamento em até 11 minutos. Recolha pode ser agendada para o mesmo dia (conforme disponibilidade) ou data de sua preferência, incluindo sábados. Atendemos ${region.name} e arredores. Serviço completo dura entre 30 minutos a 2 horas, dependendo da quantidade e localização dos móveis."
      legal="Móveis em condições de uso são doados a instituições de caridade parceiras em ${region.name} (IPSS, associações locais, Cáritas). Móveis danificados são transportados para centros de triagem certificados pela APA, onde madeira, metal e plástico são separados para reciclagem. Cumprimos o Decreto-Lei n.º 178/2006 sobre gestão de resíduos. Fornecemos guias de transporte quando solicitado."
      faqs={[
        {
          question: "Quanto custa recolher um sofá em ${region.name}?",
          answer: "Um sofá de 2-3 lugares custa entre €35-55. Sofás maiores ou de canto podem custar €60-90. O preço inclui carregamento, transporte e descarte legal. Preços em ${region.name} podem variar. Envie foto via WhatsApp para orçamento exato.",
        },
        {
          question: "Vocês atendem toda a região de ${region.name}?",
          answer: "Sim! Atendemos toda a região de ${region.name} e arredores. Informe a localização exata no orçamento para confirmar se sua zona está incluída.",
        },
        {
          question: "Recolhem móveis em prédios sem elevador?",
          answer: "Sim, subimos e descemos escadas. Informe o número de andares no orçamento para cálculo correto do preço (pode haver acréscimo para andares altos).",
        },
        {
          question: "Vocês desmontam os móveis?",
          answer: "Sim! Nossa equipa desmonta móveis quando necessário (camas, armários, estantes). Informe no orçamento se há móveis que precisam de desmontagem.",
        },
        {
          question: "Recolhem eletrodomésticos em ${region.name}?",
          answer: "Sim! Recolhemos frigoríficos, máquinas de lavar, fogões, micro-ondas, etc. Eletrodomésticos são encaminhados para reciclagem certificada de REEE (Resíduos de Equipamentos Elétricos e Eletrónicos).",
        },
        {
          question: "O que acontece com os móveis recolhidos?",
          answer: "Móveis em bom estado são doados a instituições sociais em ${region.name} (IPSS, Cáritas). Móveis danificados vão para centros de reciclagem certificados, onde madeira, metal e plástico são separados e reciclados.",
        },
      ]}
      testimonials={[
        {
          name: "Cliente em ${region.name}",
          text: "Serviço excelente! Recolheram móveis em ${region.name}. Rápidos, simpáticos e preço justo. Recomendo!",
          rating: 5,
        },
        {
          name: "Cliente satisfeito em ${region.name}",
          text: "Precisava recolher móveis em ${region.name}. Vieram no dia seguinte e fizeram tudo impecável. Muito satisfeito!",
          rating: 5,
        },
        {
          name: "Referência em ${region.name}",
          text: "Recolheram móveis antigos em ${region.name}. Equipa profissional, trabalho rápido e preço melhor que esperava!",
          rating: 5,
        },
      ]}
    />
  );
}
`;

  fs.writeFileSync(filePath, content);
  console.log(`✓ Criada página: ${fileName}`);
});

console.log(`\n✅ ${regions.length} páginas regionais criadas com sucesso!`);
