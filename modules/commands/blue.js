const config = require('../../config/config.json');
const logger = require('../../includes/logger');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ====== CONFIG ZONE ======
const BLUE_API_URL = 'https://nexalo-api.vercel.app/api/ba';
// ==========================

module.exports = {
    name: "blue",
    version: "1.0.0",
    author: "Hridoy",
    description: "Sends a blue anime girl image to the chat 🖼️",
    adminOnly: false,
    commandCategory: "Fun",
    guide: "Use {pn}blue to get a blue anime girl image.",
    cooldowns: 5,
    usePrefix: true,

    async execute({ api, event, args }) {
        const threadID = event.threadID;
        const messageID = event.messageID;

        let filePath; 

        try {
   
            if (!event || !threadID || !messageID) {
                logger.error("Invalid event object in blue command", { event });
                return api.sendMessage(`${config.bot.botName}: ❌ Invalid event data.`, threadID);
            }

            logger.info(`Received command: .blue in thread ${threadID}`);

        
            const tempDir = path.join(__dirname, '..', '..', 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            const fileName = `blue_${crypto.randomBytes(8).toString('hex')}.jpg`;
            filePath = path.join(tempDir, fileName);

      
            logger.info(`Sending request to Blue API: ${BLUE_API_URL}`);
            const response = await axios.get(BLUE_API_URL, {
                responseType: 'stream',
                timeout: 30000 
            });

     
            const contentType = response.headers['content-type'];
            if (!contentType || !contentType.startsWith('image/')) {
                throw new Error("API response is not an image file");
            }

        
            const writer = fs.createWriteStream(filePath);
            response.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

   
            const stats = fs.statSync(filePath);
            if (stats.size === 0) throw new Error("Downloaded image is empty");

    
            const msg = {
                body: `${config.bot.botName}: 🖼️ Here's a blue anime girl image!`,
                attachment: fs.createReadStream(filePath)
            };

         
            logger.info("Sending blue anime girl image");
            await api.sendMessage(msg, threadID);
            logger.info("Image sent successfully");

      
            fs.unlinkSync(filePath);
        } catch (err) {
            logger.error(`Error in blue command: ${err.message}`, { stack: err.stack });
            await api.sendMessage(
                `${config.bot.botName}: ⚠️ Error: ${err.message}`,
                threadID,
                messageID
            );

         
            if (filePath && fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
    }
};