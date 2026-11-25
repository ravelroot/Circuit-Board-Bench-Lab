export const quandoOcioso = (fn: () => void, limite = 1000): void => {
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(() => fn(), { timeout: limite });
  else window.setTimeout(fn, 16);
};

export const densidadeDaTela = (maximo: number): number => Math.min(maximo, Math.max(1, window.devicePixelRatio || 1));

const paraDataUrl = (blob: Blob): Promise<string | null> =>
  new Promise((resolver) => {
    const leitor = new FileReader();
    leitor.onload = () => resolver(typeof leitor.result === 'string' ? leitor.result : null);
    leitor.onerror = () => resolver(null);
    leitor.readAsDataURL(blob);
  });

export const capturarPng = (tela: HTMLCanvasElement): Promise<string | null> =>
  new Promise((resolver) => {
    try {
      tela.toBlob((blob) => resolver(blob ? paraDataUrl(blob) : null), 'image/png');
    } catch {
      resolver(null);
    }
  });
