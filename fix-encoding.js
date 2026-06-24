const fs = require('fs');
const path = require('path');

function fixFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const fixed = content
      .replace(/\u00e2\u0080\u0099/g, "'")
      .replace(/\u00e2\u0080\u009c/g, '"')
      .replace(/\u00e2\u0080\u009d/g, '"')
      .replace(/\u00e2\u0080\u0094/g, '-')
      .replace(/\u00c3\u00a2\u00e2\u0082\u00ac\u00e2\u0084\u00a2/g, "'")
      .replace(/â€"/g, '-')
      .replace(/âœ"/g, 'v')
      .replace(/â€™/g, "'")
      .replace(/â€œ/g, '"')
      .replace(/â€/g, '"');
    if (fixed !== content) {
      fs.writeFileSync(filePath, fixed, 'utf8');
      console.log('Fixed: ' + filePath);
    }
  } catch(e) {
    console.log('Error: ' + filePath + ' - ' + e.message);
  }
}

function walkDir(dir) {
  try {
    fs.readdirSync(dir).forEach(file => {
      const fullPath = path.join(dir, file);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory() && file !== 'node_modules' && file !== '.next') {
          walkDir(fullPath);
        } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
          fixFile(fullPath);
        }
      } catch(e) {}
    });
  } catch(e) {}
}

walkDir('app');
walkDir('components');
walkDir('lib');
console.log('Done');
