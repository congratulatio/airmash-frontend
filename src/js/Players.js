import Player from './Player';
import Vector from './Vector';

/** @type {Object<number, Player>} */
let playersById = {};

let lastTopPlayerIds = [-1, -1, -1];

const badgeTextures = ["badge_gold", "badge_silver", "badge_bronze"];

/**
 * Update all players for current frame
 */
Players.update = function() {
    /** @type {Player} */
    let player;

    // Update all players
    for (player of playersById) {
        if (player.status == 0) {
            player.update(game.timeFactor);
            player.updateGraphics(game.timeFactor);
        }
    }

    // If spectating, follow spectated player with camera
    if (game.spectatingID != null) {
        let player = playersById[game.spectatingID]
        if (player == null)
            return;
        if (game.timeNetwork - player.lastPacket > 3000)
            return;
        Graphics.setCamera(player.pos.x, player.pos.y)
    }

    // Otherwise, follow playing player with camera and update HUD
    else if (game.myID != null) {
        let player = playersById[game.myID];
        if (player == null)
            return;
        if (player.status == 0) {
            UI.updateHUD(player.health, player.energy, player);
            Graphics.setCamera(player.pos.x, player.pos.y);
        }
    }
};

/**
 * Add new player
 * 
 * Called from LOGIN and PLAYER_NEW message handlers
 */
Players.add = function(player, fromLogin) {
    playersById[player.id] = new Player(player, fromLogin);

    if (game.state === Network.STATE.PLAYING) {
        UI.updateGameInfo();
    }
};

Players.get = function(id) {
    return playersById[id];
};

Players.getMe = function() {
    return playersById[game.myID];
};

Players.amIAlive = function() {
    let player = Players.getMe();
    return player && player.status == 0;
};

Players.getIDs = function() {
    let ids = {};
    for (let id in playersById) {
        ids[id] = true;
    }
    return ids;
};

Players.getByName = function(name) {
    for (let id in playersById) {
        if (playersById[id].name === name) {
            return playersById[id];
        }
    }
    return null;
};

/**
 * Message handler
 */
Players.network = function(type, msg) {
    let player = playersById[msg.id];
    if (player) {
        switch (type) {
            case Network.SERVERPACKET.PLAYER_UPDATE:
            case Network.SERVERPACKET.PLAYER_FIRE:
            case Network.SERVERPACKET.EVENT_BOOST:
            case Network.SERVERPACKET.EVENT_BOUNCE:
                player.networkKey(type, msg);
                break;
            case Network.SERVERPACKET.CHAT_SAY:
                player.sayBubble(msg);
                break;
            case Network.SERVERPACKET.PLAYER_RESPAWN:
                player.respawn(msg);
                UI.updateGameInfo();
                break;
            case Network.SERVERPACKET.PLAYER_FLAG:
                if (msg.id == game.myID) {
                    game.myFlag = game.lastFlagSet;
                    Tools.setSettings({
                        flag: game.lastFlagSet
                    });
                }
                player.changeFlag(msg);
                break;
        }
    }
};

/**
 * EVENT_STEALTH message handler
 */
Players.stealth = function(msg) {
    let player = playersById[msg.id];
    if (player) { 
        player.stealth(msg);
    }
};

/**
 * EVENT_LEAVEHORIZON message handler
 */
Players.leaveHorizon = function(msg) {
    let player = playersById[msg.id];
    if (player) {
        player.leaveHorizon();
    }
};

/**
 * SCORE_BOARD message handler
 */
Players.updateBadges = function(scores) {
    let topScoreCount = Tools.clamp(scores.length, 0, 3);
    let newTopPlayerIds = [];

    // Assign badges to top players
    for (let i = 0; i < topScoreCount; i++) {
        let player = playersById[scores[i].id];
        if (player) {
            newTopPlayerIds.push(player.id);
            if (player.state.badge != i) {
                player.state.badge = i;
                player.changeBadge(badgeTextures[i]);
            }
            if (!player.state.hasBadge) {
                player.state.hasBadge = true;
                if (player.render) {
                    player.sprites.badge.visible = true;
                }
            }
        }
    }

    // Remove badges from players who are not up top
    for (let id of lastTopPlayerIds) {
        if (newTopPlayerIds.indexOf(id) == -1) {
            let player = playersById[id];
            if (!player) {
                continue;
            }
            if (player.state.hasBadge) {
                player.state.hasBadge = false;
                player.sprites.badge.visible = false;
            }
        }
    }

    lastTopPlayerIds = newTopPlayerIds;
};

/**
 * CHAT_PUBLIC message handler
 */
Players.chat = function(msg) {
    let player = playersById[msg.id];
    if (player) {
        UI.addChatLine(player, msg.text, 0);
    }
};

/**
 * CHAT_TEAM message handler
 */
Players.teamChat = function(msg) {
    let player = playersById[msg.id];
    if (player) {
        UI.addChatLine(player, msg.text, 3);
    }
};

/**
 * CHAT_VOTEMUTEPASSED message handler
 */
Players.votemutePass = function(msg) {
    let player = playersById[msg.id];
    if (player) {
        UI.chatVotemutePass(player);
    }
};

/**
 * CHAT_WHISPER message handler
 */
Players.whisper = function(msg) {
    let chatType, player;
    if (msg.to == game.myID) {
        player = playersById[msg.from];
        if (!player) {
            return;
        }
        chatType = 2;
    } else {
        player = playersById[msg.to];
        if (!player) {
            return;
        }
        chatType = 1;
    }
    UI.addChatLine(player, msg.text, chatType);
};

/**
 * PLAYER_HIT message handler
 */
Players.impact = function(msg) {
    for (let i = 0; i < msg.players.length; i++) {
        let player = playersById[msg.players[i].id];
        if (player) {
            player.impact(msg.type, new Vector(msg.posX, msg.posY), msg.players[i].health, msg.players[i].healthRegen);
        }
    }
};

/**
 * PLAYER_POWERUP message handler 
 */
Players.powerup = function(msg) {
    Players.getMe().powerup(msg);
};

/**
 * PLAYER_LEVEL message handler
 */
Players.updateLevel = function(msg) {
    var player = playersById[msg.id];
    if (player != null) {
        player.updateLevel(msg);
    }
};

/**
 * PLAYER_RETEAM message handler
 */
Players.reteam = function(msg) {
    let player = playersById[msg.id];
    if (player != null) {
        player.reteam(msg.team);
    }

    UI.updateGameInfo();
};

/**
 * PLAYER_KILL message handler
 */
Players.kill = function(msg) {
    let player = playersById[msg.id];
    if (!player) {
        return;
    }

    if (msg.killer != 0 || msg.posX != 0 || msg.posY != 0) {
        player.kill(msg);
        if (player.me()) {
            UI.visibilityHUD(false);
            let killer = playersById[msg.killer];
            if (killer) {
                UI.killedBy(killer);
            }
            UI.showSpectator('<div onclick="Network.spectateNext()" class="spectate">ENTER SPECTATOR MODE</div>');
        } 
        else if (msg.killer === game.myID) {
            UI.killed(player);
        }
        if (!player.me() && player.id === game.spectatingID && game.gameType !== GameType.BTR) {
            Games.spectatorSwitch(player.id);
        }
    } 
    else {
        player.kill({
            posX: 0,
            posY: 0,
            spectate: true
        });
        UI.visibilityHUD(false);
        UI.updateGameInfo();
    }
};

/**
 * PLAYER_LEAVE message handler
 */
Players.destroy = function(id) {
    if (id == game.spectatingID) {
        $("#spectator-tag").html("Spectating");
        Games.spectatorSwitch(id);
    }

    let player = playersById[id];
    if (player != null) {
        player.destroy(true);
        delete playersById[id];

        if (game.state === Network.STATE.PLAYING) {
            UI.updateGameInfo();
        }
    }
};

/**
 * PLAYER_TYPE message handler
 */
Players.changeType = function(msg) {
    let player = playersById[msg.id];
    if (player) {
        player.changeType(msg);
    }
};

Players.count = function() {
    let totalPlayers = 0, culledPlayers = 0;

    for (let id in playersById) {
        totalPlayers++;
        if (playersById[id].culled) {
            culledPlayers++;
        }
    }

    return [totalPlayers - culledPlayers, totalPlayers];
};

Players.playerBotCount = function() {
    let counts = {
        players: 0,
        bots: 0,
        blueTeam: 0,
        redTeam: 0,
        notPlaying: 0
    }

    for (let id in playersById) {
        let player = playersById[id];

        if (player.bot) {
            // Special case the ab-server bot name to exclude, as it doesn't play
            if (player.name !== 'Server') {
                counts.bots++
            }
        }
        else {
            counts.players++;

            if (!player.isOnMap()) {
                counts.notPlaying++;
            }
            else {
                if (player.team === 1) {
                    counts.blueTeam++;
                }
                else if (player.team === 2) {
                    counts.redTeam++;
                }
            }
        }
    }

    return counts;
}

/**
 * Remove all players
 * 
 * Called when connecting to a new game server
 */
Players.wipe = function() {
    for (let id in playersById) {
        playersById[id].destroy(true);
        delete playersById[id];
    }
};
