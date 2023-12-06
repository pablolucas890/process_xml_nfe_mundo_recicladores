import { ICMSTot, dest, det, emit, infNFe, infProt, nfe, prod, total } from '../types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function getnfeProc(result: any) {
  const Id = result['nfeProc']?.['NFe']?.[0]?.['infNFe']?.[0]?.['$']?.['Id'];
  if (!Id) return null;
  const emit: emit = result['nfeProc']['NFe'][0]['infNFe'][0]['emit'][0];
  const dest: dest = result['nfeProc']['NFe'][0]['infNFe'][0]['dest'][0];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const det: Array<det> = result['nfeProc']['NFe'][0]['infNFe'][0]['det'].map((element: any) => {
    const aux = element['prod'][0];
    const prod = {} as prod;
    Object.keys(aux).forEach(key => (prod[key as keyof prod] = String(aux[key])));
    return {
      nItem: element['$']['nItem'],
      prod,
    };
  });
  const ICMSTot: ICMSTot = {} as ICMSTot;
  const aux = result['nfeProc']['NFe'][0]['infNFe'][0]['total'][0]['ICMSTot'][0];
  Object.keys(aux).forEach(key => (ICMSTot[key as keyof ICMSTot] = Number(aux[key])));
  const total: total = { ICMSTot };
  const infNFe: infNFe = { Id, emit, dest, det, total };
  const nfe: nfe = { infNFe };
  const infProt: infProt = {} as infProt;
  const aux2 = result['nfeProc']['protNFe'][0]['infProt'][0];
  Object.keys(aux2).forEach(key => (infProt[key as keyof infProt] = String(aux2[key])));
  const protNFe = { infProt };

  return { nfe, protNFe };
}
