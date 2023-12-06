import { FastifyRequest } from 'fastify';

export interface MulterRequest extends FastifyRequest {
  files: Express.Multer.File[];
}

export interface nfeProc {
  nfe: nfe;
  protNFe: protNFe;
}

export interface protNFe {
  infProt: infProt;
}

export interface infProt {
  tpAmb?: string;
  chNFe: string;
  dhRecbto: string;
  nProt: string;
  digVal: string;
  cStat: string;
  xMotivo: string;
}

export interface nfe {
  infNFe: infNFe;
  // signature
}

export interface infNFe {
  Id: string;
  emit: emit;
  dest: dest;
  det?: det[];
  total?: total;
  // trasnp
  // cobr
  // pag
  // infAdic
}

export interface emit {
  CNPJ: string;
  xNome: string;
  xFant: string;
  enderEmit: {
    xLgr: string;
    nro: string;
    xBairro: string;
    xMun: string;
    UF: string;
    CEP: string;
    cPais: string;
    xPais: string;
    fone: string;
  };
  IE: string;
  CRT: string;
}

export interface dest {
  CNPJ: string;
  xNome: string;
  enderDest: {
    xLgr: string;
    nro: string;
    xBairro: string;
    xMun: string;
    UF: string;
    CEP: string;
    cPais: string;
    xPais: string;
    fone: string;
  };
  indIEDest: string;
  IE: string;
  email?: string;
}

export interface det {
  nItem: string;
  prod: prod;
  // imposto: imposto;
}

export interface prod {
  cProd: string;
  cEAN: string;
  xProd: string;
  NCM: string;
  CFOP: string;
  uCom: string;
  qCom: string;
  vUnCom: string;
  vProd: string;
  cEANTrib: string;
  uTrib: string;
  qTrib: string;
  vUnTrib: string;
  indTot: string;
}

export interface total {
  ICMSTot: ICMSTot;
}

export interface ICMSTot {
  vBC: number;
  vICMS: number;
  vICMSDeson: number;
  vFCP: number;
  vBCST: number;
  vST: number;
  vFCPST: number;
  vFCPSTRet: number;
  vProd: number;
  vFrete: number;
  vSeg: number;
  vDesc: number;
  vII: number;
  vIPI: number;
  vIPIDevol: number;
  vPIS: number;
  vCOFINS: number;
  vOutro: number;
  vNF: number;
  vTotTrib: number;
}
