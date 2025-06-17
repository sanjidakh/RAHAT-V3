const config = require('../../config/config.json');
const logger = require('../../includes/logger');
const { connect } = require('../../includes/database');
const wordsData = require('../../includes/database/word.json');


if (!global.replyHandlers) {
    global.replyHandlers = new Map();
}

module.exports = {
    name: "ws",
    version: "1.0.1",
    author: "Hridoy",
    description: "Play a word scramble game.",
    adminOnly: false,
    commandCategory: "game",
    guide: "Use {pn}ws start to begin a game.\n" +
           "Reply with the unscrambled word to answer.\n" +
           "Use {pn}ws stop to end the game early.",
    cooldowns: 5,
    usePrefix: true,

    async execute({ api, event, args }) {
        try {
            if (!event || !event.threadID || !event.messageID) {
                logger.error("Invalid event object in ws command", { event });
                return api.sendMessage(`${config.bot.botName}: ❌ Invalid event data.`, event.threadID);
            }

            const threadID = event.threadID;
            const messageID = event.messageID;

            if (!args.length) {
                return api.sendMessage(
                    `${config.bot.botName}: Usage: {pn}ws start or {pn}ws stop`,
                    threadID,
                    event.messageID
                );
            }

            const db = await connect();
            const gamesCollection = db.collection('wordscramble_games');

            const subCommand = args[0].toLowerCase();

            if (subCommand === "stop") {
                const game = await gamesCollection.findOne({ threadID });
                if (!game) {
                    return api.sendMessage(
                        `${config.bot.botName}: No word scramble game is currently active in this thread.`,
                        threadID,
                        event.messageID
                    );
                }


                if (game.currentTimeout) {
                    clearTimeout(game.currentTimeout);
                    game.currentTimeout = null;
                }

 
                const leaderboard = this.generateLeaderboard(game.scores);
                await gamesCollection.deleteOne({ threadID });
                if (game.currentQuestionMessageID) {
                    global.replyHandlers.delete(game.currentQuestionMessageID);
                }

                return api.sendMessage(
                    `${config.bot.botName}: Word Scramble game stopped!\n\n${leaderboard}`,
                    threadID,
                    event.messageID
                );
            }

            if (subCommand !== "start") {
                return api.sendMessage(
                    `${config.bot.botName}: Usage: {pn}ws start or {pn}ws stop`,
                    threadID,
                    event.messageID
                );
            }

        
            const existingGame = await gamesCollection.findOne({ threadID });
            if (existingGame) {
                return api.sendMessage(
                    `${config.bot.botName}: A word scramble game is already active in this thread. Use {pn}ws stop to end it.`,
                    threadID,
                    event.messageID
                );
            }

       
            const words = wordsData.words;
            if (!words || words.length < 5) {
                return api.sendMessage(
                    `${config.bot.botName}: Not enough words available to play the game.`,
                    threadID,
                    event.messageID
                );
            }

        
            const selectedWords = [];
            const wordIndices = new Set();
            while (wordIndices.size < 5) {
                const idx = Math.floor(Math.random() * words.length);
                wordIndices.add(idx);
            }
            wordIndices.forEach(idx => selectedWords.push(words[idx]));

     
            const gameState = {
                threadID,
                words: selectedWords,
                currentWordIndex: 0,
                scores: {}, 
                currentQuestionMessageID: null,
                totalRounds: 5,
                currentTimeout: null
            };

            await gamesCollection.insertOne({
                threadID,
                words: gameState.words,
                currentWordIndex: gameState.currentWordIndex,
                scores: gameState.scores,
                currentQuestionMessageID: gameState.currentQuestionMessageID,
                totalRounds: gameState.totalRounds
            });

    
            await this.presentWord(api, threadID, gamesCollection, gameState);
        } catch (error) {
            logger.error(`Error in ws execute: ${error.message}`, { event, args });
            try {
                await api.sendMessage(
                    `${config.bot.botName}: ❌ An error occurred while processing the ws command.`,
                    event.threadID,
                    event.messageID
                );
            } catch (sendErr) {
                logger.error(`Failed to send error message in execute: ${sendErr.message}`);
            }
        }
    },

    async onReply({ api, event }) {
        try {
            if (!event || !event.threadID || !event.messageID || !event.messageReply) {
                logger.error("Invalid event object in ws onReply", { event });
                return api.sendMessage(`${config.bot.botName}: ❌ Invalid event data.`, event.threadID);
            }

            const threadID = event.threadID;
            const messageID = event.messageID;
            const userID = event.senderID;

            const db = await connect();
            const gamesCollection = db.collection('wordscramble_games');
            const game = await gamesCollection.findOne({ threadID });

            if (!game) {
                return api.sendMessage(
                    `${config.bot.botName}: No active word scramble game in this thread. Start one with {pn}ws start.`,
                    threadID,
                    event.messageID
                );
            }

            if (!game.currentQuestionMessageID || game.currentQuestionMessageID !== event.messageReply.messageID) {
                return api.sendMessage(
                    `${config.bot.botName}: Please reply to the current scrambled word.`,
                    threadID,
                    event.messageID
                );
            }

       
            if (game.currentTimeout) {
                clearTimeout(game.currentTimeout);
                game.currentTimeout = null;
            }

            const currentWord = game.words[game.currentWordIndex];
            const userGuess = event.body.trim().toLowerCase();
            const correct = userGuess === currentWord.toLowerCase();

      
            if (!game.scores[userID]) {
                game.scores[userID] = 0;
            }
            if (correct) {
                game.scores[userID] += 10;  
                await api.sendMessage(
                    `${config.bot.botName}: Correct! +10 points!`,
                    threadID,
                    event.messageID
                );
            } else {
                await api.sendMessage(
                    `${config.bot.botName}: Incorrect! The correct word was: ${currentWord}`,
                    threadID,
                    event.messageID
                );
            }

  
            game.currentWordIndex += 1;
            game.currentQuestionMessageID = null;

       
            if (event.messageReply.messageID) {
                global.replyHandlers.delete(event.messageReply.messageID);
            }

            if (game.currentWordIndex >= game.totalRounds) {
      
                const leaderboard = this.generateLeaderboard(game.scores);
                await gamesCollection.deleteOne({ threadID });
                return api.sendMessage(
                    `${config.bot.botName}: Game Over!\n\n${leaderboard}`,
                    threadID,
                    event.messageID
                );
            }

            await gamesCollection.updateOne(
                { threadID },
                { $set: { 
                    currentWordIndex: game.currentWordIndex, 
                    currentQuestionMessageID: null,
                    scores: game.scores 
                } }
            );

   
            await this.presentWord(api, threadID, gamesCollection, game);
        } catch (error) {
            logger.error(`Error in ws onReply: ${error.message}`, { event });
            try {
                await api.sendMessage(
                    `${config.bot.botName}: ❌ An error occurred while processing your answer.`,
                    event.threadID,
                    event.messageID
                );
            } catch (sendErr) {
                logger.error(`Failed to send error message in onReply: ${sendErr.message}`);
            }
        }
    },

    async presentWord(api, threadID, gamesCollection, game) {
        try {
            const word = game.words[game.currentWordIndex];
            const scrambledWord = this.scrambleWord(word);

            const messageText = `${config.bot.botName}: Round ${game.currentWordIndex + 1}/${game.totalRounds}\n\n` +
                `Unscramble this word: **${scrambledWord}**\n\n` +
                `Reply with the correct word to answer. You have 30 seconds!`;

            const sentMessage = await new Promise((resolve, reject) => {
                api.sendMessage(messageText, threadID, (err, info) => {
                    if (err) reject(err);
                    else resolve(info);
                });
            });

            logger.info(`Word scramble sent: ${sentMessage.messageID}`);


            global.replyHandlers.set(sentMessage.messageID, {
                commandName: this.name,
                threadID,
                messageID: sentMessage.messageID
            });

          
            await gamesCollection.updateOne(
                { threadID },
                { $set: { currentQuestionMessageID: sentMessage.messageID } }
            );

    
            const timeout = setTimeout(async () => {
                try {
          
                    const currentGame = await gamesCollection.findOne({ threadID });
                    if (!currentGame || currentGame.currentQuestionMessageID !== sentMessage.messageID) {
                        return;
                    }

                    await api.sendMessage(
                        `${config.bot.botName}: Time's up! The correct word was: ${word}`,
                        threadID
                    );
                    global.replyHandlers.delete(sentMessage.messageID);

                    game.currentWordIndex += 1;
                    game.currentQuestionMessageID = null;
                    game.currentTimeout = null;

                    if (game.currentWordIndex >= game.totalRounds) {
                        const leaderboard = this.generateLeaderboard(game.scores);
                        await gamesCollection.deleteOne({ threadID });
                        await api.sendMessage(
                            `${config.bot.botName}: Game Over!\n\n${leaderboard}`,
                            threadID
                        );
                    } else {
                        await gamesCollection.updateOne(
                            { threadID },
                            { $set: { 
                                currentWordIndex: game.currentWordIndex, 
                                currentQuestionMessageID: null,
                                scores: game.scores 
                            } }
                        );
                        await this.presentWord(api, threadID, gamesCollection, game);
                    }
                } catch (error) {
                    logger.error(`Error in timeout callback: ${error.message}`);
                }
            }, 30000); 

  
            game.currentTimeout = timeout;

   
            await gamesCollection.updateOne(
                { threadID },
                { $set: { currentTimeout: null } } 
            );
        } catch (error) {
            logger.error(`Error in presentWord: ${error.message}`);
            await api.sendMessage(
                `${config.bot.botName}: ❌ An error occurred while presenting the word. Game stopped.`,
                threadID
            );
            await gamesCollection.deleteOne({ threadID });
        }
    },

    scrambleWord(word) {
        const letters = word.split('');
        for (let i = letters.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [letters[i], letters[j]] = [letters[j], letters[i]];
        }
        let scrambled = letters.join('');

        while (scrambled === word && word.length > 1) {
            scrambled = this.scrambleWord(word);
        }
        return scrambled;
    },

    generateLeaderboard(scores) {
        const leaderboardEntries = Object.entries(scores);
        if (!leaderboardEntries.length) {
            return "No one scored any points!";
        }

        leaderboardEntries.sort((a, b) => b[1] - a[1]);
        return "🏆 Leaderboard 🏆\n\n" +
            leaderboardEntries
                .map(([userID, score], idx) => `${idx + 1}. User ${userID}: ${score} points`)
                .join("\n");
    }
};