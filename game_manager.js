var netfurio = require('./netfurio_functions');
var Room = require('./Room');
var UserPhrase = require('./UserPhrase');
const util = require('util');
var Phrase = require('./models/phrase_model.js');
var min_players = 1;
var max_players = 20;
//db.getCollection('phrases').updateMany({}, {$set: {utenti_passati: []}}) //PER RESETTARE GLI USER PASSATI IN TUTTE LE FRASI
module.exports = {
    crea_stanza: function (email, users, rooms, socket) {
        var room = new Room(email, rooms);
        room.addPlayer(email);
        socket.room = room;
        socket.join(room.id);
        rooms[room.id] = room;
        console.log("lista rooms: " + util.inspect(rooms, false, null));
        console.log("la room di " + email + " é " + room.id);
    },
    invita_in_partita: function (email_to_invite, email, users, rooms, socket, io) {
        console.log("l'utente " + email + " vuole invitare " + email_to_invite);
        console.log("untenti loggati: " + util.inspect(users, false, null));
        var socket_id_to_invite = netfurio.cerca_utente_per_email_in_users(users, email_to_invite);
        if (socket_id_to_invite !== false) {
            //invio il messaggio all'utente che viene invitato, contenente l'id della room a cui unirsi
            io.to(socket_id_to_invite).emit("invito", {
                "room_id": socket.room.id,
                "nome": email
            });
            //invio il messaggio all'utente che ha invitato, contenente l'id della room a cui unirsi
            io.sockets.in(socket.id).emit("invito_inviato", {
                "room_id": socket.room.id,
                "nome": email_to_invite
            });
        } else {
            io.in(socket.id).emit('utente_non_trovato', "l'utente non é loggato, oppure si sta cercando di invitare se stessi");
            console.log("utente" + email_to_invite + " non loggato");
        }
    },
    crea_partita: function (msg, email, rooms, socket, io) {
        console.log('arrivata richiesta creazione partita, messaggio: ' + msg);
        console.log("l'utente " + email + ' sta creando una partita con id: ' + socket.room.id + '!');
        socket.room.active = true;
        io.in(socket.id).emit('creata_partita', {
            "room_id": socket.room.id
        });
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
            io.in(socket.id).emit("entra_gioco", {
                "cerca": null,
                "room_id": room_id_to_join
            });
            console.log("siamo in " + stanza.numberOfPlayers());
            if (stanza.numberOfPlayers() >= min_players) {
                //si puó iniziare la partita
                console.log("si puó iniziare la partita, siamo in " + stanza.numberOfPlayers());
                io.in(room_id_to_join).emit("abbastanza", 1);
            }
        } else {
            console.log("l'id stanza non é valido (invito accettato)");
        }
    },
    cerca_partita: function (msg, email, rooms, socket, io) {
        //console.log("lista rooms: " + util.inspect(rooms, false, null));
        console.log("l'utente " + email + " sta cercando una partita disperatamente " + rooms.length + " ");
        for (var i in rooms) {
            console.log("rooms[i].numberOfPlayers() " + rooms[i].numberOfPlayers() + " min_players " + min_players);
            if (rooms[i].numberOfPlayers() <= min_players) {
                console.log("l'utente " + email + " ha trovato una stanza con meno di " + min_players + " giocatori ");
                //aggiungo lútente a questa stanza e a questo socket
                //se necessario notifico inizio partita
                rooms[i].addPlayer(email);
                socket.room = rooms[i];
                socket.join(rooms[i].id);
                var json_list = netfurio.lista_utenti(rooms[i]);
                io.in(socket.id).emit("entra_gioco", {
                    "cerca": "si",
                    "room_id": rooms[i].id
                });
                io.in(rooms[i].id).emit("lista_utenti", json_list);

                if (rooms[i].numberOfPlayers() >= min_players) {
                    //si puó iniziare la partita
                    console.log("la partita é iniziabile, mando abbastanza");
                    io.in(i).emit("abbastanza", 1);
                }
            }
        }
    },
    lista_utenti: function (room_id, email, rooms, socket, io) {
        room_id = socket.room.id;
        if (typeof rooms[room_id] !== 'undefined') {
            var json_list = netfurio.lista_utenti(rooms[room_id]);
            io.in(room_id).emit("lista_utenti", json_list);
        } else {
            console.log("l'id stanza non é valido (lista utenti) chiesto da " + email);
        }
        //controllo se sono abbastanza per iniziare
        // if (rooms[room_id].numberOfPlayers() >= min_players) {
        //     //si puó iniziare la partita
        //     console.log("la partita é iniziabile, mando abbastanza da lista utenti");
        //     io.in(room_id).emit("abbastanza", 1);
        // }
    },
    richiesta_utenti_online: function (room_id, email, rooms, socket, io, mongoose, users) {
        console.log("richiesta utenti online da " + email); 
        var numero_utenti = 10;
        if(users.length <= numero_utenti){
            numero_utenti = users.length;
        }
        //var arrayDaUtenti = netfurio.getRandomFromArray(users,numero_utenti);
        var json_list_online = { "utenti": "" };
        var counter = 0;
        console.log("lista inviata: " + util.inspect(users, false, null));
        for (var id in users) {
            json_list_online["utenti"] += users[id].email + "___";
            counter++;
            if(counter>=numero_utenti){
                break;
            }
          }
        // for (var i = 0, len = arrayDaUtenti.length; i < len; i++) {
        //     json_list_online["utenti"] += arrayDaUtenti[i] + "||";
        //   }
          json_list_online["utenti"] = json_list_online["utenti"].substring(0, json_list_online["utenti"].length - 3);
        io.in(socket.id).emit("lista_utenti_online", json_list_online);
        console.log("lista inviata: " + util.inspect(json_list_online, false, null)); 
    },
    inizia_partita: function (room_id, email, rooms, socket, io, mongoose) {
        var Phrase = mongoose.model('Phrase');
        console.log("l'utente " + email + " vuole iniziare la partita in stanza con id: " + room_id);
        room_id = socket.room.id;
        var frase;
        Phrase.findOne({
            utenti_passati: {
                $nin: rooms[room_id].arrayPlayersEmails()
            }
        }, function (err, frase) {
            if (err) {
                console.log("c'é un errore nella ricerca frase " + err);
                return done(err);
            }
            //aggiungo gli utenti a questa frase
            if (frase != null) {
                netfurio.addUsersToPhrase(socket, frase, mongoose);
            } else {
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
            Phrase.findOne({
                utenti_passati: {
                    $nin: rooms[room_id].arrayPlayersEmails()
                }
            }, function (err, frase) {
                if (err) {
                    console.log("c'é un errore nella ricerca frase " + err);
                    return done(err);
                }
                console.log("la nuova frase é " + util.inspect(frase, false, null));
                rooms[room_id].addPrhase(frase);
                //aggiungo gli utenti a questa frase
                if (frase !== null) {
                    netfurio.addUsersToPhrase(socket, frase, mongoose);
                } else {
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
        console.log(email + " ha scritto: " + netfurio.replace_accentate(frase));
        var room_id = socket.room.id;
        var frase_utente = new UserPhrase();
        frase_utente.completamento_frase = netfurio.replace_accentate(frase);
        frase_utente.turno = socket.room.turn;
        frase_utente.proprietario = email;
        var player = socket.room.getPlayer(email);
        player.phrase = frase_utente;
        socket.room.frasi_scritte_del_turno++;
        if (socket.room.frasi_scritte_del_turno == socket.room.players.length) { //tutte le frasi sono state scritte
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
            var json_list = {
                "utenti": "",
                "seconde_parti": ""
            };
            for (var i = 0, len = array_frasi_utenti.length; i < len; i++) {
                if (i == len - 1) {
                    json_list["utenti"] += array_frasi_utenti[i].proprietario;
                    json_list["seconde_parti"] += array_frasi_utenti[i].completamento_frase;
                } else {
                    json_list["utenti"] += array_frasi_utenti[i].proprietario + "___";
                    json_list["seconde_parti"] += array_frasi_utenti[i].completamento_frase + "___";
                }
            }
            console.log("json delle frasi: " + util.inspect(json_list, false, null));
            io.in(socket.room.id).emit("tutti_pronti", json_list); //invio il json con le frasi di tutti ai client
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
            if (socket.room.turn >= 3) { //&& socket.room.turn >= socket.room.players.length) {//regola ultimo turno

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
    fine_partita: function (preferenza, email, rooms, socket, io, mongoose) {
        console.log("mando who_win");
        io.in(socket.id).emit('who_win', socket.room.andTheWinnerIs());
    },
    distruggi_partita: function (msg, email, rooms, socket, io) {
        console.log("l'utente " + email + " sta distruggendo la stanza");
        delete rooms[msg];
        //console.log("lista stanze per vedere se ho rimosso quella con id: " + msg + " lista: " + util.inspect(rooms, false, null));
        io.sockets.in(msg).emit('partita_distrutta', 1);
        socket.leave(msg);
    }
}