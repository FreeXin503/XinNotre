var http = require('http'), fs = require('fs'), path = require('path');
var base = path.join(__dirname, 'public');

var srv = http.createServer(function (req, res) {
  var u = req.url.split('?')[0];
  var fp = path.join(base, u === '/' ? '/mind-galaxy.html' : u);
  try { fs.statSync(fp); } catch (e) { res.writeHead(404); res.end('404'); return; }
  var ext = path.extname(fp);
  var ct = ext === '.js' ? 'application/javascript' : ext === '.html' ? 'text/html;charset=utf-8' : ext === '.css' ? 'text/css' : 'text/plain';
  if (u.startsWith('/api/')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: { snapshot_json: null } }));
    return;
  }
  res.writeHead(200, { 'Content-Type': ct });
  fs.createReadStream(fp).pipe(res);
});

srv.listen(3000, function () { console.log('http://localhost:3000/mind-galaxy.html'); });
