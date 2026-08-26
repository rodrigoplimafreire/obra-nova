/**
 * A espera do cliente final.
 *
 * Aqui o esqueleto não usa os tokens do painel: a página é escura, na marca da
 * empreiteira, e barras claras piscando sobre o ink seriam um susto. Fundo e
 * barras vêm do próprio `brand.css` da marca — mas ele ainda não carregou
 * neste momento, então os valores entram embutidos.
 *
 * É a única tela do produto que abre em rua, no celular do cliente, muitas
 * vezes com sinal ruim. Tela branca por dois segundos aqui parece link
 * quebrado.
 */
export default function Carregando() {
  const barra = (largura: string, altura: number) => (
    <span
      aria-hidden
      style={{
        display: "block",
        width: largura,
        height: altura,
        borderRadius: 3,
        background: "#1c1c1c",
      }}
    />
  );

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        minHeight: "100dvh",
        background: "#0a0a0a",
        color: "#cfcfcf",
        padding: "clamp(20px, 5vw, 64px)",
      }}
    >
      <span
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          overflow: "hidden",
          clip: "rect(0 0 0 0)",
        }}
      >
        Carregando o orçamento…
      </span>

      <div
        style={{
          maxWidth: 1120,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        {barra("160px", 11)}
        {barra("min(28rem, 85%)", 38)}
        {barra("min(20rem, 65%)", 14)}
        <div style={{ height: 24 }} />
        {barra("100%", 220)}
      </div>
    </div>
  );
}
