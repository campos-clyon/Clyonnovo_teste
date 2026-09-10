import { ImageResponse } from "next/og";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const runtime = "nodejs";
// A imagem não muda entre pedidos: gera-se uma vez e fica em cache.
export const revalidate = false;

/**
 * A IMAGEM QUE FALTAVA A TODAS AS PARTILHAS.
 *
 * O `layout.tsx` apontava para `/og-image.jpg` em três sítios — OpenGraph,
 * Twitter e o `image` do schema — e o ficheiro nunca existiu em `/public`.
 * Cada link da CLYON colado no WhatsApp ou no Facebook saía sem imagem
 * nenhuma, que é a diferença entre um cartão que se vê e uma linha de texto
 * que se ignora.
 *
 * Gera-se aqui em vez de se versionar um binário: o plano pedia sharp, mas
 * sharp precisa de Node instalado para correr uma vez e commitar o ficheiro,
 * e a máquina do dono não o tem. O gerador do próprio Next faz o mesmo
 * trabalho na build, sem dependência nova e sem 200 KB no repositório — e
 * quando o texto mudar, muda aqui, não num Photoshop.
 *
 * Sai PNG, e por isso o endereço é `.png` e não `.jpg`: servir PNG num URL
 * que diz jpg funciona, porque os leitores olham para o cabeçalho e não para
 * a extensão, mas é o tipo de pequena mentira que confunde quem vier a
 * seguir.
 */

const LARGURA = 1200;
const ALTURA = 630;

export function GET() {
  const logo = readFileSync(join(process.cwd(), "public", "logo-clyon.png"));
  const logoDataUri = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#00B4CC",
          fontFamily: "sans-serif",
          padding: "72px",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoDataUri} alt="CLYON" width={320} height={107} style={{ objectFit: "contain" }} />
        <div
          style={{
            display: "flex",
            marginTop: "44px",
            fontSize: "52px",
            lineHeight: 1.25,
            fontWeight: 700,
            color: "#FFFFFF",
            textAlign: "center",
            maxWidth: "1000px",
          }}
        >
          Recolha de móveis, entulho e esvaziamentos
        </div>
        <div
          style={{
            display: "flex",
            marginTop: "20px",
            fontSize: "36px",
            fontWeight: 500,
            color: "#E6FBFF",
          }}
        >
          Lisboa e Setúbal
        </div>
      </div>
    ),
    {
      width: LARGURA,
      height: ALTURA,
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    },
  );
}
