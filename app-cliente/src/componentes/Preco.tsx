import { View } from "react-native";
import { Text } from "./Texto";
import type { TextosDoPreco } from "../lib/pedidos";
import { ROTULO_DO_SERVICO, ROTULO_DO_TOTAL, type PrecoEmTresLinhas } from "../../../src/lib/preco-em-tres-linhas";
import { CORES } from "../tema";

/**
 * UM PREÇO, TAL COMO A API O ESCREVE (regras 1–3).
 *
 * Com `conta` (02-11-2026), as três linhas: Serviço / IVA / Total. Sem ela
 * (por hora, o modelo antigo, um site antigo): grande, o que se paga
 * (`principal`); pequeno, de que é feito (`detalhe` — o sem imposto nunca
 * sozinho). Por baixo, sempre, a nota da unidade. A app não faz contas.
 */
export function Preco({ preco, tamanho = "grande" }: { preco: TextosDoPreco; tamanho?: "grande" | "medio" }) {
  if (preco.conta) {
    return (
      <View style={{ gap: 6 }}>
        <PrecoEmLinhas conta={preco.conta} />
        {preco.nota ? <Text style={{ color: CORES.suave, fontSize: 13, lineHeight: 18 }}>{preco.nota}</Text> : null}
      </View>
    );
  }
  return (
    <View style={{ gap: 2 }}>
      <Text style={{ color: CORES.tinta, fontSize: tamanho === "grande" ? 24 : 18, fontWeight: "800" }}>{preco.principal}</Text>
      {preco.detalhe ? <Text style={{ color: CORES.suave, fontSize: 13, lineHeight: 18 }}>{preco.detalhe}</Text> : null}
      {preco.nota ? <Text style={{ color: CORES.suave, fontSize: 13, lineHeight: 18 }}>{preco.nota}</Text> : null}
    </View>
  );
}

function Linha({ rotulo, valor, forte = false }: { rotulo: string; valor: string; forte?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
      <Text titulo={forte} style={{ color: forte ? CORES.tinta : CORES.suave, fontSize: forte ? 16 : 15, fontWeight: forte ? "700" : "400" }}>
        {rotulo}
      </Text>
      <Text titulo={forte} style={{ color: CORES.tinta, fontSize: forte ? 18 : 15, fontWeight: forte ? "800" : "500" }}>
        {valor}
      </Text>
    </View>
  );
}

/** «Serviço X € / IVA (23 %) Y € / ── / Total a pagar Z €» — as três linhas que a API escreveu. */
export function PrecoEmLinhas({ conta, rotuloDoTotal = ROTULO_DO_TOTAL }: { conta: PrecoEmTresLinhas; rotuloDoTotal?: string }) {
  return (
    <View style={{ gap: 8 }}>
      <Linha rotulo={ROTULO_DO_SERVICO} valor={conta.servico} />
      <Linha rotulo={conta.ivaRotulo} valor={conta.iva} />
      <View style={{ height: 1, backgroundColor: CORES.linha }} />
      <Linha rotulo={rotuloDoTotal} valor={conta.total} forte />
    </View>
  );
}
