import { useState } from "react";
import { Aviso, Botao, Campo, Ecra, Paragrafo, Titulo } from "../componentes/ui";
import { mensagemDe, pedir } from "../lib/api";
import { corpoDaEmpresa, ROTA_DA_EMPRESA } from "../lib/novo-pedido";

/**
 * «É UMA EMPRESA? PEÇA AQUI» (E3 v3) — o mesmo cartão do simulador do site,
 * pela mesma rota (`POST /api/pedido-de-empresa`): a empresa, o email, o
 * telefone e o que precisa. Não pede conta.
 */
export default function PedidoDeEmpresa() {
  const [empresa, setEmpresa] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [feito, setFeito] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar() {
    if (empresa.trim().length < 2) return setErro("Escreva o nome da empresa.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setErro("Escreva o email.");
    if (mensagem.trim().length < 10) return setErro("Diga o que precisa (pelo menos 10 letras).");
    setErro(null);
    setEnviando(true);
    try {
      await pedir(ROTA_DA_EMPRESA, { metodo: "POST", corpo: corpoDaEmpresa({ empresa, email, telefone, mensagem }), semSessao: true });
      setFeito(true);
    } catch (e) {
      setErro(mensagemDe(e, "Não foi possível enviar agora. Tente outra vez."));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Ecra>
      <Titulo>É uma empresa?</Titulo>
      <Paragrafo suave>Condomínios, imobiliárias, alojamento local ou obras com vários pedidos: diga o que precisa e a CLYON responde por email.</Paragrafo>
      {feito ? (
        <Aviso tom="bom" texto="Pedido enviado. A CLYON responde por email." />
      ) : (
        <>
          <Campo rotulo="Empresa" valor={empresa} aoMudar={setEmpresa} maxLength={120} />
          <Campo rotulo="Email" valor={email} aoMudar={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" maxLength={180} />
          <Campo rotulo="Telefone (opcional)" valor={telefone} aoMudar={setTelefone} keyboardType="phone-pad" maxLength={20} />
          <Campo rotulo="O que precisa" valor={mensagem} aoMudar={setMensagem} multiline maxLength={4000} style={{ minHeight: 110, textAlignVertical: "top" }} />
          {erro ? <Aviso texto={erro} tom="mau" /> : null}
          <Botao titulo="Enviar" ocupado={enviando} aoCarregar={() => void enviar()} />
        </>
      )}
    </Ecra>
  );
}
