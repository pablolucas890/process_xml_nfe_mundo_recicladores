// import generateHashPassword from './lib/generateHashPassword';
// const { salt, hash } = generateHashPassword('password');
// console.log('Salt:', salt);
// console.log('Hash:', hash);

import fastifyBasicAuth from '@fastify/basic-auth';
import cors from '@fastify/cors';
import * as crypto from 'crypto';
import fastify, { FastifyReply, FastifyRequest, RouteGenericInterface } from 'fastify';
import multer from 'fastify-multer';
import fs from 'fs';
import { parseString } from 'xml2js';
import upload from './config/multer';
import getHtml from './lib/getHtml';
import getnfeProc from './lib/getnfeProc';
import { MulterRequest } from './types';
import errors from './utils/errors';
import materials from './utils/materials';

const PROTOCOL = 'http';
const PORT = 3333;
const HOST = '0.0.0.0';

// utils
function getBrasilianDate(date: string) {
  return date.substring(8, 10) + '%2F' + date.substring(5, 7) + '%2F' + date.substring(0, 4);
}

function getMaterial(product: string) {
  return (
    materials[Object.keys(materials).find((key: string) => product.includes(key)) as keyof typeof materials] || 'outros'
  );
}

// validate
async function validate(username: string, password: string, req: FastifyRequest, reply: FastifyReply) {
  const users = JSON.parse(fs.readFileSync('src/credentials/users.json', 'utf8'));

  const user = users.find((user: { username: string }) => user.username === username);

  if (!user) {
    reply.code(401).send(new Error('Credenciais inválidas'));
  }

  const hash = crypto.pbkdf2Sync(password, user.salt, 1000, 64, 'sha512').toString('hex');

  if (hash !== user.passwordHash) {
    reply.code(401).send(new Error('Credenciais inválidas'));
  }
}

// begin of app
async function bootstrap() {
  const app = fastify({ logger: false });

  await app.register(fastifyBasicAuth, { validate });

  await app.register(cors, { origin: true });

  await app.register(multer.contentParser);

  app.get('/:idVendedor', { preValidation: app.basicAuth }, async (request: FastifyRequest, reply) => {
    const { idVendedor } = request.params as { idVendedor: string };
    const storyset = fs.readFileSync('src/assets/storyset.svg', 'utf8');
    return reply.type('text/html').send(
      getHtml(`
      <form action="/upload" method="post" enctype="multipart/form-data">
        ${storyset}
        <input type="file" name="file" accept="text/xml" class="upload-button">
        <input type="hidden" name="idVendedor" value="${idVendedor}">
        <input type="submit" value="Enviar">
      </form>
    `),
    );
  });

  app.get('/error/:idVendedor/:errorID', { preValidation: app.basicAuth }, async (request, reply) => {
    const { idVendedor, errorID } = request.params as { idVendedor: string; errorID: keyof typeof errors };
    return reply.type('text/html').send(
      getHtml(`
      <h3>${errors[errorID]}</h3>
      <a href="/${idVendedor}">Voltar</a>
    `),
    );
  });

  app.get('/success/:idVendedor', { preValidation: app.basicAuth }, async (request, reply) => {
    const { idVendedor } = request.params as { idVendedor: string };
    return reply.type('text/html').send(
      getHtml(`
      <h3>Arquivo processado com sucesso</h3>
      <a href="/${idVendedor}">Voltar</a>
    `),
    );
  });

  app.route<RouteGenericInterface, FastifyRequest>({
    method: 'POST',
    url: '/upload',
    preValidation: app.basicAuth,
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
            const notaUrl = PROTOCOL + '%3A%2F%2F' + HOST + ':' + PORT + '%2F' + xmlFile.path.replace('/', '%2F');
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

  app.get('/uploads/:filename', { preValidation: app.basicAuth }, async (request, reply) => {
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
