export interface Car {
  id: string;
  marca: string;
  modelo: string;
  versao: string | null;
  ano_fabricacao: number;
  ano_modelo: number;
  quilometragem: number;
  cor: string | null;
  blindado: boolean;
  descricao: string | null;
  imagens: string[];
  preco: number | null;
  destaque: boolean;
  created_at: string;
}
