require.paths.unshift(__dirname+"/vendor/");
var express = require ('express')
var io = require ('socket.io')
var connect = require ('connect')
var event = require ('events')

var events = new event.EventEmitter()

var port = parseInt(process.argv[2]) || 8080
var app = express.createServer();
app.configure(function(){
  app.use(connect.bodyDecoder());
  app.use(connect.methodOverride());
  app.use(connect.compiler({ src: __dirname + '/public', enable: ['less'] }));
  app.use(connect.staticProvider(__dirname + '/public'));
});

var posted_messages = []

app.get('/', function(req, res){
  res.render('index.haml', {
    locals:{
      port:port,
      messages:posted_messages
    }
  });
});

app.post('/', function(req, res){
  events.emit('message.posted', req.param('message'))
  res.redirect('/')
});

app.listen(port)


events.on('message.posted', function(message){
   posted_messages.push(message)
})
