const config = require('../../config/config.json');
const logger = require('../../includes/logger');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

// ====== CONFIG ZONE ======
const ANIME_IMAGES = [
    'https://i.ibb.co/TMC1SMR/download-1.jpg', 
    'https://i.ibb.co/pv44sQTh/download-2.jpg', 
    'https://i.ibb.co/XZQTMZrv/download-3.jpg', 
    'https://i.ibb.co/DDV4FJ1p/Clannad-Clannad-After-Story.jpg',
    'https://i.ibb.co/8DjYtmYr/download-4.jpg', 
    'https://i.ibb.co/JFS29wK7/download-5.jpg', 
    'https://i.ibb.co/LDgbhYCS/download-6.jpg', 
    'https://i.ibb.co/3YLZ5Gcs/download-7.jpg', 
    'https://i.ibb.co/v4RJxbC6/download-8.jpg', 
    'https://i.ibb.co/nNLcH5gd/download-9.jpg'  
];
// ==========================

module.exports = {
    name: "confess",
    version: "1.0.1",
    author: "Deku",
    description: "Send a confession to a user by UID or mention with a romantic anime image ❤️",
    adminOnly: false,
    commandCategory: "Fun",
    guide: "Use {pn}confess [@mention or UID | message] to send a confession.\n" +
           "Example: {pn}confess @John | I like you\n" +
           "Or: {pn}confess 123456789 | I like you",
    cooldowns: 5,
    usePrefix: true,

    async execute({ api, event }) {
        const threadID = event.threadID;
        const messageID = event.messageID;
        const senderID = event.senderID;

        try {
            if (!event || !threadID || !messageID || !senderID) {
                return api.sendMessage(`${config.bot.botName}: ❌ Invalid event data.`, threadID, messageID);
            }

            let recipientID = null;
            let message = null;


            if (Object.keys(event.mentions).length > 0) {
                recipientID = Object.keys(event.mentions)[0];
                message = event.body.replace(/@[^ ]+/g, '').trim().split('|')[1]?.trim();
            } else {
    
                const parts = event.body.split('|').map(item => item.trim());
                if (parts.length < 2) {
                    return api.sendMessage(
                        `${config.bot.botName}: ❌ Please provide a UID or mention and a message. Example: .confess @John | I like you`,
                        threadID,
                        messageID
                    );
                }
                recipientID = parts[0].replace(config.bot.prefix + 'confess', '').trim();
                message = parts[1];
            }

            if (!recipientID || !/^\d+$/.test(recipientID)) {
                return api.sendMessage(
                    `${config.bot.botName}: ❌ Invalid UID or no user mentioned.`,
                    threadID,
                    messageID
                );
            }

            if (!message) {
                return api.sendMessage(
                    `${config.bot.botName}: ❌ Missing confession message.`,
                    threadID,
                    messageID
                );
            }

   
            const userInfo = await new Promise((resolve, reject) => {
                api.getUserInfo([recipientID], (err, info) => {
                    if (err) reject(err);
                    else resolve(info);
                });
            });

            if (!userInfo[recipientID]) {
                return api.sendMessage(
                    `${config.bot.botName}: ❌ User not found.`,
                    threadID,
                    messageID
                );
            }

    
            const randomImage = ANIME_IMAGES[Math.floor(Math.random() * ANIME_IMAGES.length)];
            logger.info(`Downloading anime image: ${randomImage}`);

            const imageResponse = await axios.get(randomImage, { responseType: 'stream', timeout: 15000 });

            const tempDir = path.join(__dirname, '..', '..', 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            const fileName = `confess_${crypto.randomBytes(8).toString('hex')}.jpg`;
            const filePath = path.join(tempDir, fileName);

            const writer = fs.createWriteStream(filePath);
            imageResponse.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

      
            const msg = {
                body: `${config.bot.botName}: 💌 You've got a confession!\n\n📜: ${message}\n━━━━━━━━━━━━━━━━━━━━━\n😘: The sender's a mystery! Don't ask me who, just enjoy the moment~`,
                attachment: fs.createReadStream(filePath)
            };

            await new Promise((resolve, reject) => {
                api.sendMessage(msg, recipientID, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            logger.info(`Sent confession from thread ${threadID} to user ${recipientID}`);

   
            await api.sendMessage(
                `${config.bot.botName}: ❤️ Confession sent successfully with a romantic anime image!`,
                threadID,
                messageID
            );

         
            fs.unlinkSync(filePath);
        } catch (err) {
            logger.error(`Failed to send confession: ${err.message}`);
            await api.sendMessage(
                `${config.bot.botName}: ⚠️ Error: ${err.message || 'Failed to send confession. Try confessing in person!'}`,
                threadID,
                messageID
            );
        }
    }
};