$(function(){
  var socket = new io.Socket('localhost', $('.port').text())
  socket.connect()
  socket.on('message', function(message){
    $('#output').append(message+"\n")
  })
  $('button').click(function(){
    var input = $('input[name="message"]')
    socket.send(input.val())
    input.val('')
  })
})
