const fs = require('fs');
let content = fs.readFileSync('public/index.html', 'utf8');
content = content.replace(/<style>[\s\S]*?<\/style>/, '<link rel="stylesheet" href="css/style.css">');
fs.writeFileSync('public/index.html', content);
console.log('Replaced inline <style> with CSS link in public/index.html');
