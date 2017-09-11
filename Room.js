var md5 = require('md5');
var Player = require('./Player');
module.exports = class Room {
  constructor(email, rooms) {
    this.turn = 1;
    var progressivo_stanza = rooms.length + 1;
    this.active = false;
    this.id = md5(progressivo_stanza + email);
    this.players = [];//lista giocatori
    this.phrase = {};//la frase del turno
    this.frasi_scritte_del_turno = 0;
    this.player_ready_for_next_turn = 0;
    this.voted = 0;
    this.map_of_shuffle = {};
  }
  addPlayer(email){
    var player = new Player();
    player.email = email;
    player.nome = email;
    this.players.push(player);
  }
  getPlayer(email){
    for (var i = 0, len = this.players.length; i < len; i++) {
      if(this.players[i].email == email){
        return this.players[i];
      }
    }
    return null;
  }
  addPrhase(phrase) {
    this.phrase = phrase;
  }
  vote(email_voter, index_voted) {
    if (index_voted < 0) {
      var player = this.getPlayer(email_voter);
      if(player.phrase.voto == undefined){
        player.phrase.voto = []; 
      }
      player.phrase.voto.push("ha azzeccato!");
      player.punti++;
      var email_voted = "giusto";
    } else {
      console.log('index_voted '  + index_voted + ' map_of_shuffle ' + this.map_of_shuffle[index_voted] + ' this.map_of_shuffle ' + this.map_of_shuffle[index_voted] );
      var email_voted = this.map_of_shuffle[index_voted];
      var player_voted = this.getPlayer(email_voted);
      if(player_voted.phrase.voto == undefined){
        player_voted.phrase.voto = []; 
      }
      player_voted.phrase.voto.push(email_voter);
      player_voted.punti++;
    }
    console.log(email_voter + " ha votato " + email_voted);
  }
  scoreboard() {
    var scores = {};
    for (var i = 0, len = this.players.length; i < len; i++) {
      scores[this.players[i].email] = {
        'points': this.players[i].punti,
        'voto': this.players[i].phrase.voto,
        'nome': this.players[i].email
      };
      this.frasi_scritte_del_turno = 0;
    }
    console.log(scores);
    return scores;
  }
  find_phrase_index_by_owner(array_phrases,email_owner){
    for (var i = 0, len = array_phrases.length; i < len; i++) {
      console.log("array_phrases[i].proprietario " + array_phrases[i].proprietario + " email_owner " + email_owner);
      if (array_phrases[i].proprietario == email_owner) {
        return i;
      }
    }
    return -1;
  }
  arrayPlayersEmails(){
    var array_players_emails = [];
    for (var i = 0, len = this.players.length; i < len; i++) {
      array_players_emails.push(this.players[i].email);
    }
    return array_players_emails;
  }
  arrayPlayersPhrases(){
    var array_players_phrases = [];
    for (var i = 0, len = this.players.length; i < len; i++) {
      array_players_phrases.push(this.players[i].phrase);
    }
    return array_players_phrases; 
  }
  creaMapOfShuffle(array_frasi_mischiate){
    for (var i = 0, len = array_frasi_mischiate.length; i < len; i++) {
      this.map_of_shuffle[i] = array_frasi_mischiate[i].proprietario;
    }
  }
  andTheWinnerIs(){
    var punti_top = 0;
    var vincitore = null;
    var vincitori = [];
    for (var i = 0, len = this.players.length; i < len; i++) {//trovo il tizio con piú punti (o a parimerito)
      if(this.players[i].punti > punti_top){
        vincitore = this.players[i];
        punti_top = vincitore.punti
      };
    }
    vincitori.push(vincitore);
    for (var i = 0, len = this.players.length; i < len; i++) {//trovo eventuali tizi a parimerito
      if(this.players[i].punti === punti_top){
        vincitori.push(this.players[i]);
      }
    }
    var json_vincitori = {}
    var punti = 0;
    var nomi = "";
    for(var i =0,len = vincitori.length;i<len;i++ ){
        punti = vincitori[i].punti;
        if(nomi.indexOf(vincitori[i].email)){
            nomi += (i==0? "":",") + vincitori[i].email;
        }
        
    }
    json_vincitori = {'nome': nomi, 'punti': punti};
    return json_vincitori;
  }
}
