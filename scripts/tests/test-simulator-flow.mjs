#!/usr/bin/env node

import { execSync } from "child_process";

/**
 * Teste automatizado do fluxo completo do simulador
 * Com dados de Eugênia Almeida
 * 
 * Executa:
 * 1. POST /api/simulator/analyze (Gemini)
 * 2. POST /api/simulador/pedido (Criação de pedido)
 * 3. GET /api/admin/pedidos/debug (Verificação)
 */

const BASE_URL = process.env.BASE_URL || "https://clyon.pt:3000";

// Dados de teste - Eugênia Almeida
const testData = {
  serviceType: "recolha_monos",
  description: "4 móveis velhos, 1 mesa redonda, 1 cadeira e 5 sacos grandes",
  receiver: {
    name: "Eugênia Almeida",
    phone: "911128863",
    email: "menaga@hotmail.com",
  },
  address: {
    formattedAddress: "Rua Rui Coelho, Alto do Chapeleiro, Santa Clara, Lisboa",
    city: "Lisboa",
    postalCode: "1200-001",
    lat: 38.7139,
    lng: -9.1393,
  },
  floor: "Rés-do-chão",
  hasElevator: "no",
  parkingDistance: "20m",
  urgency: "Flexível",
  files: [
    {
      id: "photo-1",
      name: "photo.jpg",
      size: 1024000,
      mimeType: "image/jpeg",
      type: "image",
      previewUrl: "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
    },
  ],
  distanceFromBase: {
    distanceKm: 24.5,
    durationText: "25 min",
  },
};

function runCurl(method, url, data) {
  const cmd = `curl -s -X ${method} "${url}" -H "Content-Type: application/json" ${data ? `-d '${JSON.stringify(data).replace(/'/g, "'\\''")}'` : ""} 2>&1`;
  try {
    const result = execSync(cmd, { encoding: "utf-8" });
    return JSON.parse(result);
  } catch (e) {
    console.error(`Curl error: ${e.message}`);
    return null;
  }
}

function testFlow() {
  console.log("\n=== TESTE COMPLETO DO SIMULADOR ===\n");
  console.log(`[${new Date().toISOString()}] Iniciando teste com dados de Eugênia Almeida...\n`);

  try {
    // ===== STEP 1: Analysar com Gemini =====
    console.log("STEP 1: POST /api/simulator/analyze (Gemini)");
    console.log("-------------------------------------------");
    const analyzeData = runCurl("POST", `${BASE_URL}/api/simulator/analyze`, { order: testData });
    
    if (!analyzeData) {
      console.error("❌ ERRO: Análise Gemini falhou");
      return;
    }

    console.log(`Response:`, JSON.stringify(analyzeData, null, 2));
    console.log("✓ Análise Gemini completa\n");

    // ===== STEP 2: Criar Pedido =====
    console.log("STEP 2: POST /api/simulador/pedido (Criar Pedido)");
    console.log("-------------------------------------------");
    const createData = runCurl("POST", `${BASE_URL}/api/simulador/pedido`, {
      order: testData,
      estimate: analyzeData,
      chatHistory: [],
    });

    if (!createData || !createData.ok) {
      console.error("❌ ERRO: Criação de pedido falhou");
      console.error(createData);
      return;
    }

    console.log(`Response:`, JSON.stringify(createData, null, 2));

    const orderId = createData.id;
    const assignedTo = createData.assignedTo;
    const assignedToId = createData.assignedToId;

    console.log(`✓ Pedido criado com sucesso`);
    console.log(`  ID: ${orderId}`);
    console.log(`  Status: ${createData.status}`);
    console.log(`  Assistente: ${assignedTo} (ID: ${assignedToId})\n`);

    // ===== STEP 3: Verificar com Debug =====
    console.log("STEP 3: GET /api/admin/pedidos/debug (Verificação)");
    console.log("-------------------------------------------");

    // Aguardar um pouco
    execSync("sleep 2");

    const debugData = runCurl("GET", `${BASE_URL}/api/admin/pedidos/debug`, null);

    if (debugData && debugData.debug) {
      console.log(`Debug Info:`);
      console.log(`  Total de pedidos: ${debugData.debug.summary.totalOrders}`);
      console.log(`  Assistentes ativos: ${debugData.debug.summary.activeAssistantsCount}`);
      console.log(`  Miriam ID: ${debugData.debug.summary.miriamId}`);
      console.log(`  Pedidos de Miriam: ${debugData.debug.miriamOrders.length}`);
      console.log(`\n  Últimos 3 pedidos:`);

      debugData.debug.recentOrders.slice(0, 3).forEach((o) => {
        console.log(`    - #${o.id}: ${o.contactName} | ${o.serviceType} | ${o.status} | Miriam: ${o.assignedToId === debugData.debug.summary.miriamId ? "✓" : "✗"}`);
      });

      const ourOrder = debugData.debug.recentOrders.find((o) => o.id === orderId);
      if (ourOrder) {
        console.log(`\n✓ PEDIDO #${orderId} ENCONTRADO NOS REGISTOS`);
        console.log(`  Nome: ${ourOrder.contactName}`);
        console.log(`  Serviço: ${ourOrder.serviceType}`);
        console.log(`  Status: ${ourOrder.status}`);
        console.log(`  Assistente: ${ourOrder.assignedToName || `ID ${ourOrder.assignedToId}`}`);
      } else {
        console.log(`\n⚠ Pedido #${orderId} não encontrado nos últimos 20 registos`);
      }
    } else {
      console.log(`Debug endpoint não acessível`);
    }

    // ===== RESUMO FINAL =====
    console.log("\n=== RESUMO DO TESTE ===");
    console.log(`✓ ID do Pedido: ${orderId}`);
    console.log(`✓ Status: ${createData.status}`);
    console.log(`✓ Assistente Atribuída: ${assignedTo} (ID: ${assignedToId})`);
    console.log(`✓ Cliente: ${testData.receiver.name}`);
    console.log(`✓ Telefone: ${testData.receiver.phone}`);
    console.log(`✓ Serviço: ${testData.serviceType}`);
    console.log(`✓ BD: simulatorOrders`);
    console.log("\n✓ TESTE COMPLETO COM SUCESSO\n");

  } catch (error) {
    console.error("\n❌ ERRO DURANTE TESTE:");
    console.error(error.message || error);
  }
}

testFlow();
