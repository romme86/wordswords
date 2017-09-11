module.exports = {
  cerca_stanza: function (rooms) {
    rooms.forEach(function (element) {
      if (element.length <= 3) {
        return element.id;
      }
    }, this);
    return false;
  },
  cerca_room_per_id: function (array_rooms, room_id) {
    for (var i = 0, len = array_rooms.length; i < len; i++) {
      if (array_rooms[i].id == room_id) {
        return i;
      }
    }
    return -1;
  },
  cerca_room_per_email: function (array_rooms, user_email, util) {//probabilmente inutilizzata
    for (var i = 0, len = array_rooms.length; i < len; i++) {
      for (var k = 0, lenk = array_rooms[i].players.length; k < lenk; k++) {
        if (array_rooms[i].players[k].email == user_email) {
          console.log("room trovata: ");
          return i;
        }
      }

    }
    console.log("room NON trovata: " + util.inspect(array_rooms, false, null));
    return -1;
  },
  room_exists: function (array_stanze, room_id) {
    for (var i = 0, len = array_stanze.length; i < len; i++) {
      if (array_stanze[i].id == room_id) {
        return true;
      }
    }
    return false;
    rooms.forEach(function (element) {
      if (element.id == room_id) {
        return true;
      }
    }, this);
    return false;
  },
  rimuovi_stanza: function (array_stanze, stanza) {
    for (var i = 0, len = array_stanze.length; i < len; i++) {
      if (array_stanze[i].id == stanza.id) {
        array_stanze.splice(i, 1);
        return true;
      }
    }
    return false;
  },
  lista_utenti: function (stanza) {
    var json_list = { "utenti": "" };
    for (var i = 0, len = stanza.players.length; i < len; i++) {
      if (i != len) {
        json_list["utenti"] += stanza.players[i].email + ",";
      } else {
        json_list["utenti"] += stanza.players[i].email;
      }
    }
    return json_list;
  },
  cerca_utente_per_email_in_users: function (users, email) {
    for (socketId in users) {
      if (users[socketId].email === email) {
        return socketId;
      }
    }
    return false;
  },
  mischia: function (a) {//ty community wiki stackoverflow    
    var j, x, i;
    for (i = a.length; i; i--) {
      j = Math.floor(Math.random() * i);
      x = a[i - 1];
      a[i - 1] = a[j];

      a[j] = x;
    }
  },
  find_room_in_socket_list_by_user_email: function (email, users) {
    for (socketId in users) {
      if (users[socketId].email === email) {
        return socketId;
      }
    }
    return false;
  },
  addUser(lista_utenti, email, socket_id) {
    //cerco se l'user é nella lista e se c'é lo sputtano
    for (old_socket_id in lista_utenti) {
      if (lista_utenti[old_socket_id].email === email) {
        delete lista_utenti[old_socket_id];
      }
    }
    lista_utenti[socket_id] = { 'email': email };
  },
  addUsersToPhrase(socket, frase, mongoose, debug = false) {
    if (!debug) {
      var lista_utenti = socket.room.arrayPlayersEmails();
      for (var i = 0, len = lista_utenti.length; i < len; i++) {
        frase.utenti_passati.push(lista_utenti[i]);
      }
      frase.save(function (err, frase) {
        if (err) {
          return handleError(err);
          console.log("frase salvata");
        }
      });
    }
  },
  replace_accentate: function(stringa){
	 stringa  = stringa.replace("é","e\'");
	 stringa  = stringa.replace("á","a\'");
	 stringa  = stringa.replace("í","i\'");
	 stringa  = stringa.replace("ó","o\'");
	 stringa  = stringa.replace("ú","u\'");
	 stringa  = stringa.replace("è","e\'");
	 stringa  = stringa.replace("à","a\'");
	 stringa  = stringa.replace("ì","i\'");
	 stringa  = stringa.replace("ò","o\'");
	 stringa  = stringa.replace("ù","u\'");
	 return stringa;
  }
}