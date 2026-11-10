export type Idioma = 'pt' | 'en';

export interface Texto {
  readonly pt: string;
  readonly en: string;
}

export type Categoria = 'microcontrolador' | 'computador' | 'pc' | 'modulo' | 'circuito';

export type CorPlaca = 'verde' | 'azul' | 'preto' | 'vermelho' | 'roxo' | 'branco' | 'amarelo' | 'cinza' | 'marrom';

export type Forma =
  | 'chip'
  | 'metal'
  | 'conector'
  | 'botao'
  | 'led'
  | 'barra'
  | 'femea'
  | 'slot'
  | 'antena'
  | 'capacitor'
  | 'ceramico'
  | 'resistor'
  | 'cristal'
  | 'dissipador'
  | 'bateria'
  | 'borne'
  | 'trimpot'
  | 'indutor'
  | 'furos'
  | 'soquete'
  | 'ventoinha'
  | 'transformador'
  | 'lente'
  | 'tela'
  | 'diodo'
  | 'texto'
  | 'chave'
  | 'sensor'
  | 'pcb'
  | 'fita';

export interface Componente {
  readonly forma: Forma;
  readonly x: number;
  readonly y: number;
  readonly l: number;
  readonly a: number;
  readonly z: number;
  readonly parte?: string;
  readonly rotulo?: string;
  readonly cor?: string;
}

export interface Parte {
  readonly id: string;
  readonly nome: Texto;
  readonly oque: Texto;
  readonly funcao: Texto;
}

export interface Especificacao {
  readonly rotulo: Texto;
  readonly valor: Texto | string;
}

export interface Desenho {
  readonly largura: number;
  readonly altura: number;
  readonly cor: CorPlaca;
  readonly espessura?: number;
  readonly componentes: readonly Componente[];
}

export interface Tema {
  readonly id: string;
  readonly nome: Texto;
  readonly resumo: Texto;
}

export interface Placa {
  readonly id: string;
  readonly nome: string;
  readonly sigla: string;
  readonly fabricante: Texto | string;
  readonly categoria: Categoria;
  readonly resumo: Texto;
  readonly usos: Texto;
  readonly essenciais: Texto;
  readonly especificacoes: readonly Especificacao[];
  readonly desenho: Desenho;
  readonly partes: readonly Parte[];
  readonly temas: readonly Tema[];
}

export interface Peca {
  readonly id: string;
  readonly nome: Texto;
}

export type CorFio = 'vermelho' | 'preto' | 'amarelo' | 'verde' | 'azul' | 'laranja' | 'branco' | 'roxo' | 'cinza' | 'marrom';

export interface Ligacao {
  readonly de: string;
  readonly para: string;
  readonly cor: CorFio;
  readonly nota: Texto;
}

export interface Fiacao {
  readonly modulo: string;
  readonly ligacoes: readonly Ligacao[];
}

export interface Comando {
  readonly rotulo: Texto;
  readonly linha: string;
}

export interface Codigo {
  readonly arquivo: string;
  readonly texto: string;
}

export type ModoLed = 'aceso' | 'apagado' | 'pisca' | 'respira' | 'sos';

export interface EstadoLed {
  readonly cor: string;
  readonly modo: ModoLed;
}

export interface ComandoSerial {
  readonly nome: string;
  readonly resposta: readonly string[];
  readonly led?: EstadoLed;
}

export type CenarioPost = 'ok' | 'cpu' | 'dram' | 'vga' | 'boot';

export type Previa =
  | {
      readonly tipo: 'serial';
      readonly titulo?: string;
      readonly inicio: readonly string[];
      readonly comandos: readonly ComandoSerial[];
      readonly periodico?: { readonly ms: number; readonly linhas: readonly string[] };
      readonly led?: EstadoLed;
    }
  | { readonly tipo: 'wifi' }
  | { readonly tipo: 'radar' }
  | { readonly tipo: 'sintetizador' }
  | { readonly tipo: 'rfid' }
  | { readonly tipo: 'microfone' }
  | { readonly tipo: 'tela'; readonly modelo: 'st7789' | 'lcd1602'; readonly telas: readonly (readonly string[])[] }
  | { readonly tipo: 'pwm'; readonly tensao: number; readonly frequencia: number }
  | { readonly tipo: 'servo' }
  | { readonly tipo: 'distancia' }
  | { readonly tipo: 'pinagem' }
  | { readonly tipo: 'memoria' }
  | { readonly tipo: 'post'; readonly cenario: CenarioPost }
  | { readonly tipo: 'timer555' }
  | { readonly tipo: 'regulador' }
  | { readonly tipo: 'ponteh' };

export type TipoPrevia = Previa['tipo'];

export type IconeLab =
  | 'terminal'
  | 'led'
  | 'botao'
  | 'tela'
  | 'wifi'
  | 'cartao'
  | 'microfone'
  | 'bluetooth'
  | 'som'
  | 'motor'
  | 'regua'
  | 'termometro'
  | 'servo'
  | 'chip'
  | 'disco'
  | 'memoria'
  | 'raio'
  | 'onda'
  | 'pino'
  | 'chave';

export interface Laboratorio {
  readonly id: string;
  readonly placa: string;
  readonly tema: string;
  readonly numero: number;
  readonly icone: IconeLab;
  readonly titulo: Texto;
  readonly resumo: Texto;
  readonly pecas: readonly string[];
  readonly partes: readonly string[];
  readonly como: readonly Texto[];
  readonly fiacao: Fiacao | null;
  readonly comandos: readonly Comando[];
  readonly passos: readonly Texto[];
  readonly previa: Previa;
  readonly explicacaoPrevia: Texto;
  readonly codigo: Codigo | null;
}
