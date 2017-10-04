var Discord = require('discord.io');

var config = require('../config.json');

var client = new Discord.Client({
    token: config.token,
    autorun: true
});

var resistance = require('./resistance.js')(client, config);

client.on('ready', function() {
    console.log('Connected');
    console.log('username: ' + client.username);
    console.log('client id: ' + client.id);
});

client.on('disconnect', function(emsg, ecode) {
    client.connect();
});

client.on('message', resistance.onmsg);

client.on('any', e => {
    if (e.t == 'MESSAGE_REACTION_ADD') {
	if (e.d.user_id != '363865165680345088')
	    resistance.onreac(e.d);
    }
});
