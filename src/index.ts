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
import materials from './utils/materials';
import replyMessages from './utils/replyMessages';

const PROTOCOL = 'https';
const PORT = 4444;
const HOST = '0.0.0.0';
const DNS = 'xml.mundorecicladores.com.br';

const privateKey = fs.readFileSync('src/credentials/private.key', 'utf8');
const certificate = fs.readFileSync('src/credentials/certificate.crt', 'utf8');
const caBundle = fs.readFileSync('src/credentials/ca-bundle.crt', 'utf8');

// utils
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
    if (!idVendedor || idVendedor?.length < 36) 
      return reply.type('text/html').send(
        getHtml(`
        <h1 style="color: red;"> Erro: ID do vendedor não informado </h1>
      `),
      );
    return reply.type('text/html').send(
      getHtml(`
      <form action="/upload" method="post" id="form" enctype="multipart/form-data">
        <label class="upload-button">
          <input type="hidden" name="idVendedor" value="${idVendedor}">
          <input type="file" onchange="enviarFormulario()" name="files" accept="text/xml" multiple>
          <p>Selecionar Notas (*max 10)</p>
        </label>
        <input type="submit" value="Enviar" id="submit">
      </form>
    `),
    );
  });

  app.get('/result/:idVendedor/:message', async (request, reply) => {
    const { message } = request.params as { idVendedor: string; message: string };
    console.log('message', message);
    const text = message
      .replace(/_1_/g, '.xml:  ' + replyMessages[1])
      .replace(/_2_/g, '.xml:  ' + replyMessages[2])
      .replace(/_3_/g, '.xml:  ' + replyMessages[3])
      .replace(/_4_/g, '.xml:  ' + replyMessages[4])
      .replace(/_5_/g, '.xml:  ' + replyMessages[5])
      .replace(/_6_/g, '.xml:  ' + replyMessages[6])
      .replace(/_7_/g, '.xml:  ' + replyMessages[7])
      .replace(/_8_/g, '.xml:  ' + replyMessages[8])
      .replace(/_9_/g, replyMessages[9])
      .replace(/_10_/g, '.xml:  ' + replyMessages[10]);
    return reply.type('text/html').send(
      getHtml(`
      <strong style="font-size: 14px;">${text}</strong>
    `),
    );
  });

  app.route<RouteGenericInterface, FastifyRequest>({
    method: 'POST',
    url: '/upload',
    preHandler: upload.array('files', 10),
    errorHandler: (error, request, reply) => {
      const { idVendedor } = request.body as { idVendedor: string };
      reply.redirect('/result/' + idVendedor + '/_9_');
    },
    handler: async (request: FastifyRequest, reply) => {
      const files = (request as MulterRequest).files as Express.Multer.File[];
      const { idVendedor } = request.body as { idVendedor: string };
      let messages = '';
      for (const xmlFile of files) {
        try {
          if (!(xmlFile && xmlFile.mimetype === 'text/xml')) {
            messages += xmlFile.filename.substring(0, 5) + '_4_';
          } else {
            const xmlData = fs.readFileSync(xmlFile.path, 'utf8');
            let url = '';
            parseString(xmlData, async (err, result) => {
              if (err) {
                messages += xmlFile.filename.substring(0, 5) + '_1_';
              } else {
                const nfeProc = getnfeProc(result);
                if (!nfeProc || !nfeProc.nfe.infNFe.det?.length || nfeProc.nfe.infNFe.det?.length !== 1) {
                  messages += xmlFile.filename.substring(0, 5) + '_3_';
                } else {
                  const det = nfeProc.nfe.infNFe.det[0];
                  const codigoNota = nfeProc.nfe.infNFe.Id.replace('NFe', '');
                  const situacaoNota = 'em-analise';
                  const notaNomeArquivo = xmlFile.originalname;
                  const notaUrl = PROTOCOL + '%3A%2F%2F' + DNS + ':' + PORT + '%2F' + xmlFile.path.replace('/', '%2F');
                  const vendedorId = idVendedor;
                  const codigoBarras = nfeProc.protNFe.infProt.chNFe;
                  const dataEmissaoDate = new Date(nfeProc.protNFe.infProt.dhRecbto);
                  const dataEmissao = dataEmissaoDate.toISOString().substring(0, 10);
                  const tipoMaterial = getMaterial(det.prod.xProd.toLowerCase());
                  const valorUnitario = parseFloat(det.prod.vUnCom);
                  const valorTotal = parseFloat(det.prod.vProd);
                  const quantidade = det.prod.uCom == 'KG' ? parseFloat(det.prod.qCom) * 1000 : 0;
                  
                  if (tipoMaterial === 'outros') {
                    messages += xmlFile.filename.substring(0, 5) + '_10_';
                  } else if (quantidade === 0) {
                    messages += xmlFile.filename.substring(0, 5) + '_2_';
                  } else {
                    url = `https://www.app.mundorecicladores.com.br/newRouter3/${codigoNota}/${situacaoNota}/${notaNomeArquivo}/${notaUrl}/${vendedorId}/${codigoBarras}/${dataEmissao}/${tipoMaterial}/${valorUnitario}/${valorTotal}/${quantidade}`;
                  }
                }
              }
            });
            if (url) {
              const res = await fetch(url).catch(() => {
                messages += xmlFile.filename.substring(0, 5) + '_6_';
              });
              if (res) {
                const text = await res.text();
                if (text.includes('Page not found')) {
                  messages += xmlFile.filename.substring(0, 5) + '_7_';
                } else {
                  messages += xmlFile.filename.substring(0, 5) + '_8_';
                }
              }
            }
          }
        } catch (error) {
          messages += 'File_5_';
        }
      }
      return reply.redirect('/result/' + idVendedor + '/' + messages);
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
