
/**
 * Module dependencies.
 */

var express = require('express');
var RedisStore = require('connect-redis')(express);

var routes = require('./routes');
var sessionStore = new RedisStore();
var Session = require('connect').middleware.session.Session;

var app = module.exports = express.createServer();
var io = require('socket.io').listen(app);

// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser());
  app.use(express.session({ secret: 'bananarama', store: sessionStore, key: 'express.sid' }));
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
  app.use(express.logger('dev'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});

app.configure('production', function(){
  app.use(express.errorHandler()); 
});

app.dynamicHelpers({
  req: function(req) {
    return req;
  },
  messages: function(req) {
    return function() {
      var msgs = req.flash();
      return Object.keys(msgs).reduce(function(arr, type) {
        return arr.concat(msgs[type]);
      })
    }
  },
  user: function(req) {
    return (req.session && req.session.user) ? req.session.user : false;
  },
  isAdmin: function(req) {
    return (req.session.admin) ? true : false;
  }
});
// Routes

app.get('/', routes.index);

app.listen(3000);
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);

// handle socket.io connections
var sio = require('./sockets').init(io, sessionStore, Session);