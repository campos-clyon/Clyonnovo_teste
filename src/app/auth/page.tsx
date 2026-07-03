import { permanentRedirect } from "next/navigation";

export default function AuthLegacyPage() {
  permanentRedirect("/colaboradores");
}
