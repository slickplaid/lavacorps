var io;
var clients = {};
var pms = [];
var sale = { date: null, enabled: false, timer: null };
var saleInProcess = false;
var parseCookie = require('connect').utils.parseCookie;
var sanitizer = require('sanitizer');
var crypto = require('crypto');
var login = require('./login');

// Admin channel
var adminChannel = randomChannel();
var saleChannel = null;
var salePath = 'views/saleForm.ejs';

exports = module.exports = {
  init: function(sockets, sessionStore, Session) {
    io = sockets;
    
    io.set('log level', 2);
    io.set('browser client minification', true);
    io.set('browser client etag', true);
    io.set('browser client gzip', true);

    io.set('authorization', function(data, accept) {
      if(data.headers.cookie) {
        data.cookie = parseCookie(data.headers.cookie);
        data.sessionID = data.cookie['express.sid'];
        data.sessionStore = sessionStore;
        sessionStore.get(data.sessionID, function(err, session) {
          if(err) return accept(err.message, false);
          else {
            data.session = new Session(data, session);
            return accept(null, true);
          }
        });
      } else {
        return accept('Session ID not transmitted. (401)', false);
      }
    });

    io.sockets.on('connection', function(client) {
      var hs = client.handshake;
      var intervalID = loadSession(hs);

      client.emit('presale', { enabled: sale.enabled, date: sale.date });
      if(saleInProcess)
        client.emit('sale', { enabled: sale.enabled, date: sale.date, url: salePath });

      if(hs.session.admin) {
        client.emit('join', { channel: adminChannel });
      }

      client.on('login', function(data) {
        if(data.user != login.user) {
          hs.session.admin = false;
          hs.session.save();
          return client.emit('login', { error: 'Invalid' });
        }
        if(data.pass != login.pass) {
          hs.session.admin = false;
          hs.session.save();
          return client.emit('login', { error: 'Invalid' });
        }
        hs.session.admin = true;
        hs.session.user = 'Admin';
        hs.session.save();
        client.emit('login', { success: 'Logged in as administrator.', user: 'Admin' });
        client.emit('join', { channel: adminChannel });
      });

      client.on('pm', function(data) {
        if(hs.session.user) {
          data.username = data.username+' (Logged in as '+hs.session.user+')';
        }
        var pm = { 
          username: sanitizer.escape(data.username), 
          message: sanitizer.escape(data.message), 
          parse: '/views/parseMessage.ejs',
          clientId: client.id
        };

        pms.push(pm);
        io.of('/'+adminChannel).emit('pm', pm);  
      });

      client.on('submitSale', function(data) { saleSubmit(client, data); });

      client.on('logout', function(data) { handleLogout(hs); });
      client.on('disconnect', function() { handleDisconnection(intervalID); });
    });


    var ac = io.of('/'+adminChannel).on('connection', function(client) {
      if(!client.handshake.session.admin) return false;
      console.log('admin connected');
      client.emit('grabControls', { url: '/views/admin.ejs' });
      if(sale.enabled) client.emit('sale', { enabled: sale.enabled, date: sale.date });
      if(pms.length > 0) {
        setTimeout(function() {
          pms.forEach(function(pm, i) {
            client.emit('pm', pm);
          });
        }, 1000);
      }
      client.on('broadcast', function(data) {
        if(typeof data.message !== 'undefined') data.message = sanitizer.escape(data.message);
        io.sockets.emit('broadcast', data);
      });
      client.on('pm.send', function(data) {
        console.log(io.sockets.socket(data.socketID).emit('broadcast', { message: 'hah'}));
      });
      client.on('saleControl', function(data) {
        saleControl(io, data, function(err, res) {
          if(err) return client.emit('admin', err);
          client.emit('admin', res);
          client.broadcast.emit('admin', res);
          client.broadcast.emit('sale', { enabled: sale.enabled, date: sale.date });
        });
      });
    });
  }
}

function saleSubmit(client, data) {
  
}

function saleControl(sockets, data, callback) {
  var date = data.date || '';
  var enabled = data.enabled || false;
  var now = new Date();

  if(enabled) {
    if(date == '') return callback('Invalid date.');
    date = new Date(date);
    if(isNaN(+date)) return callback('Invalid date.');  
    var diff = date - now;
    if(diff < 0) return callback('Date must be in the future.');

    // set sale params and timer
    sale.date = date;
    sale.enabled = true;
    sale.timer = setTimeout(function() {
      saleChannel = randomChannel();
      io.sockets.emit('sale', { enabled: true, date: date.toString(), url: salePath, channel: saleChannel });
      saleInProcess = true;
    }, diff);
    io.sockets.emit('presale', { enabled: true, date: date.toString() });
    callback(null, 'Sale set for '+date.toString()+'.')
  } else {
    clearTimeout(sale.timer);
    io.sockets.emit('presale', { enabled: false });
    sale = { date: null, enabled: false, timer: null };
    saleInProcess = false;
    saleChannel = null;
    callback(null, 'Sale cancelled.')
  }
}

function randomChannel() {
  var seed = JSON.stringify({
    rand: Math.random(),
    date: +new Date(),
    secret: 'bananarama'
  });
  return crypto.createHash('sha1').update(seed).digest('hex');
}

function loadSession(handshake) {
  return setInterval(function() {
    handshake.session.reload(function() {
      handshake.session.touch().save();
    });
  }, 60 * 1000);
}

function handleDisconnection(intervalID) {
  clearInterval(intervalID);
}

function handleLogin(data) {
  
}

function handleLogout(handshake) {
  handshake.session.admin = undefined;
  handshake.session.user = undefined;
  handshake.session.save();
}