const config = require('../../config/config.json');
const fs = require('fs-extra');
const path = require('path');
const logger = require('../../includes/logger');
const { createCanvas } = require('canvas');
const { connect } = require('../../includes/database/index');

// List of words for the game
const words = [
    "cake", "book", "tree", "star", "moon", "fish", "bird", "cloud", "river", "stone",
    "apple", "grape", "lemon", "peach", "berry", "chair", "table", "clock", "light", "phone"
];

function drawHangman(gameData) {
    const { word, guessedLetters, incorrectGuesses, gameStatus } = gameData;
    const canvas = createCanvas(400, 500);
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#F0F2F5';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Game Title
    ctx.font = 'bold 30px Arial';
    ctx.fillStyle = '#404040';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Hangman', canvas.width / 2, 30);

    // Draw the gallows
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(50, 400); // Base
    ctx.lineTo(150, 400);
    ctx.moveTo(100, 400); // Pole
    ctx.lineTo(100, 100);
    ctx.lineTo(250, 100); // Top bar
    ctx.lineTo(250, 150); // Rope
    ctx.stroke();

    // Draw the hangman figure based on incorrect guesses
    const drawSteps = [
        () => { // Head
            ctx.beginPath();
            ctx.arc(250, 180, 30, 0, Math.PI * 2);
            ctx.stroke();
        },
        () => { // Body
            ctx.beginPath();
            ctx.moveTo(250, 210);
            ctx.lineTo(250, 300);
            ctx.stroke();
        },
        () => { // Left Arm
            ctx.beginPath();
            ctx.moveTo(250, 230);
            ctx.lineTo(200, 270);
            ctx.stroke();
        },
        () => { // Right Arm
            ctx.beginPath();
            ctx.moveTo(250, 230);
            ctx.lineTo(300, 270);
            ctx.stroke();
        },
        () => { // Left Leg
            ctx.beginPath();
            ctx.moveTo(250, 300);
            ctx.lineTo(200, 350);
            ctx.stroke();
        },
        () => { // Right Leg
            ctx.beginPath();
            ctx.moveTo(250, 300);
            ctx.lineTo(300, 350);
            ctx.stroke();
        }
    ];

    for (let i = 0; i < incorrectGuesses.length; i++) {
        drawSteps[i]();
    }

    // Display the word with guessed letters
    const displayWord = word.split('').map(letter => guessedLetters.includes(letter.toLowerCase()) ? letter : '_').join(' ');
    ctx.font = '40px Arial';
    ctx.fillStyle = '#000';
    ctx.fillText(displayWord, canvas.width / 2, 450);

    // Display incorrect guesses
    ctx.font = '20px Arial';
    ctx.fillStyle = '#FF0000';
    ctx.fillText(`Incorrect: ${incorrectGuesses.join(', ') || 'None'}`, canvas.width / 2, 480);

    // Display game status or instructions
    if (gameStatus) {
        ctx.font = '25px Arial';
        ctx.fillStyle = '#404040';
        ctx.fillText(gameStatus, canvas.width / 2, 70);
    } else {
        ctx.font = '20px Arial';
        ctx.fillStyle = '#404040';
        ctx.fillText(`Guess a letter (Reply with a single letter)!`, canvas.width / 2, 70);
    }

    const filePath = path.join(__dirname, `../../temp/hangman_${Date.now()}.png`);
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
            logger.error(`Error writing Hangman image: ${err.message}`);
            resolve(null);
        });
    });
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
    name: "hangman",
    version: "1.0.0",
    author: "Hridoy",
    description: "A Hangman game where you guess letters to uncover a hidden word.",
    adminOnly: false,
    commandCategory: "games",
    guide: "Use {pn}hangman to start a game\n{pn}hangman rank [page] to see leaderboard\n{pn}hangman info [userID/@mention] to see user stats\n{pn}hangman reset to reset leaderboard (admin only)",
    cooldowns: 5,
    usePrefix: true,

    async execute({ api, event, args }) {
        try {
            const db = await connect();
            const gameDataCollection = db.collection('hangman');

            // Handle subcommands
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

            // Start a new game
            const playerID = event.senderID;
            const playerInfo = await new Promise((resolve) => api.getUserInfo(playerID, (err, info) => resolve(err ? {} : info)));
            const playerName = playerInfo[playerID]?.name || "Player";

            const word = words[Math.floor(Math.random() * words.length)];
            const gameData = {
                word: word.toLowerCase(),
                guessedLetters: [],
                incorrectGuesses: [],
                timeStart: Date.now(),
                gameStatus: null,
                playerID,
                playerName
            };

            const imageData = await drawHangman(gameData);
            if (!imageData) {
                return api.sendMessage(`${config.bot.botName}: Failed to start the game.`, event.threadID);
            }

            const messageData = await new Promise((resolve) => {
                api.sendMessage(
                    `${config.bot.botName}: Hangman Game Started!\nGuess the ${word.length}-letter word by replying with a single letter.`,
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
                commandName: "hangman",
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

            logger.info(`Started Hangman game for ${playerName} in thread ${event.threadID}`);
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

            logger.info(`Processing reply for Hangman game by ${gameData.playerName}`);

            // Check if the game is already over
            if (gameData.gameStatus) {
                logger.info(`Game already ended: ${gameData.gameStatus}`);
                return api.sendMessage(`${config.bot.botName}: The game has already ended! Start a new game with .hangman.`, event.threadID);
            }

            // Check if it's the correct player
            if (event.senderID !== gameData.playerID) {
                logger.info(`Wrong player: ${event.senderID} attempted to play, but player is ${gameData.playerID}`);
                return api.sendMessage(`${config.bot.botName}: Only ${gameData.playerName} can play this game!`, event.threadID);
            }

            // Parse the player's guess
            const guess = event.body.trim().toLowerCase();
            if (guess.length !== 1 || !/[a-z]/.test(guess)) {
                logger.info(`Invalid guess by ${event.senderID}: ${guess}`);
                return api.sendMessage(`${config.bot.botName}: Please reply with a single letter (a-z).`, event.threadID);
            }

            // Check if the letter was already guessed
            if (gameData.guessedLetters.includes(guess) || gameData.incorrectGuesses.includes(guess)) {
                logger.info(`Letter already guessed by ${event.senderID}: ${guess}`);
                return api.sendMessage(`${config.bot.botName}: You've already guessed the letter "${guess}"! Try a different letter.`, event.threadID);
            }

            // Process the guess
            if (gameData.word.includes(guess)) {
                gameData.guessedLetters.push(guess);
                // Check if the player has won
                const allLettersGuessed = gameData.word.split('').every(letter => gameData.guessedLetters.includes(letter));
                if (allLettersGuessed) {
                    gameData.gameStatus = `You Win! The word was "${gameData.word}".`;
                }
            } else {
                gameData.incorrectGuesses.push(guess);
                // Check if the player has lost
                if (gameData.incorrectGuesses.length >= 6) {
                    gameData.gameStatus = `Game Over! The word was "${gameData.word}".`;
                }
            }

            // Draw the updated board
            const imageData = await drawHangman(gameData);
            if (!imageData) {
                logger.error(`Failed to draw Hangman board for user ${event.senderID}`);
                return api.sendMessage(`${config.bot.botName}: Failed to update the game board.`, event.threadID);
            }

            // Unsend the previous game image
            try {
                await api.unsendMessage(event.messageReply.messageID);
                logger.info(`Unsent previous game image: ${event.messageReply.messageID}`);
            } catch (err) {
                logger.error(`Failed to unsend previous game image: ${err.message}`);
            }

            // If the game is over, unsend the initial message and update stats
            if (gameData.gameStatus) {
                try {
                    await api.unsendMessage(gameData.messageData.messageID);
                    logger.info(`Unsent initial game message: ${gameData.messageData.messageID}`);
                } catch (err) {
                    logger.error(`Failed to unsend initial game message: ${err.message}`);
                }

                const db = await connect();
                const gameDataCollection = db.collection('hangman');
                const timePlayed = Date.now() - gameData.timeStart;
                const rewardPoint = 50;

                try {
                    const userData = await gameDataCollection.findOne({ id: event.senderID });
                    const data = { timePlayed, date: new Date().toISOString() };

                    if (gameData.gameStatus.includes('You Win')) {
                        if (!userData) {
                            await gameDataCollection.insertOne({
                                id: event.senderID,
                                wins: [data],
                                losses: [],
                                points: rewardPoint
                            });
                            logger.info(`New user data created for ${event.senderID}: Win recorded`);
                        } else {
                            await gameDataCollection.updateOne(
                                { id: event.senderID },
                                { $push: { wins: data }, $inc: { points: rewardPoint } }
                            );
                            logger.info(`Updated user data for ${event.senderID}: Win recorded`);
                        }
                    } else {
                        if (!userData) {
                            await gameDataCollection.insertOne({
                                id: event.senderID,
                                wins: [],
                                losses: [data],
                                points: 0
                            });
                            logger.info(`New user data created for ${event.senderID}: Loss recorded`);
                        } else {
                            await gameDataCollection.updateOne(
                                { id: event.senderID },
                                { $push: { losses: data } }
                            );
                            logger.info(`Updated user data for ${event.senderID}: Loss recorded`);
                        }
                    }
                } catch (err) {
                    logger.error(`Failed to update game stats in database: ${err.message}`);
                }

                // Send the final board
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
                // Game continues: Send the updated board and update the reply handler
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
                    commandName: "hangman",
                    messageID: newMessage.messageID,
                    gameData
                });

                logger.info(`Reply handler updated for new message ID: ${newMessage.messageID}`);
            }

            // Clean up the temporary file
            try {
                await fs.unlink(imageData.filePath);
                logger.info(`Deleted temporary file: ${imageData.filePath}`);
            } catch (err) {
                logger.error(`Failed to delete temporary file: ${err.message}`);
            }

            logger.info(`Processed guess for user ${event.senderID} in thread ${event.threadID}`);
        } catch (err) {
            logger.error(`Error in onReply: ${err.message}`);
            try {
                await api.sendMessage(`${config.bot.botName}: An error occurred while processing your guess. Please try again.`, event.threadID);
            } catch (sendErr) {
                logger.error(`Failed to send error message: ${sendErr.message}`);
            }
        }
    }
};