require.paths.unshift(__dirname+'/vendor/');
var amqp = require ('amqp')

var conn = amqp.createConnection({host:'dev.rabbitmq.com'});

conn.addListener('ready', function(){
  var exchange = conn.exchange('rabbit', {type:'fanout'})
  var queue = conn.queue('user9')
  queue.bind('rabbit', '#')

  queue.subscribe(function(message){
    console.log('['+message._routingKey+'] ' + message.data.toString()) 
  })

  var stdin = process.openStdin();
  stdin.on('data', function(data){
    exchange.publish('user9', data.toString(), {contentType:'text/plain', contentEncoding:'utf-8'})
  })
})

