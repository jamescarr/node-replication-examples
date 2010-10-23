var http  = require ('http')
var sys = require ('sys')


var hosts = linkedList([8081, 8082]) // convert to heroku apps

function linkedList (arr) {
  return {
    next:function(){
      var el = arr.shift()
      arr.push(el)
      return el
    }
  }
}

http.createServer(function(req, res) {
  if(req.url == '/favicon.ico')
    return
  var proxy = http.createClient(hosts.next(), 'localhost');
  var preq = proxy.request(req.method, req.url, req.headers);

  console.log(req.connection.remoteAddress +" "+ req.method +" "+req.url);
  preq.on('response', function(pres) {
    res.writeHead(pres.statusCode, pres.headers);
    sys.pump(pres, res);
    pres.on('end', function() {
      preq.end();
      res.end();
    });
  });
  req.on('data', function(chunk) {
    preq.write(chunk, 'binary');
  });
  req.on('end', function() {
    preq.end();
  });
}).listen(8080);
