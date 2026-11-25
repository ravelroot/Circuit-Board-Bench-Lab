const RENDERIZADOR_SOFTWARE = /swiftshader|llvmpipe|softpipe|software|basic render/i;

let leve: boolean | null = null;

const nomeDoRenderizador = (g: WebGLRenderingContext | WebGL2RenderingContext): string => {
  const info = g.getExtension('WEBGL_debug_renderer_info');
  return String(g.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : g.RENDERER) ?? '');
};

export const renderizacaoLeve = (): boolean => {
  if (leve !== null) return leve;
  leve = false;
  try {
    const c = document.createElement('canvas');
    const g = c.getContext('webgl2') ?? c.getContext('webgl');
    if (g) {
      leve = RENDERIZADOR_SOFTWARE.test(nomeDoRenderizador(g));
      g.getExtension('WEBGL_lose_context')?.loseContext();
    }
  } catch {
    leve = false;
  }
  return leve;
};

export const resolucaoDeTextura = (maximo: number): number => (renderizacaoLeve() ? Math.round(maximo / 2) : maximo);

export const densidadeDoPalco = (desejada: number): number => (renderizacaoLeve() ? 1 : desejada);
