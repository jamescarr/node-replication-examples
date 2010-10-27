require.paths.unshift(__dirname+"/vendor/");
var express = require ('express')
var io = require ('socket.io')
var connect = require ('connect')
var event = require ('events')
var amqp = require ('amqp')

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
  events.emit('original.message.posted', req.param('message'))
  res.redirect('/')
});

app.listen(port)


events.on('message.posted', function(message){
   posted_messages.push(message.data.toString())
})

var connection = amqp.createConnection({ host: 'dev.rabbitmq.com' });

connection.addListener('ready', function(){
  var exchange = connection.exchange('example_exchange', {type:'fanout'})
  var queue = connection.queue('message-queue-'+ port)
  queue.bind('example_exchange', '#')

  queue.subscribe(function(message){
    events.emit('message.posted', message)
  })

  events.on('original.message.posted', function(message){
    exchange.publish("node.app", message);
  })

})
