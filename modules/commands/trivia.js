const config = require('../../config/config.json');
const logger = require('../../includes/logger');
const axios = require('axios');
const { connect } = require('../../includes/database');
const he = require('he');


if (!global.replyHandlers) {
    global.replyHandlers = new Map();
}

const categories = {
    "general": 9,   
    "science": 17,  
    "history": 23, 
    "geography": 22, 
    "entertainment": 11, 
    "sports": 21  
};

const difficulties = ["easy", "medium", "hard"];

module.exports = {
    name: "trivia",
    version: "1.0.0",
    author: "Hridoy",
    description: "Play an advanced trivia game with categories and difficulty levels.",
    adminOnly: false,
    commandCategory: "game",
    guide: "Use {pn}trivia start <category> <difficulty> to start a game.\n" +
           "Categories: general, science, history, geography, entertainment, sports\n" +
           "Difficulties: easy, medium, hard\n" +
           "Reply with the option number (1-4) or 'true'/'false' to answer.\n" +
           "Use {pn}trivia stop to end the game early.",
    cooldowns: 5,
    usePrefix: true,

    async execute({ api, event, args }) {
        try {
            if (!event || !event.threadID || !event.messageID) {
                logger.error("Invalid event object in trivia command", { event });
                return api.sendMessage(`${config.bot.botName}: ❌ Invalid event data.`, event.threadID);
            }

            const threadID = event.threadID;
            const messageID = event.messageID;

            if (!args.length) {
                return api.sendMessage(
                    `${config.bot.botName}: Usage: {pn}trivia start <category> <difficulty>\n` +
                    `Categories: ${Object.keys(categories).join(", ")}\n` +
                    `Difficulties: ${difficulties.join(", ")}`,
                    threadID,
                    event.messageID
                );
            }

            const db = await connect();
            const gamesCollection = db.collection('trivia_games');

            const subCommand = args[0].toLowerCase();

            if (subCommand === "stop") {
                const game = await gamesCollection.findOne({ threadID });
                if (!game) {
                    return api.sendMessage(
                        `${config.bot.botName}: No trivia game is currently active in this thread.`,
                        threadID,
                        event.messageID
                    );
                }

          
                if (game.currentTimeout) {
                    clearTimeout(game.currentTimeout);
                }

                const leaderboard = this.generateLeaderboard(game.scores);
                await gamesCollection.deleteOne({ threadID });
                if (game.currentQuestionMessageID) {
                    global.replyHandlers.delete(game.currentQuestionMessageID);
                }

                return api.sendMessage(
                    `${config.bot.botName}: Trivia game stopped!\n\n${leaderboard}`,
                    threadID,
                    event.messageID
                );
            }

            if (subCommand !== "start") {
                return api.sendMessage(
                    `${config.bot.botName}: Usage: {pn}trivia start <category> <difficulty> or {pn}trivia stop`,
                    threadID,
                    event.messageID
                );
            }

            const existingGame = await gamesCollection.findOne({ threadID });
            if (existingGame) {
                return api.sendMessage(
                    `${config.bot.botName}: A trivia game is already active in this thread. Use {pn}trivia stop to end it.`,
                    threadID,
                    event.messageID
                );
            }

            if (args.length < 3) {
                return api.sendMessage(
                    `${config.bot.botName}: Please specify both category and difficulty (e.g., {pn}trivia start general easy).`,
                    threadID,
                    event.messageID
                );
            }

            const categoryInput = args[1].toLowerCase();
            const difficultyInput = args[2].toLowerCase();

            if (!categories[categoryInput]) {
                return api.sendMessage(
                    `${config.bot.botName}: Invalid category. Available categories: ${Object.keys(categories).join(", ")}`,
                    threadID,
                    event.messageID
                );
            }

            if (!difficulties.includes(difficultyInput)) {
                return api.sendMessage(
                    `${config.bot.botName}: Invalid difficulty. Available difficulties: ${difficulties.join(", ")}`,
                    threadID,
                    event.messageID
                );
            }


            const categoryID = categories[categoryInput];
            let response;
            try {
                response = await axios.get(
                    `https://opentdb.com/api.php?amount=5&category=${categoryID}&difficulty=${difficultyInput}&type=multiple`
                );
                if (response.data.response_code !== 0 || !response.data.results.length) {
                    throw new Error("Failed to fetch trivia questions.");
                }
            } catch (err) {
                logger.error(`Failed to fetch trivia questions: ${err.message}`);
                return api.sendMessage(
                    `${config.bot.botName}: ❌ Failed to fetch trivia questions. Please try again later.`,
                    threadID,
                    event.messageID
                );
            }

            const questions = response.data.results.map(q => ({
                question: this.decodeHtml(q.question),
                correctAnswer: this.decodeHtml(q.correct_answer),
                incorrectAnswers: q.incorrect_answers.map(ans => this.decodeHtml(ans)),
                type: q.type
            }));

            const gameState = {
                threadID,
                questions,
                currentQuestionIndex: 0,
                scores: {}, 
                currentQuestionMessageID: null,
                totalQuestions: 5,
                currentTimeout: null 
            };

            await gamesCollection.insertOne({
                threadID,
                questions: gameState.questions,
                currentQuestionIndex: gameState.currentQuestionIndex,
                scores: gameState.scores,
                currentQuestionMessageID: gameState.currentQuestionMessageID,
                totalQuestions: gameState.totalQuestions
            });

           
            await this.askQuestion(api, threadID, gamesCollection, gameState);
        } catch (error) {
            logger.error(`Error in trivia execute: ${error.message}`, { event, args });
            try {
                await api.sendMessage(
                    `${config.bot.botName}: ❌ An error occurred while processing the trivia command.`,
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
                logger.error("Invalid event object in trivia onReply", { event });
                return api.sendMessage(`${config.bot.botName}: ❌ Invalid event data.`, event.threadID);
            }

            const threadID = event.threadID;
            const messageID = event.messageID;
            const userID = event.senderID;

            const db = await connect();
            const gamesCollection = db.collection('trivia_games');
            const game = await gamesCollection.findOne({ threadID });

            if (!game || game.currentQuestionMessageID !== event.messageReply.messageID) {
                return api.sendMessage(
                    `${config.bot.botName}: Please reply to the current trivia question.`,
                    threadID,
                    event.messageID
                );
            }

   
            game.currentTimeout = null;

            const currentQuestion = game.questions[game.currentQuestionIndex];
            const userAnswer = event.body.trim().toLowerCase();
            let correct = false;
            let correctAnswerText;

            if (currentQuestion.type === "multiple") {
                const options = [...currentQuestion.incorrectAnswers, currentQuestion.correctAnswer];
                const userSelection = parseInt(userAnswer);
                if (isNaN(userSelection) || userSelection < 1 || userSelection > 4) {
                    return api.sendMessage(
                        `${config.bot.botName}: Please reply with a number between 1 and 4.`,
                        threadID,
                        event.messageID
                    );
                }
                const selectedOption = options[userSelection - 1];
                correct = selectedOption === currentQuestion.correctAnswer;
                correctAnswerText = currentQuestion.correctAnswer;
            } else {
           
                if (!["true", "false"].includes(userAnswer)) {
                    return api.sendMessage(
                        `${config.bot.botName}: Please reply with 'true' or 'false'.`,
                        threadID,
                        event.messageID
                    );
                }
                correct = userAnswer === currentQuestion.correctAnswer.toLowerCase();
                correctAnswerText = currentQuestion.correctAnswer;
            }


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
                    `${config.bot.botName}: Incorrect! The correct answer was: ${correctAnswerText}`,
                    threadID,
                    event.messageID
                );
            }

            game.currentQuestionIndex += 1;
            game.currentQuestionMessageID = null;
            global.replyHandlers.delete(event.messageReply.messageID);

            if (game.currentQuestionIndex >= game.totalQuestions) {
        
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
                    currentQuestionIndex: game.currentQuestionIndex, 
                    currentQuestionMessageID: null,
                    scores: game.scores 
                } }
            );
            await this.askQuestion(api, threadID, gamesCollection, game);
        } catch (error) {
            logger.error(`Error in trivia onReply: ${error.message}`, { event });
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

    async askQuestion(api, threadID, gamesCollection, game) {
        try {
            const question = game.questions[game.currentQuestionIndex];
            let questionText;

            if (question.type === "multiple") {
                const options = [...question.incorrectAnswers, question.correctAnswer];
              
                for (let i = options.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [options[i], options[j]] = [options[j], options[i]];
                }
                questionText = `${config.bot.botName}: Question ${game.currentQuestionIndex + 1}/${game.totalQuestions}\n\n` +
                    `${question.question}\n\n` +
                    options.map((opt, idx) => `${idx + 1}. ${opt}`).join("\n") +
                    "\n\nReply with the option number (1-4) to answer. You have 30 seconds!";
            } else {
                questionText = `${config.bot.botName}: Question ${game.currentQuestionIndex + 1}/${game.totalQuestions}\n\n` +
                    `${question.question}\n\n` +
                    "Reply with 'true' or 'false' to answer. You have 30 seconds!";
            }

            const sentMessage = await new Promise((resolve, reject) => {
                api.sendMessage(questionText, threadID, (err, info) => {
                    if (err) reject(err);
                    else resolve(info);
                });
            });

            logger.info(`Trivia question sent: ${sentMessage.messageID}`);

   
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
                    await api.sendMessage(
                        `${config.bot.botName}: Time's up! The correct answer was: ${question.correctAnswer}`,
                        threadID
                    );
                    global.replyHandlers.delete(sentMessage.messageID);

                    game.currentQuestionIndex += 1;
                    game.currentQuestionMessageID = null;
                    game.currentTimeout = null;

                    if (game.currentQuestionIndex >= game.totalQuestions) {
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
                                currentQuestionIndex: game.currentQuestionIndex, 
                                currentQuestionMessageID: null,
                                scores: game.scores 
                            } }
                        );
                        await this.askQuestion(api, threadID, gamesCollection, game);
                    }
                } catch (error) {
                    logger.error(`Error in timeout callback: ${error.message}`);
                }
            }, 30000); 


            game.currentTimeout = timeout;
        } catch (error) {
            logger.error(`Error in askQuestion: ${error.message}`);
            await api.sendMessage(
                `${config.bot.botName}: ❌ An error occurred while asking the question. Game stopped.`,
                threadID
            );
            await gamesCollection.deleteOne({ threadID });
        }
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
    },

    decodeHtml(html) {
        return he.decode(html);
    }
};