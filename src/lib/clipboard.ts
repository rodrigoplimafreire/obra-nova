/**
 * Copiar texto num navegador embutido.
 *
 * `navigator.clipboard` exige contexto seguro e às vezes não existe dentro do
 * WebView do WhatsApp — que é justamente onde a pessoa mais precisa copiar a URL.
 * Daí o fallback com textarea + execCommand.
 */
export async function copiarTexto(texto: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
  } catch {
    // cai para o fallback
  }

  try {
    const area = document.createElement("textarea");
    area.value = texto;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "0";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    area.setSelectionRange(0, texto.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}
