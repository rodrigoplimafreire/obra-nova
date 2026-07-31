/**
 * Detecção de navegador embutido em outro app (in-app browser).
 *
 * Por que isto existe: o link do canteiro chega por WhatsApp. No iPhone o
 * WhatsApp abre um WKWebView próprio, onde `getUserMedia` normalmente não é
 * concedido. No Android o WebView repassa o pedido de permissão ao app
 * hospedeiro via `onPermissionRequest` — e quando o app não implementa esse
 * callback a promise não rejeita: fica pendente para sempre.
 *
 * Por isso o aviso é proativo (mostrado antes de a pessoa tentar gravar) e não
 * apenas reativo ao erro.
 */

export type ContextoNavegador = {
  ua: string;
  isIos: boolean;
  isAndroid: boolean;
  /** Navegador embutido dentro de outro aplicativo. */
  isInAppBrowser: boolean;
  /** Nome do app hospedeiro quando identificável; null quando só sabemos que é embutido. */
  appHospedeiro: string | null;
  temMediaDevices: boolean;
  temMediaRecorder: boolean;
  origemSegura: boolean;
};

/** Apps que se identificam no user agent. O WhatsApp não está aqui: ele não deixa marcador. */
const MARCADORES: ReadonlyArray<readonly [RegExp, string]> = [
  [/FBAN|FBAV|FB_IAB|FBIOS/i, "Facebook"],
  [/Instagram/i, "Instagram"],
  [/\bLine\//i, "LINE"],
  [/MicroMessenger/i, "WeChat"],
  [/\bTwitter\b/i, "X"],
  [/LinkedInApp/i, "LinkedIn"],
  [/Snapchat/i, "Snapchat"],
];

/** Navegadores de verdade no iOS. São WebKit, mas pedem permissão de microfone normalmente. */
const NAVEGADORES_IOS_LEGITIMOS = /CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/i;

export function lerContexto(): ContextoNavegador {
  if (typeof navigator === "undefined") {
    return {
      ua: "",
      isIos: false,
      isAndroid: false,
      isInAppBrowser: false,
      appHospedeiro: null,
      temMediaDevices: false,
      temMediaRecorder: false,
      origemSegura: false,
    };
  }

  const ua = navigator.userAgent;
  const isIos =
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS 13+ se apresenta como Mac; o toque delata.
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(ua);

  let appHospedeiro: string | null = null;
  for (const [padrao, nome] of MARCADORES) {
    if (padrao.test(ua)) {
      appHospedeiro = nome;
      break;
    }
  }

  // WebView do Android carrega o token "wv" no user agent.
  const webViewAndroid = isAndroid && /;\s*wv\)/.test(ua);

  // WKWebView embutido no iOS omite o token "Safari/". Safari e os navegadores
  // legítimos (Chrome, Firefox, Edge no iPhone) o mantêm.
  const webViewIos =
    isIos && !NAVEGADORES_IOS_LEGITIMOS.test(ua) && !/Safari\//.test(ua);

  return {
    ua,
    isIos,
    isAndroid,
    isInAppBrowser: Boolean(appHospedeiro) || webViewAndroid || webViewIos,
    appHospedeiro,
    temMediaDevices: typeof navigator.mediaDevices?.getUserMedia === "function",
    temMediaRecorder: typeof window !== "undefined" && "MediaRecorder" in window,
    origemSegura: typeof window !== "undefined" && window.isSecureContext,
  };
}

/** Instrução de saída, dependente da plataforma. */
export function comoAbrirNoNavegador(ctx: ContextoNavegador): string {
  if (ctx.isIos) return "Toque nos três pontinhos e escolha “Abrir no Safari”.";
  if (ctx.isAndroid) return "Toque nos três pontinhos e escolha “Abrir no Chrome”.";
  return "Abra este link no navegador do celular, fora do aplicativo.";
}
