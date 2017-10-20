var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var index = require('./routes/index');
var users = require('./routes/users.js');
var app = express();
var mongoose = require('mongoose');
var User = require('./models/user_model.js');
var Phrase = require('./models/phrase_model.js');
var server = require('http').Server(app);
var io = require('socket.io')(server);
var flash = require('connect-flash');
var passport = require('passport'), LocalStrategy = require('passport-local').Strategy;
var cookieParser = require('cookie-parser');
var session = require('express-session');
var jwt = require('jsonwebtoken');
var socketioJwt = require('socketio-jwt');
var game_manager = require('./game_manager');
const util = require('util');
var md5 = require('md5');
var netfurio = require('./netfurio_functions');
const MongoStore = require('connect-mongo')(session);
var jwtSecret = 'ilbudellodituma';
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use('/', index);
app.use('/users', users);
app.use(cookieParser());
app.use(session({ secret: 'skdjfhdskfgjh', store: new MongoStore({ mongooseConnection: mongoose.connection }), resave: true, saveUninitialized: true, key: 'express.sid' }));
//app.use(session({ secret: 'skdjfhdskfgjh', key: 'express.sid', resave: true, saveUninitialized: true }));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());
var rooms = [];
var users = {};
var date_alive = Date.now();
console.log("wordswords sveglia sono le: " + date_alive);
passport.use(new LocalStrategy(
  {
    usernameField: 'email',
    passwordField: 'password',
    passReqToCallback: true,

  },
  function (req, email, password, done) {
    console.log("applico la passport strategy per: " + email);
    mongoose.connect('mongodb://localhost:27017/wordswords');
    var actualUser = mongoose.model('User');
    actualUser.findOne({ email: email }, function (err, user) {
      if (err) {
        console.log("c'é un errore nella ricerca utente passport " + err);
        return done(err);
      }
      if (!user) {
        console.log("passport non trova: " + user);
        return done(null, false, { message: 'Incorrect username.' });
      }
      if (!user.validPassword(password)) {
        console.log("passport dice che " + user + " ha inserito una password sbagliata: " + password);
        return done(null, false, { message: 'Incorrect password.' });
      }
      console.log("passport dice che é tutto ok");
      console.log("passport strategy ha trovato e loggato: " + email);
      return done(null, user, req.flash('utente_trovato', 1));
    });
  }
));
passport.serializeUser(function (user, done) {
  done(null, user);
});
passport.deserializeUser(function (user, done) {
  done(null, user);
});

io.on('connection', socketioJwt.authorize({
  secret: jwtSecret,
  timeout: 4000 // 15 seconds to send the authentication message
})).on('authenticated', function (socket) {
  var my_email = socket.decoded_token._doc.email;
  netfurio.addUser(users,my_email,socket.id);
  console.log('utente autenticato: ' + my_email);
  socket.on('crea_partita', function (msg) {
    game_manager.crea_stanza(my_email,users, rooms, socket);
    game_manager.crea_partita(msg, my_email, rooms, socket, io);
  });
  socket.on('invita_in_partita', function (msg) {
    game_manager.invita_in_partita(msg, my_email, users, rooms, socket, io);
  });
  socket.on('invito_accettato', function (msg) {//entrata in partita
    game_manager.invito_accettato(msg, my_email, rooms, socket, io);
  });
  socket.on('cerca_partita', function (msg) {
    console.log('richiesta di partita casuale');
    game_manager.cerca_partita(msg, my_email, rooms, socket, io);
  });
  socket.on('invio_scelta',function (frase){
    game_manager.invio_scelta(frase, my_email, rooms, socket, io,mongoose);
  });
  socket.on('voto',function (preferenza){
    game_manager.voto(preferenza, my_email, rooms, socket, io,mongoose);
  });
  socket.on('fine_partita',function (preferenza){
    console.log(my_email + "chiede fine partita");
    //game_manager.fine_partita(preferenza, my_email, rooms, socket, io,mongoose);
  });
  socket.on('lista_utenti', function (msg) {
    game_manager.lista_utenti(msg, my_email, rooms, socket, io);
  });
  socket.on('invito_respinto', function (msg) {
    console.log('arrivata notifica di invito respinto: ' + msg);
    io.sockets.in(msg).emit('non_ha_accettato', { "room_id": socket.decoded_token._doc.room_id, "nome": my_email });
  });
  socket.on('inizia_partita', function (msg) {
     game_manager.inizia_partita(msg, my_email, rooms, socket, io,mongoose);
  });
  socket.on('inizia_partita', function (msg) {
    game_manager.inizia_partita(msg, my_email, rooms, socket, io,mongoose);
 });
 socket.on('richiesta_utenti_online', function (msg) {
  game_manager.richiesta_utenti_online(msg, my_email, rooms, socket, io,mongoose,users);
});
  socket.on('prossimo_turno', function (msg) {
    game_manager.prossimo_turno(msg, my_email, rooms, socket, io,mongoose);
  });
  socket.on('distruggi_partita', function (msg) {
    game_manager.distruggi_partita(msg, my_email, rooms, socket, io);
  });
  socket.on('disconnect', function () {
    console.log('8===================================D');
    console.log(my_email + ' é andato a puttane dal socket!');
    var id_to_delete = netfurio.find_user_socket_id(users,my_email);
    console.log("id da cancellare " + id_to_delete);
    delete users[id_to_delete];
    console.log("users online: " + util.inspect(users, false, null));
    console.log('C===================================8');

  });
  socket.on('reconnect',function(){
    console.log('8====D');
    console.log(my_email + ' cerca di riconnettersi al socket!');
    console.log('C====8'); 
  });
});

app.post('/login', passport.authenticate('local', { failureFlash: "la mamma di passport é puttana", successFlash: 'la mamma di passport é una brava donna!' }), function (req, res) {
  console.log("utente in req " + req.user.email);
  //controllare se l'utente é giá nella lista dei loggati
  var token = jwt.sign(req.user, jwtSecret);
  response = { "utente_trovato": 1, "token": token };
  res.send(response);
});

app.post('/logout', passport.authenticate('local', { failureFlash: "la mamma di passport é puttana", successFlash: 'la mamma di passport é una brava donna!' }), function (req, res) {
  console.log("utente vuole andare a puttane dalla sessione");
  req.logout();
  res.send({ logout_ok: 1 });
  console.log('é andato a puttane dalla session!');
  console.log('---------------------------------');
  console.log(' ');
});

app.post('/registration', function (req, res) {
  console.log("utente vuole registrarsi: " + req.body.email + " " + req.body.password);
  mongoose.connect('mongodb://localhost:27017/wordswords');
  var user = new User({ email: req.body.email, password: req.body.password });
  console.log("creo oggetto user: " + user.email + " " + user.password);
  user.save(function (err) {
    var response = { "utente_registrato": 0 };
    if (err) {
      console.log("errore " + err.code);
      response = { "errore": err.code };
    } else {
      console.log('utente salvato: ' + req.body.email);
      response = { "utente_registrato": 1 };
    }
    res.send(response);
  });

});
app.get('/', (req, res) => {
  res.status(200).send('Hello, world of words!').end();
});

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));

//app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

server.listen(3000, function () {
  console.log('wordswords app and running on 3000!');
});


// catch 404 and forward to error handler
app.use(function (req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;