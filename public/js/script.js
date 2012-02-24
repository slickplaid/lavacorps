/* Author: Evan Johnson */

var socket = io.connect();
var c = {};
var ac = null;
var sc = null;
var pmc = 0;

socket.on('connect', function(data) {
  console.log(new Date().toString()+': Connected');
  $.gritter.add({ title: 'Connected', text: 'You are connected to the Lavanet!' });
});

socket.on('disconnect', function() {
  console.log(new Date().toString()+': Disconnected');
  $.gritter.add({ title: 'Disconnected', text: 'The server has gone offline.' });  
});

socket.on('status', function(data) {
  
});

socket.on('login', function(data) {
  if(data.success) {
    $('#login-form').replaceWith('<p class="pull-right"><span class="label success">Logged in as an Administrator.</span>&nbsp;<a href="/" class="logout-action"><span class="label">Logout</span></a></p>');
  }
  if(data.error) console.log('error logging in');
});

socket.on('join', function(data) {
  if(!data.channel) return false;
  if(ac === data.channel) return false; // already set
  ac = data.channel;
  c[ac] = io.connect('/'+data.channel);

  c[ac].on('admin', function(d) {
    $.gritter.add({ title: 'Message from server', text: d });
  });

  c[ac].on('grabControls', function(d) {
    var html = new EJS({ url: d.url }).render();
    $('#admin-controls').html(html);

    // enable datepicker
    $('#scheduleSale').datetimepicker({ mindate: new Date(), ampm: true });
    $('#admin-controls').on('click', '.add-on :checkbox', function() {
      var saleDate = $('#scheduleSale').val();
      if($(this).attr('checked') && saleDate != '') {
        c[ac].emit('saleControl', {
          date: saleDate,
          enabled: true
        });
      } else {
        c[ac].emit('saleControl', {
          date: saleDate,
          enabled: false
        });
      }
    });
  });

  c[ac].on('pm', function(d) {
    pmc++;
    d.count = pmc;
    d.username = d.username || 'Anonymous User';
    var html = new EJS({ url: d.parse }).render(d);
    $('#table-pmBody').append(html);
    $.gritter.add({ title: 'New Private Message from '+d.username, text: d.message });
  });

  c[ac].on('scheduleForm', function(d) {
    var html = new EJS({ url: d.url }).render();
    $('#admin-scheduleForm').html(html);
    $('#admin-scheduleForm').find('.modal').modal('show');
  });

  c[ac].on('sale', function(d) {
    if(d.enabled) {
      $('#scheduleSale').val(new Date(d.date));
      $('.add-on :checkbox').attr('checked', true).parents('.add-on').addClass('active');
    } else {
      $('#scheduleSale').val('');
      $('.add-on :checkbox').attr('checked', false).parents('.add-on').removeClass('active');      
    }
  });

  // handle admin broadcast
  $('#main').on('click', '#admin-broadcastSubmit', function() {
    if(!ac) return false;
    var message = $('#admin-broadcast').val() || '';
    c[ac].emit('broadcast', { message: message });
    $('#admin-broadcast').val('');
    return false;
  });
});

socket.on('presale', function(data) {
  var cd = $('#cdsm');
  cd.countdown('destroy');
  //$('.hero-unit').html('<div id="countdown"></div>');
  if(data.enabled) {
    cd.countdown({
      until: new Date(data.date),
      format: 'DHMS'
    });    
  }

});

socket.on('sale', function(data) {
  console.log('sale', data);
  var html = new EJS({ url: data.url }).render(data);
  $('#lavatank').html(html);
});

socket.on('broadcast', function(data) {
  $.gritter.add({ title: 'Global Message from Admin', text: data.message });  
});

// login events
$('.navbar').on('click', '.login-action', function() {
  var data = $(this).closest('form').serializeJSON();
  socket.emit('login', data);
  return false;
});

$('.navbar').on('click', '.logout-action', function() {
  socket.emit('logout', true);
  setTimeout(function() { location.reload(true); }, 500);
  return false;
});

// handle clicks on top bar
$('.nav li').on('click', function() {
  var $nav = $(this).closest('.nav');
  $nav.find('li').not($(this)).removeClass('active');
  $(this).addClass('active');
  return false;
});

// admin events
$('#admin-controls').on('click', '#admin-scheduleSale', function() {
  if(!ac) return false;
  c[ac].emit('grabScheduleForm', ac);
});

/*
  Modal Handling
 */

// submit pm
$('#modal-pm').on('click', 'button.btn-primary', function() {
  var $pm = $(this).closest('#modal-pm');
  var user = $pm.find('#username');
  var message = $pm.find('#message');
  var pm = {
    username: user.val(),
    message: message.val()
  }
  console.log(pm);
  if(!user.is(':disabled')) user.val('');
  message.val('');
  socket.emit('pm', pm);
  $pm.modal('hide');
  $.gritter.add({ title: 'Success', text: 'Your private message has been sent.' });
  return false;
});
// close pm
$('#modal-pm').on('click', 'a.btn', function() {
  var $pm = $(this).closest('#modal-pm');
  $pm.modal('hide');
  var user = $pm.find('#username');
  var message = $pm.find('#message');
  if(!user.is(':disabled')) user.val('');
  message.val('');
  return false;
});






/*
  Form Dynamics
*/

$('body').on('click', '.add-on :checkbox', function() {
  if($(this).attr('checked')) $(this).parents('.add-on').addClass('active');
  else $(this).parents('.add-on').removeClass('active');
});

$('body').on('change', '#scheduleSale', function() {
  $('.add-on :checkbox').attr('checked', false).parents('.add-on').removeClass('active');
});



