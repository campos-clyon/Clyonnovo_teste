import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "../../componentes/Texto";
import { Botao, Caixa, CampoDeTexto, Mensagem, TituloDaCaixa } from "../../componentes/ui";
import { useConta } from "../../estado/Conta";
import { ErroDaApi, errosPorCampo, pedir } from "../../lib/api";
import { faltasEm, servicosParaEscolher, type Perfil } from "../../lib/conta";
import { horaCurta } from "../../lib/trabalhos";
import { SERVICE_CATEGORIES } from "../../../../src/lib/service-categories";
import {
  custosFixosPorTrabalhoDe,
  RUBRICAS_DOS_CUSTOS_FIXOS,
  totalDosCustosFixosAnuais,
} from "../../../../src/lib/custos-fixos-do-profissional";
import { ESPACO, LETRA, RAIO, useCores } from "../../tema";

/**
 * SERVIÇOS E RAIO — o ecrã «servicos» do painel: o que faz, até onde vai (só
 * um raio à volta da base, decisão do dono a 18-10-2026) e, se quiser, os
 * custos dele, que entram na sugestão de valor de cada pedido. Vazio, entra a
 * referência da CLYON.
 */

const RAIOS = [25, 50, 100, 150, 200, 300, 500];
const fmt = (v: number | null | undefined) => (v == null ? "" : String(v).replace(".", ","));
const ler = (t: string): number | null => {
  const limpo = t.trim().replace(",", ".");
  if (limpo === "") return null;
  const n = Number(limpo);
  return Number.isFinite(n) ? n : NaN;
};

export default function EcraDosServicos() {
  const c = useCores();
  const margens = useSafeAreaInsets();
  const { perfil, recarregarPerfil } = useConta();
  if (!perfil) {
    return (
      <View style={[estilos.vazio, { backgroundColor: c.fundo }]}>
        <Text style={{ color: c.suave }}>A carregar…</Text>
      </View>
    );
  }
  return (
    <ScrollView automaticallyAdjustKeyboardInsets
      style={{ backgroundColor: c.fundo }}
      contentContainerStyle={[estilos.pagina, { paddingBottom: margens.bottom + ESPACO.xxl }]}
      keyboardShouldPersistTaps="handled"
    >
      <Formulario perfil={perfil} aoGravar={recarregarPerfil} />
    </ScrollView>
  );
}

function Formulario({ perfil, aoGravar }: { perfil: Perfil; aoGravar: () => Promise<void> }) {
  const c = useCores();
  const [categorias, setCategorias] = useState<string[]>(perfil.categorias);
  // Só os da inscrição (sem montagem nem jardinagem, sem «Outro serviço»), mais
  // os que ele já tinha de antes, para os poder tirar — 27-10-2026.
  const [escolhas] = useState(() => servicosParaEscolher(SERVICE_CATEGORIES, perfil.categorias));
  const [raio, setRaio] = useState(String(perfil.raioKm));
  const [custos, setCustos] = useState({
    custoKm: fmt(perfil.custoKm),
    custoHoraPessoa: fmt(perfil.custoHoraPessoa),
    pessoasNaEquipa: fmt(perfil.pessoasNaEquipa),
    horasPorTrabalho: fmt(perfil.horasPorTrabalho),
    trabalhosPorMes: fmt(perfil.trabalhosPorMes),
    margemPercent: fmt(perfil.margemPercent),
    riscoPercent: fmt(perfil.riscoPercent),
  });
  const [fixos, setFixos] = useState<Record<string, string>>(
    Object.fromEntries(RUBRICAS_DOS_CUSTOS_FIXOS.map(({ chave }) => [chave, fmt(perfil.custosFixosAnuais?.[chave] ?? null)])),
  );
  const [erros, setErros] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [gravadoAs, setGravadoAs] = useState<string | null>(null);
  const [aGravar, setAGravar] = useState(false);
  const faltas = faltasEm(perfil, "servicos");

  const raioKm = Math.round(Number(raio.replace(",", ".")));
  const fixosLidos = Object.fromEntries(Object.entries(fixos).map(([k, v]) => [k, ler(v)]));
  const anual = totalDosCustosFixosAnuais(fixosLidos);
  const porMes = ler(custos.trabalhosPorMes);
  const porTrabalho = custosFixosPorTrabalhoDe(anual, porMes);

  const alternar = (id: string) =>
    setCategorias((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
  const mudar = (k: keyof typeof custos) => (t: string) => setCustos((s) => ({ ...s, [k]: t }));

  async function gravar() {
    setAGravar(true);
    setErros({});
    setErro(null);
    setGravadoAs(null);
    try {
      await pedir("/api/profissionais/perfil", {
        metodo: "PUT",
        corpo: {
          categorias,
          raioKm,
          custoKm: ler(custos.custoKm),
          custoHoraPessoa: ler(custos.custoHoraPessoa),
          pessoasNaEquipa: ler(custos.pessoasNaEquipa),
          horasPorTrabalho: ler(custos.horasPorTrabalho),
          trabalhosPorMes: ler(custos.trabalhosPorMes),
          margemPercent: ler(custos.margemPercent),
          riscoPercent: ler(custos.riscoPercent),
          custosFixosAnuais: fixosLidos,
        },
      });
      setGravadoAs(horaCurta(new Date().toISOString()));
      await aoGravar();
    } catch (e) {
      const porCampo = errosPorCampo(e);
      setErros(porCampo);
      if (Object.keys(porCampo).length === 0) setErro(e instanceof ErroDaApi ? e.message : "Não foi possível guardar.");
      else setErro("Há campos por corrigir — veja a vermelho.");
    } finally {
      setAGravar(false);
    }
  }

  return (
    <>
      {faltas.length > 0 ? (
        <Mensagem tom="aviso" texto={`${faltas.length === 1 ? "Falta um campo" : `Faltam ${faltas.length} campos`} aqui: ${faltas.map((f) => f.rotulo.toLowerCase()).join(", ")}.`} />
      ) : null}

      <Caixa>
        <TituloDaCaixa>O que faz</TituloDaCaixa>
        <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1, lineHeight: 19 }}>Recebe pedidos só dos serviços que escolher.</Text>
        {escolhas.map((s) => {
          const activo = categorias.includes(s.id);
          return (
            <Pressable
              key={s.id}
              onPress={() => alternar(s.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: activo }}
              style={({ pressed }) => [estilos.opcao, { borderColor: activo ? c.marca : c.linha, opacity: pressed ? 0.7 : 1 }]}
            >
              <Ionicons name={activo ? "checkbox" : "square-outline"} size={22} color={activo ? c.marca : c.suave} />
              <Text style={{ flex: 1, color: c.tinta }}>{s.label}</Text>
            </Pressable>
          );
        })}
        {erros.categorias ? <Text style={{ color: c.mau }}>{erros.categorias}</Text> : null}
      </Caixa>

      <Caixa>
        <TituloDaCaixa>Raio de acção</TituloDaCaixa>
        <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1, lineHeight: 19 }}>
          Recebe os pedidos até esta distância da sua base, por estrada.
        </Text>
        <View style={estilos.raio}>
          <Pressable
            onPress={() => setRaio(String(Math.max(1, (raioKm || 0) - 10)))}
            accessibilityRole="button"
            accessibilityLabel="Menos 10 km"
            style={[estilos.passo, { borderColor: c.linha }]}
          >
            <Ionicons name="remove" size={22} color={c.marca} />
          </Pressable>
          <Text style={[estilos.km, { color: c.tinta }]}>{Number.isFinite(raioKm) ? raioKm : "—"} km</Text>
          <Pressable
            onPress={() => setRaio(String(Math.min(500, (raioKm || 0) + 10)))}
            accessibilityRole="button"
            accessibilityLabel="Mais 10 km"
            style={[estilos.passo, { borderColor: c.linha }]}
          >
            <Ionicons name="add" size={22} color={c.marca} />
          </Pressable>
        </View>
        <View style={estilos.pastilhas}>
          {RAIOS.map((r) => (
            <Pressable
              key={r}
              onPress={() => setRaio(String(r))}
              accessibilityRole="button"
              style={[estilos.pastilha, { borderColor: r === raioKm ? c.marca : c.linha, backgroundColor: r === raioKm ? c.marca : "transparent" }]}
            >
              <Text style={{ color: r === raioKm ? c.sobreMarca : c.tinta, fontWeight: "700", fontSize: LETRA.pequena + 1 }}>{r} km</Text>
            </Pressable>
          ))}
        </View>
        {erros.raioKm ? <Text style={{ color: c.mau }}>{erros.raioKm}</Text> : null}
      </Caixa>

      <Caixa>
        <TituloDaCaixa>Os meus custos</TituloDaCaixa>
        <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1, lineHeight: 19 }}>
          Entram na sugestão de valor de cada pedido. Pode deixar vazio: aí entra a referência da CLYON — que é o custo de um profissional
          médio, e não o seu.
        </Text>
        <CampoDeTexto rotulo="Custo por km (€)" value={custos.custoKm} onChangeText={mudar("custoKm")} keyboardType="decimal-pad" placeholder="0,50" erro={erros.custoKm} />
        <CampoDeTexto
          rotulo="Custo por hora e pessoa (€)"
          value={custos.custoHoraPessoa}
          onChangeText={mudar("custoHoraPessoa")}
          keyboardType="decimal-pad"
          placeholder="9"
          erro={erros.custoHoraPessoa}
        />
        <CampoDeTexto
          rotulo="Pessoas na equipa"
          value={custos.pessoasNaEquipa}
          onChangeText={mudar("pessoasNaEquipa")}
          keyboardType="number-pad"
          placeholder="3"
          erro={erros.pessoasNaEquipa}
        />
        <CampoDeTexto
          rotulo="Tempo médio por trabalho (horas)"
          value={custos.horasPorTrabalho}
          onChangeText={mudar("horasPorTrabalho")}
          keyboardType="decimal-pad"
          placeholder="ex.: 2,5"
          dica="Deslocação e recolha incluídas. Com isto preenchido, a conta usa o seu tempo em vez de o estimar a partir do pedido."
          erro={erros.horasPorTrabalho}
        />
      </Caixa>

      <Caixa>
        <TituloDaCaixa>Custos fixos, por ano</TituloDaCaixa>
        <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1, lineHeight: 19 }}>
          O que paga tenha ou não trabalho. O site divide pelos trabalhos que faz num ano e põe a parte de cada trabalho na conta.
        </Text>
        {RUBRICAS_DOS_CUSTOS_FIXOS.map(({ chave, rotulo }) => (
          <CampoDeTexto
            key={chave}
            rotulo={`${rotulo} (€ por ano)`}
            value={fixos[chave] ?? ""}
            onChangeText={(t) => setFixos((f) => ({ ...f, [chave]: t }))}
            keyboardType="decimal-pad"
            placeholder="0"
          />
        ))}
        <CampoDeTexto
          rotulo="Trabalhos por mês"
          value={custos.trabalhosPorMes}
          onChangeText={mudar("trabalhosPorMes")}
          keyboardType="number-pad"
          placeholder="20"
          erro={erros.trabalhosPorMes}
        />
        {anual != null && anual > 0 ? (
          <Text style={{ color: c.tinta, fontSize: LETRA.pequena + 1 }}>
            {anual.toFixed(2).replace(".", ",")} € por ano
            {porTrabalho != null && porMes
              ? ` ÷ ${porMes * 12} trabalhos = ${porTrabalho.toFixed(2).replace(".", ",")} € por trabalho`
              : " — indique os trabalhos por mês para o site dividir"}
          </Text>
        ) : null}
        {erros.custosFixosAnuais ? <Text style={{ color: c.mau }}>{erros.custosFixosAnuais}</Text> : null}
      </Caixa>

      <Caixa>
        <TituloDaCaixa>A margem e o risco</TituloDaCaixa>
        <CampoDeTexto
          rotulo="Margem de lucro desejada (%)"
          value={custos.margemPercent}
          onChangeText={mudar("margemPercent")}
          keyboardType="number-pad"
          placeholder="40"
          dica="Sobre o custo mínimo de cada trabalho. A sugestão de valor propõe custo mais esta margem. Vazio, entram os 40 % da referência."
          erro={erros.margemPercent}
        />
        <CampoDeTexto
          rotulo="Seguro de risco (%)"
          value={custos.riscoPercent}
          onChangeText={mudar("riscoPercent")}
          keyboardType="number-pad"
          placeholder="0"
          dica="De 0 a 25 %. Uma reserva para partidos, cancelamentos e viagens em vão: entra no custo mínimo, antes da margem."
          erro={erros.riscoPercent}
        />
      </Caixa>

      {erro ? <Mensagem texto={erro} /> : null}
      {gravadoAs ? <Mensagem tom="bom" texto={`Guardado às ${gravadoAs}.`} /> : null}
      <Botao titulo="Guardar" ocupado={aGravar} aoCarregar={() => void gravar()} />
    </>
  );
}

const estilos = StyleSheet.create({
  vazio: { flex: 1, alignItems: "center", justifyContent: "center" },
  pagina: { padding: ESPACO.l, gap: ESPACO.l },
  opcao: { flexDirection: "row", alignItems: "center", gap: ESPACO.s, borderWidth: 1, borderRadius: RAIO.m, padding: ESPACO.m },
  raio: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  passo: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  km: { fontSize: 28, fontWeight: "800", fontVariant: ["tabular-nums"] },
  pastilhas: { flexDirection: "row", flexWrap: "wrap", gap: ESPACO.xs },
  pastilha: { borderWidth: 1, borderRadius: 999, paddingHorizontal: ESPACO.m, paddingVertical: 7 },
});
