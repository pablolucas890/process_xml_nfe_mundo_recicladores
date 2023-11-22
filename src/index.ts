// import generateHashPassword from './lib/generateHashPassword';
// const { salt, hash } = generateHashPassword('password');
// console.log('Salt:', salt);
// console.log('Hash:', hash);

import cors from '@fastify/cors';
import fastify, { FastifyRequest, RouteGenericInterface } from 'fastify';
import multer from 'fastify-multer';
import fs from 'fs';
import { parseString } from 'xml2js';
import upload from './config/multer';
import getHtml from './lib/getHtml';
import getnfeProc from './lib/getnfeProc';
import { MulterRequest } from './types';
import errors from './utils/errors';
import materials from './utils/materials';

const PROTOCOL = 'https';
const PORT = 4444;
const HOST = '0.0.0.0';
const DNS = 'xml.mundorecicladores.com.br';

const privateKey = fs.readFileSync('src/credentials/private.key', 'utf8');
const certificate = fs.readFileSync('src/credentials/certificate.crt', 'utf8');
const caBundle = fs.readFileSync('src/credentials/ca-bundle.crt', 'utf8');

// utils
function getBrasilianDate(date: string) {
  return date.substring(8, 10) + '%2F' + date.substring(5, 7) + '%2F' + date.substring(0, 4);
}

function getMaterial(product: string) {
  return (
    materials[Object.keys(materials).find((key: string) => product.includes(key)) as keyof typeof materials] || 'outros'
  );
}

// begin of app
async function bootstrap() {
  const app = fastify({ logger: false,
    https: {
    key: privateKey,
    cert: certificate,
    ca: caBundle
  } });

  await app.register(cors, { origin: true });

  await app.register(multer.contentParser);

  app.get('/:idVendedor', async (request: FastifyRequest, reply) => {
    const { idVendedor } = request.params as { idVendedor: string };
    return reply.type('text/html').send(
      getHtml(`
      <form action="/upload" method="post" id="form" enctype="multipart/form-data">
        <label class="upload-button">
          <input type="hidden" name="idVendedor" value="${idVendedor}">
          <input type="file" onchange="enviarFormulario()" name="file" accept="text/xml">
          <p>Enviar XML</p>
        </label>
        <input type="submit" value="Enviar" id="submit">
      </form>
    `),
    );
  });

  app.get('/error/:idVendedor/:errorID', async (request, reply) => {
    const { idVendedor, errorID } = request.params as { idVendedor: string; errorID: keyof typeof errors };
    return reply.type('text/html').send(
      getHtml(`
      <strong>${errors[errorID]}</strong>
      <a href="/${idVendedor}">OK</a>
    `),
    );
  });

  app.get('/success/:idVendedor', async (request, reply) => {
    const { idVendedor } = request.params as { idVendedor: string };
    return reply.type('text/html').send(
      getHtml(`
      <strong>Arquivo processado com sucesso</strong>
      <a href="/${idVendedor}">OK</a>
    `),
    );
  });

  app.route<RouteGenericInterface, FastifyRequest>({
    method: 'POST',
    url: '/upload',
    preHandler: upload.single('file'),
    handler: async (request: FastifyRequest, reply) => {
      const xmlFile = (request as MulterRequest).file;
      const { idVendedor } = request.body as { idVendedor: string };
      try {
        if (!(xmlFile && xmlFile.mimetype === 'text/xml')) {
          console.error('Tipo do arquivo:', xmlFile);
          return reply.redirect('/error/' + idVendedor + '/4');
        }
        const xmlData = fs.readFileSync(xmlFile.path, 'utf8');

        await new Promise(() => {
          parseString(xmlData, async (err, result) => {
            if (err) {
              console.error(err);
              return reply.redirect('/error/' + idVendedor + '/1');
            }

            const nfeProc = getnfeProc(result);
            if (!nfeProc.nfe.infNFe.det?.length || nfeProc.nfe.infNFe.det?.length !== 1) {
              console.error(nfeProc.nfe.infNFe.det);
              return reply.redirect('/error/' + idVendedor + '/3');
            }

            const det = nfeProc.nfe.infNFe.det[0];
            const codigoNota = nfeProc.nfe.infNFe.Id;
            const situacaoNota = 'em-analise';
            const notaNomeArquivo = xmlFile.originalname;
            const notaUrl = PROTOCOL + '%3A%2F%2F' + DNS + ':' + PORT + '%2F' + xmlFile.path.replace('/', '%2F');
            const vendedorId = idVendedor;
            const codigoBarras = nfeProc.protNFe.infProt.chNFe;
            const dataEmissao = getBrasilianDate(nfeProc.protNFe.infProt.dhRecbto);
            const tipoMaterial = getMaterial(det.prod.xProd.toLowerCase());
            const valorUnitario = parseFloat(det.prod.vUnCom);
            const valorTotal = parseFloat(det.prod.vProd);
            const quantidade = det.prod.uCom == 'KG' ? parseFloat(det.prod.qCom) * 1000 : 0;

            if (quantidade === 0) {
              console.error(det.prod.uCom);
              return reply.redirect('/error/' + idVendedor + '/2');
            }

            const url = `https://www.app.mundorecicladores.com.br/newRouter3/${codigoNota}/${situacaoNota}/${notaNomeArquivo}/${notaUrl}/${vendedorId}/${codigoBarras}/${dataEmissao}/${tipoMaterial}/${valorUnitario}/${valorTotal}/${quantidade}`;

            const res = await fetch(url).catch(err => {
              console.error(err);
              return reply.redirect('/error/' + idVendedor + '/6');
            });
            const text = await res.text();
            if (text.includes('Page not found')) {
              console.error('Page not found');
              return reply.redirect('/error/' + idVendedor + '/7');
            } else {
              return reply.redirect('/success/' + idVendedor);
            }
          });
        });
      } catch (error) {
        console.error(error);
        return reply.redirect('/error/' + idVendedor + '/5');
      }
    },
  });

  app.get('/uploads/:filename', async (request, reply) => {
    const { filename } = request.params as { filename: string };
    const file = fs.readFileSync('uploads/' + filename);
    return reply.type('document/xml').send(file);
  });

  app.listen({ port: PORT, host: HOST }, err => {
    if (err) throw err;
    console.log(`Server listening on ${PROTOCOL}://${HOST}:${PORT}`);
  });
}

bootstrap();
