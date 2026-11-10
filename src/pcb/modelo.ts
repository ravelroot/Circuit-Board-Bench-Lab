import type { Componente, Placa } from '../dados/tipos';

export type CamadaCobre = 'F.Cu' | 'B.Cu';

export type FormaPad = 'retangulo' | 'redondo' | 'oval' | 'arredondado';

export type Modelo =
  | 'qfn'
  | 'qfp'
  | 'soic'
  | 'sot'
  | 'dip'
  | 'bga'
  | 'blindagem'
  | 'caixa'
  | 'conector'
  | 'botao'
  | 'led-smd'
  | 'led-tht'
  | 'barra'
  | 'femea'
  | 'slot'
  | 'eletrolitico'
  | 'mlcc'
  | 'resistor-smd'
  | 'resistor-tht'
  | 'cristal'
  | 'dissipador'
  | 'bateria'
  | 'borne'
  | 'trimpot'
  | 'indutor'
  | 'soquete'
  | 'ventoinha'
  | 'transformador'
  | 'camera'
  | 'tela'
  | 'diodo-smd'
  | 'diodo-tht'
  | 'chave'
  | 'transdutor'
  | 'submodulo'
  | 'fpc'
  | 'cabo'
  | 'antena'
  | 'pads'
  | 'texto';

export interface Pad {
  readonly numero: string;
  readonly x: number;
  readonly y: number;
  readonly l: number;
  readonly a: number;
  readonly forma: FormaPad;
  readonly furo: number;
}

export interface MatrizPads {
  readonly x: number;
  readonly y: number;
  readonly l: number;
  readonly a: number;
  readonly passo: number;
}

export interface Retangulo {
  readonly x: number;
  readonly y: number;
  readonly l: number;
  readonly a: number;
}

export interface Segmento {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

export interface Footprint {
  readonly indice: number;
  readonly ref: string;
  readonly valor: string;
  readonly biblioteca: string;
  readonly modelo: Modelo;
  readonly comp: Componente;
  readonly parte: string | null;
  readonly corpo: Retangulo;
  readonly pads: readonly Pad[];
  readonly matrizes: readonly MatrizPads[];
  readonly silk: readonly Segmento[];
  readonly silkCirculos: readonly { readonly x: number; readonly y: number; readonly r: number }[];
  readonly patio: Retangulo;
  readonly refPos: { readonly x: number; readonly y: number };
  readonly tht: boolean;
}

export interface Trilha {
  readonly pontos: readonly (readonly [number, number])[];
  readonly largura: number;
  readonly camada: CamadaCobre;
}

export interface Via {
  readonly x: number;
  readonly y: number;
  readonly d: number;
  readonly furo: number;
}

export interface Furo {
  readonly x: number;
  readonly y: number;
  readonly d: number;
  readonly anel: number;
}

export interface TextoSerigrafia {
  readonly x: number;
  readonly y: number;
  readonly texto: string;
  readonly tamanho: number;
}

export interface Antena {
  readonly pontos: readonly (readonly [number, number])[];
  readonly largura: number;
  readonly area: Retangulo;
  readonly elevada: number;
}

export type Acabamento = 'enig' | 'hasl';

export interface ProjetoPcb {
  readonly placa: Placa;
  readonly largura: number;
  readonly altura: number;
  readonly espessura: number;
  readonly escala: number;
  readonly raio: number;
  readonly corMascara: string;
  readonly corSerigrafia: string;
  readonly acabamento: Acabamento;
  readonly footprints: readonly Footprint[];
  readonly trilhas: readonly Trilha[];
  readonly vias: readonly Via[];
  readonly furos: readonly Furo[];
  readonly textos: readonly TextoSerigrafia[];
  readonly antenas: readonly Antena[];
}
