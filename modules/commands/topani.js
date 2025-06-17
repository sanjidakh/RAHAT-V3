const config = require('../../config/config.json');
const logger = require('../../includes/logger');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ====== CONFIG ZONE ======
const TOPANI_API_URL = 'https://nexalo-api.vercel.app/api/topanime';
// ==========================

module.exports = {
    name: "topani",
    version: "1.0.0",
    author: "Hridoy",
    description: "Fetches the top 5 anime with details and images.",
    adminOnly: false,
    commandCategory: "Anime",
    guide: "Use {pn}topani to get the top 5 anime ranked by score.",
    cooldowns: 5,
    usePrefix: true,

    async execute({ api, event, args }) {
        const threadID = event.threadID;
        const messageID = event.messageID;

        let filePaths = [];

        try {
     
            if (!event || !threadID || !messageID) {
                logger.error("Invalid event object in topani command", { event });
                return api.sendMessage(`${config.bot.botName}: ❌ Invalid event data.`, threadID);
            }

            logger.info(`Received command: .topani in thread ${threadID}`);

         
            logger.info(`Sending request to Top Anime API: ${TOPANI_API_URL}`);
            let response;
            try {
                response = await axios.get(TOPANI_API_URL, { timeout: 30000 });
            } catch (err) {
                throw new Error("Failed to fetch top anime: " + err.message);
            }

            const topAnime = response.data;
            if (!Array.isArray(topAnime) || topAnime.length === 0) {
                return api.sendMessage(
                    `${config.bot.botName}: No top anime data available.`,
                    threadID,
                    messageID
                );
            }

         
            const topFive = topAnime.slice(0, 5);


            const tempDir = path.join(__dirname, '..', '..', 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }


            const attachments = [];
            let msgBody = `${config.bot.botName}: Top 5 Anime\n\n`;

            for (const [index, anime] of topFive.entries()) {
                const fileName = `topani_${crypto.randomBytes(8).toString('hex')}.jpg`;
                const filePath = path.join(tempDir, fileName);
                filePaths.push(filePath);

          
                logger.info(`Downloading thumbnail for: ${anime.title}`);
                const imageResponse = await axios.get(anime.thumbnail, {
                    responseType: 'stream',
                    timeout: 30000
                });


                const contentType = imageResponse.headers['content-type'];
                if (!contentType || !contentType.startsWith('image/')) {
                    throw new Error(`Thumbnail for ${anime.title} is not an image file`);
                }

     
                const writer = fs.createWriteStream(filePath);
                imageResponse.data.pipe(writer);

                await new Promise((resolve, reject) => {
                    writer.on('finish', resolve);
                    writer.on('error', reject);
                });

    
                const stats = fs.statSync(filePath);
                if (stats.size === 0) throw new Error(`Downloaded thumbnail for ${anime.title} is empty`);

                attachments.push(fs.createReadStream(filePath));

  
                msgBody += `${index + 1}. ${anime.title}\n` +
                           `   Rank: ${anime.rank}\n` +
                           `   Score: ${anime.score}\n` +
                           `   Type: ${anime.type}\n` +
                           `   Release: ${anime.release}\n` +
                           `   Members: ${anime.members}\n` +
                           `   Link: ${anime.link}\n\n`;
            }

            const msg = {
                body: msgBody.trim(),
                attachment: attachments
            };

            logger.info("Sending top 5 anime info");
            await api.sendMessage(msg, threadID);
            logger.info("Top anime info sent successfully");

            for (const filePath of filePaths) {
                fs.unlinkSync(filePath);
            }
        } catch (err) {
            logger.error(`Error in topani command: ${err.message}`, { stack: err.stack });
            await api.sendMessage(
                `${config.bot.botName}: ⚠️ Error: ${err.message}`,
                threadID,
                messageID
            );

   
            for (const filePath of filePaths) {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
        }
    }
};