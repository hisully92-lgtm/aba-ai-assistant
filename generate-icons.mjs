import { createCanvas } from 'canvas';
import { writeFileSync } from 'fs';

function generateIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // Background
  ctx.fillStyle = '#1a2234';
  ctx.fillRect(0, 0, size, size);
  
  // Circle
  ctx.fillStyle = '#2563eb';
  ctx.beginPath();
  ctx.arc(size/2, size/2, size * 0.38, 0, Math.PI * 2);
  ctx.fill();
  
  // Text
  ctx.fillStyle = '#ffffff';
  ctx.font = \old \px Arial\;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ABA', size/2, size/2);
  
  writeFileSync(\public/icon-\.png\, canvas.toBuffer('image/png'));
  console.log(\Created icon-\.png\);
}

generateIcon(192);
generateIcon(512);
