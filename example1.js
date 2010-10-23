var express = require ('express')
var io = require ('socket.io')
var connect = require ('connect')
var amqp = require ('amqp')


var port = parseInt(process.argv[2]) || 8080

var app = express.createServer();

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
   posted_messages.push(req.param('message'))
   res.redirect('/')
});

app.listen(port)
