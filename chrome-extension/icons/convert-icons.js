// Script para converter SVG para PNG usando Canvas
// Execute: node convert-icons.js

const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');

async function convertSvgToPng(svgPath, pngPath, size) {
  try {
    // Ler SVG
    const svgContent = fs.readFileSync(svgPath, 'utf-8');
    
    // Criar canvas
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    
    // Criar data URL do SVG
    const svgDataUrl = 'data:image/svg+xml;base64,' + Buffer.from(svgContent).toString('base64');
    
    // Carregar e desenhar a imagem
    const img = await loadImage(svgDataUrl);
    ctx.drawImage(img, 0, 0, size, size);
    
    // Salvar PNG
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(pngPath, buffer);
    
    console.log(`✓ Criado: ${pngPath}`);
  } catch (error) {
    console.error(`✗ Erro ao converter ${svgPath}:`, error.message);
  }
}

async function main() {
  console.log('Convertendo ícones SVG para PNG...\n');
  
  await convertSvgToPng('icon16.svg', 'icon16.png', 16);
  await convertSvgToPng('icon48.svg', 'icon48.png', 48);
  await convertSvgToPng('icon128.svg', 'icon128.png', 128);
  
  console.log('\n✓ Conversão concluída!');
  console.log('\nNOTA: Se houver erros, você pode usar uma ferramenta online como:');
  console.log('- https://svgtopng.com');
  console.log('- https://cloudconvert.com/svg-to-png');
}

main().catch(console.error);
