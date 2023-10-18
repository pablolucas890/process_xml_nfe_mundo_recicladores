import fs from 'fs';

const styles = fs.readFileSync('src/assets/styles.css', 'utf8');

export default function getHtml(body: string) {
  return `
    <html>
    <head>
      <title>Upload de Arquivos</title>
    </head>
    <meta charset="utf-8">
    <style>${styles}</style>
    <body>
      ${body}
    </body>
  </html>
`;
}
