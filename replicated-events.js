require.paths.unshift(__dirname+'/vendor/')
var amqp = require ('amqp')
var events = require ('events')

function EventEmitter(){
  var exchangeName = 'appname'
  var conn = amqp.createConnection({host:'dev.rabbitmq.com'})
  var exchange = {}
  var queue = {}
  var uid = exchangeName + process.pid
  conn.on('ready', function(){
    exchange = conn.exchange(exchangeName)
    queue = conn.queue(uid)
  })
  var emitter = new events.EventEmitter()
  this.emit = function(name, evt){
    exchange.publish(name, JSON.stringify({origin: uid, payload:evt}))
    emitter.emit(name,evt)
  }
  this.on = function(name,cb){
  conn.on('ready', function(){
      queue.bind(exchangeName, name)
      queue.subscribe(function(msg){
        var incoming = JSON.parse(msg.data.toString())
        if(incoming.origin != uid)
          emitter.emit(name, incoming.payload)
      })
    })
    emitter.on(name, cb);
  }
}
exports.EventEmitter = EventEmitter
