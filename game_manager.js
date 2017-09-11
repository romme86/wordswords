var netfurio = require('./netfurio_functions');
var Room = require('./Room');
var UserPhrase = require('./UserPhrase');
const util = require('util');
var Phrase = require('./models/phrase_model.js');
//db.getCollection('phrases').updateMany({}, {$set: {utenti_passati: []}}) //PER RESETTARE GLI USER PASSATI IN TUTTE LE FRASI
module.exports = {
    crea_stanza: function (email, users, rooms, socket) {
        var room = new Room(email, rooms);
        room.addPlayer(email);
        socket.room = room;
        socket.join(room.id);
        rooms[room.id] = room;
        console.log("la room di " + email + " é " + room.id);
    },
    invita_in_partita: function (email_to_invite, email, users, rooms, socket, io) {
        console.log("l'utente " + email + " vuole invitare " + email_to_invite);
        console.log("untenti loggati: " + util.inspect(users, false, null));
        var socket_id_to_invite = netfurio.cerca_utente_per_email_in_users(users, email_to_invite);
        if (socket_id_to_invite !== false) {
            //invio il messaggio all'utente che viene invitato, contenente l'id della room a cui unirsi
            io.to(socket_id_to_invite).emit("invito", { "room_id": socket.room.id, "nome": email });
            //invio il messaggio all'utente che ha invitato, contenente l'id della room a cui unirsi
            io.sockets.in(socket.id).emit("invito_inviato", { "room_id": socket.room.id, "nome": email_to_invite });
        } else {
            io.in(socket.id).emit('utente_non_trovato', "l'utente non é loggato, oppure si sta cercando di invitare se stessi");
            console.log("utente" + email_to_invite + " non loggato");
        }
    },
    crea_partita: function (msg, email, rooms, socket, io) {
        console.log('arrivata richiesta creazione partita, messaggio: ' + msg);
        console.log("l'utente " + email + ' sta creando una partita con id: ' + socket.room.id + '!');
        socket.room.active = true;
        io.in(socket.id).emit('creata_partita', { "room_id": socket.room.id });
        console.log('inizio partita di ' + email);
    },
    invito_accettato: function (room_id_to_join, email, rooms, socket, io) {
        console.log('arrivata richiesta di entrata in stanza con id: ' + room_id_to_join);
        if (typeof rooms[room_id_to_join] !== 'undefined') {
            var stanza = rooms[room_id_to_join];
            if (stanza.getPlayer(email) === null) {
                socket.room = stanza;
                socket.join(room_id_to_join);
                stanza.addPlayer(email);
            } else {
                console.log("utente " + email + " giá presente nella stanza.");
            }
            console.log("utente " + email + " é entrato nella stanza " + room_id_to_join);
            var json_list = netfurio.lista_utenti(stanza);
            console.log("lista utenti: " + util.inspect(json_list, false, null));
            io.in(room_id_to_join).emit("lista_utenti", json_list);
            console.log("sono " + email + " provo a mandare entra_gioco a " + socket.id);
            io.in(socket.id).emit("entra_gioco", 1);
        } else {
            console.log("l'id stanza non é valido (invito accettato)");
        }
    },
    cerca_partita: function (msg, email, rooms, socket, io) {
        //da fare
    },
    lista_utenti: function (room_id, email, rooms, socket, io) {
        if (typeof rooms[room_id] !== 'undefined') {
            var json_list = netfurio.lista_utenti(rooms[room_id]);
            io.in(room_id).emit("lista_utenti", json_list);
        } else {
            console.log("l'id stanza non é valido (lista utenti)");
        }
    },
    inizia_partita: function (room_id, email, rooms, socket, io, mongoose) {
        var Phrase = mongoose.model('Phrase');
        console.log("l'utente " + email + " vuole iniziare la partita in stanza con id: " + room_id);
        var frase;
        Phrase.findOne({ utenti_passati: { $nin: rooms[room_id].arrayPlayersEmails() } }, function (err, frase) {
            if (err) {
                console.log("c'é un errore nella ricerca frase " + err);
                return done(err);
            }
            //aggiungo gli utenti a questa frase
			if(frase != null){
				netfurio.addUsersToPhrase(socket,frase,mongoose);
			}else{
				console.log("la frase é vuota, qualche utente ha finito le frasi");
			}
            rooms[room_id].addPrhase(frase);
            console.log("mando trasferimento partita");
            io.in(room_id).emit("trasferimento_partita", frase);
        });
    },
    prossimo_turno: function (room_id, email, rooms, socket, io, mongoose) {
        console.log(email + " vuole andare al prossimo turno.");
        socket.room.player_ready_for_next_turn++;
        room_id = socket.room.id;

        if (socket.room.player_ready_for_next_turn === socket.room.players.length) {
            var Phrase = mongoose.model('Phrase');
            console.log("la room di " + email + " é pronta per il prossimo turno: " + room_id);
            var frase;
            delete socket.room.phrase;
            Phrase.findOne({ utenti_passati: { $nin: rooms[room_id].arrayPlayersEmails() } }, function (err, frase) {
                if (err) {
                    console.log("c'é un errore nella ricerca frase " + err);
                    return done(err);
                }
                console.log("la nuova frase é " + util.inspect(frase, false, null));
                rooms[room_id].addPrhase(frase);
                //aggiungo gli utenti a questa frase
                if(frase !== null){
                    netfurio.addUsersToPhrase(socket,frase,mongoose);
                }else{
                    frase = new Phrase();
                    console.log("qualcuno ha finito le frasi");
                }
                
                rooms[room_id].turn++;
                socket.room.player_ready_for_next_turn = 0;
                socket.room.frasi_scritte_del_turno = 0;
                console.log("mando prossimo turno ");
                io.in(room_id).emit("pronti_per_prossimo_turno", frase);
				console.log("mandato prossimo turno ");
            });
        }
        io.in(room_id).emit("non_ancora_pronti", 1);
    },
    invio_scelta: function (frase, email, rooms, socket, io, mongoose) {
        var array_dati = frase.split(",");
        var vera_frase = array_dati[1];
        console.log(email + " ha scritto: " + netfurio.replace_accentate(vera_frase));
        var room_id = socket.room.id;
        var frase_utente = new UserPhrase();
        frase_utente.completamento_frase = netfurio.replace_accentate(vera_frase);
        frase_utente.turno = socket.room.turn;
        frase_utente.proprietario = email;
        var player = socket.room.getPlayer(email);
        player.phrase = frase_utente;
        socket.room.frasi_scritte_del_turno++;
        if (socket.room.frasi_scritte_del_turno == socket.room.players.length) {//tutte le frasi sono state scritte
            //aggiungo la frase giusta
            console.log("socket.room.turn" + socket.room.turn);
            var frase_giusta = new UserPhrase();
            frase_giusta.completamento_frase = socket.room.phrase.seconda_parte;
            frase_giusta.turno = socket.room.turn;
            frase_giusta.proprietario = "giusta";
            var array_frasi_utenti = socket.room.arrayPlayersPhrases();
            array_frasi_utenti.push(frase_giusta);
            //mistio l'array
            netfurio.mischia(array_frasi_utenti);
            socket.room.creaMapOfShuffle(array_frasi_utenti);
            //compongo un json con le frasi di tutti
            var json_list = { "utenti": "", "seconde_parti": "" };
            for (var i = 0, len = array_frasi_utenti.length; i < len; i++) {
                if (i != len) {
                    json_list["utenti"] += array_frasi_utenti[i].proprietario + ",";
                    json_list["seconde_parti"] += array_frasi_utenti[i].completamento_frase + ",";
                } else {
                    json_list["utenti"] += array_frasi_utenti[i].proprietario;
                    json_list["seconde_parti"] += array_frasi_utenti[i].completamento_frase + ",";
                }
            }
            console.log("json delle frasi: " + util.inspect(json_list, false, null));
            io.in(socket.room.id).emit("tutti_pronti", json_list);//invio il json con le frasi di tutti ai client
        }
    },
    voto: function (preferenza, email, rooms, socket, io, mongoose) {
        console.log("ricevuto voto da " + email + ", sta votando " + preferenza);
        var room_id = socket.room.id;
        rooms[room_id].voted++;
        if (rooms[room_id].players.length == rooms[room_id].voted) {
            rooms[room_id].voted = 0;
            rooms[room_id].vote(email, preferenza);
            var classifica = rooms[room_id].scoreboard();
            //se é l'ultimo turno mando "ultimo_turno"
            if (socket.room.turn >= 3){//&& socket.room.turn >= socket.room.players.length) {//regola ultimo turno
                
                console.log("mando ultimo turno");
                json_vincitori = socket.room.andTheWinnerIs();
                console.log("array WINNERS: " + util.inspect(json_vincitori, false, null));
                io.in(socket.room.id).emit('ultimo_turno', json_vincitori);
                io.in(socket.room.id).emit('who_win', json_vincitori);
            }
            console.log("mando classifica");
            io.in(socket.room.id).emit('classifica', classifica);
        } else {
            rooms[room_id].vote(email, preferenza);
            io.in(socket.id).emit('voto_singolo', 1);
        }
    },
    fine_partita: function(preferenza, email, rooms, socket, io, mongoose){
        console.log("mando who_win");
        io.in(socket.id).emit('who_win', socket.room.andTheWinnerIs());
    },
    distruggi_partita: function (msg, email, rooms, socket, io) {
        console.log("l'utente " + email + " sta distruggendo la stanza");
        delete rooms[msg];
        console.log("lista stanze per vedere se ho rimosso quella con id: " + msg + " lista: " + util.inspect(rooms, false, null));
        io.sockets.in(msg).emit('partita_distrutta', 1);
        socket.leave(msg);
    }
}