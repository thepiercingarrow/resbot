var shuffle = require('knuth-shuffle').knuthShuffle;

var status = 'idle';
var status_mid;

var players;
var leader;

var spies;
const spy_num = [0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4];

var mission;
const mission_sizes = [
    [],
    [1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1],
    [1, 1, 1, 2, 2],
    [1, 1, 2, 2, 2],
    [2, 3, 2, 3, 3],
    [2, 3, 4, 3, 4],
    [2, 3, 3, 4, 4],
    [3, 4, 4, 5, 5],
    [3, 4, 4, 5, 5],
    [3, 4, 4, 5, 5]
];

var proposals = ['A', 'B', 'C', 'D', 'E'];
var proposal;

var team;

var voting_cids;
var voted;

var votes;
var accepted;

var vote_mid;

var mission_success;
var sabos;

var successes, failures;

module.exports = function(bot, config) {
    var resistance = {};
    resistance.onmsg = function(user, uid, cid, m, e) {
	if (m.substring(0, config.prefix.length) == config.prefix) {
	    var args = m.substring(config.prefix.length).trim().split(' ');
	    switch (args[0]) {
	    case 'newgame':
		if (status != 'idle' || cid != config.cid)
		    return;
		status = 'waiting for players';
		players = [];
		bot.sendMessage({
		    to: cid,
		    message: 'A game has been started by <@' + uid + '>. Smiley to join, Smile to start!'
		}, (err, res) => {
		    status_mid = res.id;
		    bot.addReaction({
			channelID: res.channel_id,
			messageID: status_mid,
			reaction: '😃'
		    });
		});
		break;
	    case 'stop':
		if (status != 'idle') {
		    bot.sendMessage({
			to: config.cid,
			message: 'Game stopped by <@' + uid + '>.'
		    });
		    status = 'idle';
		}
		break;
	    case 'propose':
		if (status != 'waiting for a proposal' || uid != players[leader].uid || cid != config.cid)
		    return;
		team = [];
		for (var i = 1; i < args.length; ++i) {
		    var member = parseInt(args[i]);
		    if (member != member || member < 0 || member >= players.length || args.length - 1 != mission_sizes[players.length][mission] || team.includes(member)) {
			bot.sendMessage({
			    to: cid,
			    message: 'Please submit a valid proposal.'
			});
			return;
		    }
		    team.push(member);
		}
		if (proposal == 4) {
		    status = 'mission';
		    bot.sendMessage({
			to: config.cid,
			message: 'Mission proposed:\n```' + team.map((a)=>(players[a].name)).join('\n') + '```\nSubmit your actions in DM.'
		    }, (err, res) => {
			for (var i = 0; i < players.length; ++i) {
			    bot.sendMessage({
				to: voting_cids[i],
				message: 'Reply `res/support` to support, `res/sabotage` to sabotage.'
			    });
			}
		    });
		}
		else {
		    bot.sendMessage({
			to: config.cid,
			message: 'Mission proposed:\n```' + team.map((a)=>(players[a].name)).join('\n') + '```\nVote to accept/reject in your DMs.'
		    }, (err, res) => {
			bot.sendMessage({
			    to: config.cid,
			    message: 'No votes yet.'
			}, (err, res) => {
			    vote_mid = res.id;
			});
		    });
		    voted = 0;
		    votes = [];
		    status = 'voting for proposal';
		    accepted = 0;
		    for (var i = 0; i < players.length; ++i) {
			bot.sendMessage({
			    to: voting_cids[i],
			    message: 'Mission proposed:\n```' + team.map((a)=>(players[a].name)).join('\n') + '```Reply `res/accept` to accept, `res/reject` to reject.'
			});
		    }
		}
		break;
	    case 'accept': case 'reject':
		if (status != 'voting for proposal')
		    return;
		if (votes[uid] != undefined || !voting_cids.includes(cid))
		    return;
		bot.sendMessage({
		    to: cid,
		    message: 'Vote received.'
		});
		votes[uid] = args[0];
		if (args[0] == 'accept')
		    ++accepted;
		bot.editMessage({
		    channelID: config.cid,
		    messageID: vote_mid,
		    message: 'Received votes from:\n```' + Object.keys(votes).map(uidtoname).join('\n') + '```'
		});
		++voted;
		if (voted == players.length) {
		    if (accepted > players.length / 2) {
			bot.sendMessage({
			    to: config.cid,
			    message: 'Voting over!\n```' + Object.keys(votes).map((a)=>(uidtoname(a) + ' voted ' + votes[a])).join('\n') + '```\nProposal accepted! Players in the mission - chose your actions over DM'
			}, (err, res) => {
			    bot.sendMessage({
			    	to: config.cid,
			    	message: 'No actions received yet.'
			    }, (err, res) => {
			    	vote_mid = res.id;
			    });
			});
			votes = [];
			voted = 0;
			status = 'mission';
			sabos = 0;
			for (var i = 0; i < team.length; ++i) {
			    bot.sendMessage({
				to: voting_cids[team[i]],
				message: 'Reply `res/support` to support, `res/sabotage` to sabotage.'
			    });
			}
		    }
		    else {
			++proposal;
			leader = (leader + 1) % players.length;
			bot.sendMessage({
			    to: config.cid,
			    message: 'Voting over!\n```' + Object.keys(votes).map((a)=>(uidtoname(a) + ' voted ' + votes[a])).join('\n') + '```\nProposal rejected!'
			}, (err, res) => {
			    status = 'waiting for a proposal';
			    bot.sendMessage({
				to: config.cid,
				message: 'New leader is ' + players[leader].name + '. Proposal: **' + mission + proposals[proposal] + '**, size: ' + mission_sizes[players.length][mission] + '. Please propose your team with res/propose <space seperated numbers>'
			    });
			});
		    }
		}
		break;
	    case 'support': case 'sabotage':
		if (status != 'mission')
		    return;
		if (votes[uid] != undefined || !voting_cids.includes(cid))
		    return;
		if (!team.includes(uidtoindex(uid))) {
		    bot.sendMessage({
			to: cid,
			message: 'You are not on the team !_!'
		    });
		    return;
		}
		if (args[0] == 'sabotage' && !spies.includes(uid)){
		    bot.sendMessage({
			to: cid,
			message: 'Rebels cannot sabotage the mission !_!'
		    });
		    return;
		}
		bot.sendMessage({
		    to: cid,
		    message: 'Action received.'
		});
		++voted;
		if (args[0] == 'sabotage')
		    ++sabos;
		votes[uid] = args[0];
		bot.editMessage({
		    channelID: config.cid,
		    messageID: vote_mid,
		    message: 'Received actions from:\n```' + Object.keys(votes).map(uidtoname).join('\n') + '```'
		});
		if (voted == team.length) {
		    if (players.length <= 6 || mission != 4)
			mission_success = sabos > 0 ? false : true;
		    else
			mission_success = sabos >= 2 ? false : true;
		    if (mission_success)
			++successes;
		    else
			++failures;
		    if (successes == 3 || failures == 3) {
			bot.sendMessage({
			    to: config.cid,
			    message: 'GAME OVER. **' + (successes == 3 ? 'rebels' : 'spies') + '** HAVE WON'
			}, (err, res) => {
			    bot.sendMessage({
				to: config.cid,
				message: 'Spies:\n```' + spies.map((a)=>(uidtoname(a))).join('\n') + '```'
			    });
			});
			return;
		    }
		    bot.sendMessage({
			to: config.cid,
			message: 'Mission completed: ' + (mission_success ? '**success!** ' : '**failure!** ') + sabos + ' sabotages.'
		    }, (err, res) => {
			leader = (leader + 1) % players.length;
			++mission;
			proposal = 0;
			bot.sendMessage({
			    to: config.cid,
			    message: 'Leader is ' + players[leader].name + '. Proposal: **' + mission + proposals[proposal] + '**, size: ' + mission_sizes[players.length][mission] + '. Please propose your team with res/propose <space seperated numbers>'
			});
			status = 'waiting for a proposal';
		    });
		}
		break;
	    }
	}
    };
    resistance.onreac = function(reac){
	switch (status) {
	case 'waiting for players':
	    if (reac.message_id == status_mid && reac.emoji.name == '😃') {
		if (players.map((a)=>(a.uid)).includes(reac.user_id))
		    return;
		players.push({
		    name: bot.users[reac.user_id].username + '#' + bot.users[reac.user_id].discriminator,
		    uid: reac.user_id
		});
		bot.addReaction({
		    channelID: config.cid,
		    messageID: status_mid,
		    reaction: '😄'
		});
		status = 'waiting to start';
	    }
	    break;
	case 'waiting to start':
	    if (reac.message_id == status_mid) {
		if (reac.emoji.name == '😃') {
		    players.push({
			name: bot.users[reac.user_id].username + '#' + bot.users[reac.user_id].discriminator,
			uid: reac.user_id
		    });
		}
		else if (reac.emoji.name == '😄') {
		    shuffle(players);
		    for (var i = 0; i < players.length; ++i)
			players[i].name = i.toString() + ': ' + players[i].name;
		    bot.sendMessage({
			to: config.cid,
			message: 'Game started by <@' + reac.user_id + '>. ```Players:\n' + players.map((a)=>(a.name)).join('\n') + '```'
		    }, (err, res) => {
			leader = 0;
			mission = 1;
			proposal = 0;
			spies = shuffle(players.slice()).slice(0,spy_num[players.length]).map((a)=>(a.uid));
			voting_cids = [];
			successes = failures = 0;
			for (var i = 0; i < players.length; ++i) {
			    bot.createDMChannel(players[i].uid, (err, res) => {
				voting_cids[uidtoindex(res.recipient.id)] = res.id;
				bot.sendMessage({
				    to: res.id,
				    message: 'You are a ' + (spies.includes(res.recipient.id) ? ('spy. Spies:\n```' + spies.map((a)=>(uidtoname(a))).join('\n') + '```') : 'rebel.')
				});
			    });
			}
			status = 'waiting for a proposal';
			bot.sendMessage({
			    to: config.cid,
			    message: 'Leader is ' + players[leader].name + '. Proposal: **' + mission + proposals[proposal] + '**, size: ' + mission_sizes[players.length][mission] + '. Please propose your team with res/propose <space seperated numbers>'
			});
		    });
		}
	    }
	    break;
	}
    };
    return resistance;
};

function uidtoindex(uid) {
    return players.map((a)=>(a.uid)).indexOf(uid);
}

function uidtoname(uid) {
    return players[uidtoindex(uid)].name;
}
