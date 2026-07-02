const fs = require('fs');

['app.json', 'app.dev.json'].forEach(file => {
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!json.expo.plugins.includes('expo-audio')) {
    const idx = json.expo.plugins.indexOf('expo-router');
    json.expo.plugins.splice(idx + 1, 0, 'expo-audio');
  }
  fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n');
  console.log(file, 'updated');
});
