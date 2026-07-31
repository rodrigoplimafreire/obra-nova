import { redirect } from "next/navigation";

/**
 * O painel tem um assunto só: obras. A raiz existe para que `/admin` continue
 * sendo um endereço válido — quem chega por ele cai na lista.
 */
export default function Painel() {
  redirect("/admin/obras");
}
