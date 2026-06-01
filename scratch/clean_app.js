const fs = require('fs');
let appJs = fs.readFileSync('public/js/app.js', 'utf8');

// The original app.js has a huge string literal for CSS and HTML injection.
// We can find `const style = document.createElement('style');` and replace until `// Bind auth overlay toggle`
appJs = appJs.replace(
  /const style = document\.createElement\('style'\);[\s\S]*?\/\/ Bind auth overlay toggle/,
  '// Bind auth overlay toggle (HTML is now in index.html)'
);

fs.writeFileSync('public/js/app.js', appJs);
console.log('Cleaned up app.js');
