/**
 * Reduz a foto antes de enviar.
 *
 * Câmera de celular entrega de 3 a 8 MB. Para a foto de um serviço, 1600px do
 * lado maior é mais do que suficiente, economiza o pacote de dados de quem está
 * no canteiro e mantém o relatório leve para o cliente abrir no 4G.
 */
export async function reduzirImagem(
  arquivo: File,
  maiorLado = 1600,
  qualidade = 0.82,
): Promise<{ blob: Blob; mimeType: string; extensao: string }> {
  const original = { blob: arquivo as Blob, mimeType: arquivo.type, extensao: "jpg" };

  try {
    const bitmap = await createImageBitmap(arquivo);
    const escala = Math.min(1, maiorLado / Math.max(bitmap.width, bitmap.height));

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * escala);
    canvas.height = Math.round(bitmap.height * escala);

    const ctx = canvas.getContext("2d");
    if (!ctx) return original;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolver) =>
      canvas.toBlob(resolver, "image/jpeg", qualidade),
    );
    if (!blob) return original;

    return { blob, mimeType: "image/jpeg", extensao: "jpg" };
  } catch {
    // HEIC sem suporte de decode, por exemplo. Envia o original e deixa o
    // servidor recusar se for o caso — melhor que perder a foto em silêncio.
    return original;
  }
}
