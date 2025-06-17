const config = require('../../config/config.json');
const fs = require('fs-extra');
const path = require('path');
const logger = require('../../includes/logger');
const { createCanvas } = require('canvas');
const { connect } = require('../../includes/database/index');

function drawConnectFour(gameData) {
    const { board, currentPlayer, gameStatus, playerNames } = gameData;
    const canvas = createCanvas(700, 600);
    const ctx = canvas.getContext('2d');

   
    ctx.fillStyle = '#F0F2F5';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = 'bold 30px Arial';
    ctx.fillStyle = '#404040';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Connect Four', canvas.width / 2, 30);


    const cellSize = 80;
    const offsetX = (canvas.width - 7 * cellSize) / 2;
    const offsetY = 80; 


    ctx.fillStyle = '#1E90FF';
    ctx.fillRect(offsetX, offsetY, 7 * cellSize, 6 * cellSize);


    for (let row = 0; row < 6; row++) {
        for (let col = 0; col < 7; col++) {
            const x = offsetX + col * cellSize + cellSize / 2;
            const y = offsetY + row * cellSize + cellSize / 2;

            ctx.beginPath();
            ctx.arc(x, y, cellSize / 2 - 5, 0, Math.PI * 2);
            if (board[row][col] === 'R') {
                ctx.fillStyle = '#FF0000'; 
            } else if (board[row][col] === 'Y') {
                ctx.fillStyle = '#FFFF00'; 
            } else {
                ctx.fillStyle = '#FFFFFF'; 
            }
            ctx.fill();
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    }

  
    ctx.font = '20px Arial';
    ctx.fillStyle = '#000';
    for (let col = 0; col < 7; col++) {
        const x = offsetX + col * cellSize + cellSize / 2;
        ctx.fillText((col + 1).toString(), x, offsetY - 20);
    }

  
    ctx.font = '20px Arial';
    ctx.fillStyle = '#404040';
    if (gameStatus) {
        ctx.fillText(gameStatus, canvas.width / 2, offsetY + 6 * cellSize + 30);
    } else {
        const playerColor = currentPlayer === 'R' ? 'Red' : 'Yellow';
        ctx.fillText(`${playerNames[currentPlayer]} (${playerColor})'s Turn (Reply with a column 1-7)`, canvas.width / 2, offsetY + 6 * cellSize + 30);
    }

    const filePath = path.join(__dirname, `../../temp/connectfour_${Date.now()}.png`);
    const out = fs.createWriteStream(filePath);
    const stream = canvas.createPNGStream();
    stream.pipe(out);

    return new Promise((resolve) => {
        out.on('finish', () => {
            resolve({
                imageStream: fs.createReadStream(filePath),
                filePath
            });
        });
        out.on('error', (err) => {
            logger.error(`Error writing Connect Four image: ${err.message}`);
            resolve(null);
        });
    });
}

function checkWin(board, player) {

    for (let row = 0; row < 6; row++) {
        for (let col = 0; col <= 3; col++) {
            if (board[row][col] === player &&
                board[row][col + 1] === player &&
                board[row][col + 2] === player &&
                board[row][col + 3] === player) {
                return true;
            }
        }
    }

    
    for (let row = 0; row <= 2; row++) {
        for (let col = 0; col < 7; col++) {
            if (board[row][col] === player &&
                board[row + 1][col] === player &&
                board[row + 2][col] === player &&
                board[row + 3][col] === player) {
                return true;
            }
        }
    }


    for (let row = 0; row <= 2; row++) {
        for (let col = 0; col <= 3; col++) {
            if (board[row][col] === player &&
                board[row + 1][col + 1] === player &&
                board[row + 2][col + 2] === player &&
                board[row + 3][col + 3] === player) {
                return true;
            }
        }
    }


    for (let row = 0; row <= 2; row++) {
        for (let col = 3; col < 7; col++) {
            if (board[row][col] === player &&
                board[row + 1][col - 1] === player &&
                board[row + 2][col - 2] === player &&
                board[row + 3][col - 3] === player) {
                return true;
            }
        }
    }

    return false;
}

function isBoardFull(board) {
    return board[0].every(cell => cell !== '');
}

function convertTime(ms) {
    const days = Math.floor(ms / (24 * 60 * 60 * 1000));
    ms %= (24 * 60 * 60 * 1000);
    const hours = Math.floor(ms / (60 * 60 * 1000));
    ms %= (60 * 60 * 1000);
    const minutes = Math.floor(ms / (60 * 1000));
    ms %= (60 * 1000);
    const seconds = Math.floor(ms / 1000);
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

module.exports = {
    name: "connectfour",
    version: "1.0.0",
    author: "Hridoy",
    description: "A Connect Four game for two players.",
    adminOnly: false,
    commandCategory: "games",
    guide: "Use {pn}connectfour @player to start a game\n{pn}connectfour rank [page] to see leaderboard\n{pn}connectfour info [userID/@mention] to see user stats\n{pn}connectfour reset to reset leaderboard (admin only)",
    cooldowns: 5,
    usePrefix: true,

    async execute({ api, event, args }) {
        try {
            const db = await connect();
            const gameDataCollection = db.collection('connectfour');


            if (args[0] === "rank") {
                const rankData = await gameDataCollection.find({}).toArray();
                if (!rankData.length) {
                    return api.sendMessage(`${config.bot.botName}: No scores available.`, event.threadID);
                }

                const page = parseInt(args[1]) || 1;
                const maxUserOnePage = 30;
                let rankDataHandle = await Promise.all(
                    rankData.slice((page - 1) * maxUserOnePage, page * maxUserOnePage).map(async item => {
                        const userInfo = await new Promise((resolve) => {
                            api.getUserInfo(item.id, (err, info) => resolve(err ? {} : info));
                        });
                        return {
                            ...item,
                            userName: userInfo[item.id]?.name || "Unknown User",
                            winNumber: item.wins?.length || 0,
                            lossNumber: item.losses?.length || 0
                        };
                    })
                );

                rankDataHandle = rankDataHandle.sort((a, b) => b.winNumber - a.winNumber);
                const medals = ["🥇", "🥈", "🥉"];
                const rankText = rankDataHandle.map((item, index) => {
                    const medal = medals[index] || (index + 1);
                    return `${medal} ${item.userName} - ${item.winNumber} wins - ${item.lossNumber} losses`;
                }).join("\n");

                return api.sendMessage(
                    `${config.bot.botName}: Leaderboard\n\n${rankText || "No scores available."}\n\nPage ${page} of ${Math.ceil(rankData.length / maxUserOnePage)}`,
                    event.threadID
                );
            } else if (args[0] === "info") {
                let targetID;
                if (event.mentions && Object.keys(event.mentions).length) {
                    targetID = Object.keys(event.mentions)[0];
                } else if (event.messageReply) {
                    targetID = event.messageReply.senderID;
                } else if (!isNaN(args[1])) {
                    targetID = args[1];
                } else {
                    targetID = event.senderID;
                }

                const userData = await gameDataCollection.findOne({ id: targetID });
                if (!userData) {
                    return api.sendMessage(`${config.bot.botName}: User not found: ${targetID}`, event.threadID);
                }

                const userInfo = await new Promise((resolve) => {
                    api.getUserInfo(targetID, (err, info) => resolve(err ? {} : info));
                });
                const userName = userInfo[targetID]?.name || "Unknown User";
                const pointsReceived = userData.points || 0;
                const winNumber = userData.wins?.length || 0;
                const playNumber = winNumber + (userData.losses?.length || 0);
                const lossNumber = userData.losses?.length || 0;
                const winRate = playNumber > 0 ? (winNumber / playNumber * 100).toFixed(2) : 0;
                const playTime = convertTime(
                    (userData.wins?.reduce((a, b) => a + b.timePlayed, 0) || 0) +
                    (userData.losses?.reduce((a, b) => a + b.timePlayed, 0) || 0)
                );

                return api.sendMessage(
                    `${config.bot.botName}: Stats for ${userName}\n` +
                    `Points: ${pointsReceived}\n` +
                    `Games Played: ${playNumber}\n` +
                    `Wins: ${winNumber}\n` +
                    `Losses: ${lossNumber}\n` +
                    `Win Rate: ${winRate}%\n` +
                    `Total Play Time: ${playTime}`,
                    event.threadID
                );
            } else if (args[0] === "reset") {
                const adminIDs = config.bot.adminIDs || [];
                if (!adminIDs.includes(event.senderID)) {
                    return api.sendMessage(`${config.bot.botName}: You do not have permission to reset the leaderboard.`, event.threadID);
                }
                await gameDataCollection.deleteMany({});
                return api.sendMessage(`${config.bot.botName}: Leaderboard reset successfully.`, event.threadID);
            }


            const mentions = Object.keys(event.mentions);
            if (mentions.length !== 1) {
                return api.sendMessage(`${config.bot.botName}: Please mention one player to start a Connect Four game (e.g., .connectfour @player).`, event.threadID);
            }

            const player1 = event.senderID; 
            const player2 = mentions[0]; 
            if (player1 === player2) {
                return api.sendMessage(`${config.bot.botName}: You cannot play against yourself!`, event.threadID);
            }

            const player1Info = await new Promise((resolve) => api.getUserInfo(player1, (err, info) => resolve(err ? {} : info)));
            const player2Info = await new Promise((resolve) => api.getUserInfo(player2, (err, info) => resolve(err ? {} : info)));
            const player1Name = player1Info[player1]?.name || "Player 1";
            const player2Name = player2Info[player2]?.name || "Player 2";

            const gameData = {
                board: Array(6).fill().map(() => Array(7).fill('')),
                currentPlayer: 'R', 
                players: {
                    R: player1,
                    Y: player2
                },
                playerNames: {
                    R: player1Name,
                    Y: player2Name
                },
                timeStart: Date.now(),
                gameStatus: null // null (ongoing), "Red wins", "Yellow wins", or "Draw"
            };

            const imageData = await drawConnectFour(gameData);
            if (!imageData) {
                return api.sendMessage(`${config.bot.botName}: Failed to start the game.`, event.threadID);
            }

            const messageData = await new Promise((resolve) => {
                api.sendMessage(
                    `${config.bot.botName}: Connect Four Game Started!\n${player1Name} (Red) vs ${player2Name} (Yellow)`,
                    event.threadID,
                    (err, info) => {
                        if (err) {
                            logger.error(`Error sending game start message: ${err.message}`);
                            resolve(null);
                        } else {
                            logger.info(`Game start message sent: ${info.messageID}`);
                            resolve(info);
                        }
                    }
                );
            });

            if (!messageData) {
                return api.sendMessage(`${config.bot.botName}: Failed to start the game due to message sending error.`, event.threadID);
            }

            gameData.messageData = messageData;

            const gameImageMessage = await new Promise((resolve, reject) => {
                api.sendMessage(
                    { attachment: imageData.imageStream },
                    event.threadID,
                    (err, info) => {
                        if (err) {
                            logger.error(`Error sending game image: ${err.message}`);
                            reject(err);
                        } else {
                            logger.info(`Game image sent: ${info.messageID}`);
                            resolve(info);
                        }
                    }
                );
            });

            global.replyHandlers = global.replyHandlers || new Map();
            global.replyHandlers.set(gameImageMessage.messageID, {
                commandName: "connectfour",
                messageID: gameImageMessage.messageID,
                gameData
            });

            logger.info(`Reply handler set for message ID: ${gameImageMessage.messageID}`);

            try {
                await fs.unlink(imageData.filePath);
                logger.info(`Deleted temporary file: ${imageData.filePath}`);
            } catch (err) {
                logger.error(`Failed to delete temporary file: ${err.message}`);
            }

            logger.info(`Started Connect Four game for ${player1Name} (Red) vs ${player2Name} (Yellow) in thread ${event.threadID}`);
        } catch (err) {
            logger.error(`Error in execute: ${err.message}`);
            try {
                await api.sendMessage(`${config.bot.botName}: An error occurred while starting the game. Please try again.`, event.threadID);
            } catch (sendErr) {
                logger.error(`Failed to send error message: ${sendErr.message}`);
            }
        }
    },

    async onReply({ api, event }) {
        try {
            logger.info(`onReply triggered for message ID: ${event.messageReply.messageID}`);

            if (!global.replyHandlers || !global.replyHandlers.has(event.messageReply.messageID)) {
                logger.warn(`No reply handler found for message ID: ${event.messageReply.messageID}`);
                return;
            }

            const replyData = global.replyHandlers.get(event.messageReply.messageID);
            const { gameData } = replyData;

            logger.info(`Processing reply for Connect Four game between ${gameData.playerNames.R} (Red) and ${gameData.playerNames.Y} (Yellow)`);

         
            if (gameData.gameStatus) {
                logger.info(`Game already ended: ${gameData.gameStatus}`);
                return api.sendMessage(`${config.bot.botName}: The game has already ended! Start a new game with .connectfour @player.`, event.threadID);
            }

  
            const expectedPlayer = gameData.players[gameData.currentPlayer];
            if (event.senderID !== expectedPlayer) {
                logger.info(`Wrong player: ${event.senderID} attempted to play, but it's ${expectedPlayer}'s turn`);
                return api.sendMessage(`${config.bot.botName}: It's ${gameData.playerNames[gameData.currentPlayer]} (${gameData.currentPlayer === 'R' ? 'Red' : 'Yellow'})'s turn!`, event.threadID);
            }

         
            const column = parseInt(event.body) - 1;
            if (isNaN(column) || column < 0 || column > 6) {
                logger.info(`Invalid move by ${event.senderID}: ${event.body}`);
                return api.sendMessage(`${config.bot.botName}: Please reply with a column number between 1 and 7.`, event.threadID);
            }

         
            let row = 5;
            while (row >= 0 && gameData.board[row][column] !== '') {
                row--;
            }

            if (row < 0) {
                logger.info(`Column ${column + 1} is full for ${event.senderID}`);
                return api.sendMessage(`${config.bot.botName}: That column is full! Choose another column.`, event.threadID);
            }


            gameData.board[row][column] = gameData.currentPlayer;

    
            if (checkWin(gameData.board, gameData.currentPlayer)) {
                gameData.gameStatus = `${gameData.playerNames[gameData.currentPlayer]} (${gameData.currentPlayer === 'R' ? 'Red' : 'Yellow'}) Wins!`;
            } else if (isBoardFull(gameData.board)) {
                gameData.gameStatus = "It's a Draw!";
            } else {
     
                gameData.currentPlayer = gameData.currentPlayer === 'R' ? 'Y' : 'R';
            }


            const imageData = await drawConnectFour(gameData);
            if (!imageData) {
                logger.error(`Failed to draw Connect Four board for user ${event.senderID}`);
                return api.sendMessage(`${config.bot.botName}: Failed to update the game board.`, event.threadID);
            }

     
            try {
                await api.unsendMessage(event.messageReply.messageID);
                logger.info(`Unsent previous game image: ${event.messageReply.messageID}`);
            } catch (err) {
                logger.error(`Failed to unsend previous game image: ${err.message}`);
            }

          
            if (gameData.gameStatus) {
                try {
                    await api.unsendMessage(gameData.messageData.messageID);
                    logger.info(`Unsent initial game message: ${gameData.messageData.messageID}`);
                } catch (err) {
                    logger.error(`Failed to unsend initial game message: ${err.message}`);
                }

                const db = await connect();
                const gameDataCollection = db.collection('connectfour');
                const timePlayed = Date.now() - gameData.timeStart;

                const player1 = gameData.players.R;
                const player2 = gameData.players.Y;
                const rewardPoint = 50;

                try {
                    if (gameData.gameStatus.includes("Draw")) {
                     
                        for (const playerID of [player1, player2]) {
                            const userData = await gameDataCollection.findOne({ id: playerID });
                            const data = { timePlayed, date: new Date().toISOString() };
                            if (!userData) {
                                await gameDataCollection.insertOne({
                                    id: playerID,
                                    wins: [],
                                    losses: [data],
                                    points: 0
                                });
                                logger.info(`New user data created for ${playerID}: Draw recorded`);
                            } else {
                                await gameDataCollection.updateOne(
                                    { id: playerID },
                                    { $push: { losses: data } }
                                );
                                logger.info(`Updated user data for ${playerID}: Draw recorded`);
                            }
                        }
                    } else {
                        const winnerID = gameData.players[gameData.currentPlayer];
                        const loserID = gameData.players[gameData.currentPlayer === 'R' ? 'Y' : 'R'];

        
                        const winnerData = await gameDataCollection.findOne({ id: winnerID });
                        const winData = { timePlayed, date: new Date().toISOString() };
                        if (!winnerData) {
                            await gameDataCollection.insertOne({
                                id: winnerID,
                                wins: [winData],
                                losses: [],
                                points: rewardPoint
                            });
                            logger.info(`New user data created for ${winnerID}: Win recorded`);
                        } else {
                            await gameDataCollection.updateOne(
                                { id: winnerID },
                                { $push: { wins: winData }, $inc: { points: rewardPoint } }
                            );
                            logger.info(`Updated user data for ${winnerID}: Win recorded`);
                        }

         
                        const loserData = await gameDataCollection.findOne({ id: loserID });
                        const lossData = { timePlayed, date: new Date().toISOString() };
                        if (!loserData) {
                            await gameDataCollection.insertOne({
                                id: loserID,
                                wins: [],
                                losses: [lossData],
                                points: 0
                            });
                            logger.info(`New user data created for ${loserID}: Loss recorded`);
                        } else {
                            await gameDataCollection.updateOne(
                                { id: loserID },
                                { $push: { losses: lossData } }
                            );
                            logger.info(`Updated user data for ${loserID}: Loss recorded`);
                        }
                    }
                } catch (err) {
                    logger.error(`Failed to update game stats in database: ${err.message}`);
                }

     
                try {
                    await new Promise((resolve, reject) => {
                        api.sendMessage(
                            { body: `${config.bot.botName}: ${gameData.gameStatus}`, attachment: imageData.imageStream },
                            event.threadID,
                            (err, info) => {
                                if (err) {
                                    logger.error(`Error sending game end message: ${err.message}`);
                                    reject(err);
                                } else {
                                    logger.info(`Game end message sent: ${info.messageID}`);
                                    resolve();
                                }
                            }
                        );
                    });
                } catch (err) {
                    logger.error(`Failed to send game end message: ${err.message}`);
                    return api.sendMessage(`${config.bot.botName}: Failed to send game result.`, event.threadID);
                }

                global.replyHandlers.delete(event.messageReply.messageID);
                logger.info(`Reply handler removed for message ID: ${event.messageReply.messageID}`);
            } else {
                
                let newMessage;
                try {
                    newMessage = await new Promise((resolve, reject) => {
                        api.sendMessage(
                            { attachment: imageData.imageStream },
                            event.threadID,
                            (err, info) => {
                                if (err) {
                                    logger.error(`Error sending updated game image: ${err.message}`);
                                    reject(err);
                                } else {
                                    logger.info(`Updated game image sent: ${info.messageID}`);
                                    resolve(info);
                                }
                            }
                        );
                    });
                } catch (err) {
                    logger.error(`Failed to send updated game image: ${err.message}`);
                    return api.sendMessage(`${config.bot.botName}: Failed to update the game board. Please try again.`, event.threadID);
                }

                global.replyHandlers.set(newMessage.messageID, {
                    commandName: "connectfour",
                    messageID: newMessage.messageID,
                    gameData
                });

                logger.info(`Reply handler updated for new message ID: ${newMessage.messageID}`);
            }

            try {
                await fs.unlink(imageData.filePath);
                logger.info(`Deleted temporary file: ${imageData.filePath}`);
            } catch (err) {
                logger.error(`Failed to delete temporary file: ${err.message}`);
            }

            logger.info(`Processed move for user ${event.senderID} in thread ${event.threadID}`);
        } catch (err) {
            logger.error(`Error in onReply: ${err.message}`);
            try {
                await api.sendMessage(`${config.bot.botName}: An error occurred while processing your move. Please try again.`, event.threadID);
            } catch (sendErr) {
                logger.error(`Failed to send error message: ${sendErr.message}`);
            }
        }
    }
};