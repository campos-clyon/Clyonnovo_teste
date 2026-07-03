import type { OrderData, ReceiverData, AddressData } from "./types";

/**
 * Remove valores vazios/null/undefined de um objeto
 */
export function removeEmptyValues(obj?: any): Record<string, any> {
  if (!obj) return {};
  return Object.fromEntries(
    Object.entries(obj).filter(([_, value]) => {
      return value !== undefined && value !== null && value !== "";
    })
  );
}

/**
 * Merge profundo seguro de orderPatch em orderData
 * Preserva campos existentes, só actualiza o que vem no patch
 */
export function mergeOrderPatch(current: OrderData, patch: Partial<OrderData>): OrderData {
  const cleanPatch = removeEmptyValues(patch);

  return {
    ...current,
    ...cleanPatch,
    receiver: {
      ...(current.receiver || {}),
      ...(removeEmptyValues(patch.receiver) as any),
    } as ReceiverData | undefined,
    address: {
      ...(current.address || {}),
      ...(removeEmptyValues(patch.address) as any),
    } as AddressData | undefined,
    // Preserve arrays se não estão no patch
    files: patch.files !== undefined ? patch.files : current.files,
    heavyItems: patch.heavyItems !== undefined ? patch.heavyItems : current.heavyItems,
  };
}

/**
 * Calcula quais campos ainda faltam para completar o orçamento
 */
export function getMissingFields(order: OrderData): Array<{
  field: string;
  label: string;
  required: boolean;
}> {
  const missing = [];

  if (!order.serviceType) {
    missing.push({ field: "serviceType", label: "Tipo de serviço", required: true });
  }

  if (!order.description && (!order.files || order.files.length === 0)) {
    missing.push({ field: "description", label: "Descrição do que recolher", required: true });
  }

  if (!order.floor) {
    missing.push({ field: "floor", label: "Andar", required: true });
  }

  if (!order.hasElevator || order.hasElevator === "unknown") {
    missing.push({ field: "hasElevator", label: "Elevador", required: true });
  }

  if (!order.parkingDistance || order.parkingDistance === "unknown") {
    missing.push({ field: "parkingDistance", label: "Estacionamento", required: true });
  }

  if (!order.urgency) {
    missing.push({ field: "urgency", label: "Urgência", required: true });
  }

  if (!order.receiver?.name || !order.receiver?.phone) {
    missing.push({ field: "receiver", label: "Dados de contacto", required: true });
  }

  // Morada não é 100% obrigatória mas recomendada
  if (!order.address?.city && !order.address?.formattedAddress) {
    missing.push({ field: "address", label: "Morada / Localidade", required: false });
  }

  return missing;
}

/**
 * Verifica se o pedido tem dados suficientes para gerar orçamento
 */
export function isOrderComplete(order: OrderData): boolean {
  const required = getMissingFields(order).filter((f) => f.required);
  return required.length === 0;
}

/**
 * Extrai informações para preencher formulário de contacto
 */
export function getReceiverForForm(order: OrderData): {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
} {
  return {
    name: order.receiver?.name,
    phone: order.receiver?.phone,
    email: order.receiver?.email,
    address: order.address?.formattedAddress || order.address?.city,
  };
}
