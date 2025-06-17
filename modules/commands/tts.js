const config = require('../../config/config.json');
const logger = require('../../includes/logger');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ====== CONFIG ZONE ======
const TTS_API_URL = 'https://nexalo-api.vercel.app/api/tts2';
// ==========================

module.exports = {
    name: "tts",
    version: "1.0.1",
    author: "Hridoy",
    description: "Convert text to speech and send the audio to the chat 🎙️",
    adminOnly: false,
    commandCategory: "Fun",
    guide: "Use {pn}tts <text> to convert text to speech.\n" +
           "Example: {pn}tts Hello, how are you?",
    cooldowns: 5,
    usePrefix: true,

    async execute({ api, event, args }) {
        const threadID = event.threadID;
        const messageID = event.messageID;

        let filePath;

        try {
      
            if (!event || !threadID || !messageID) {
                logger.error("Invalid event object in tts command", { event });
                return api.sendMessage(`${config.bot.botName}: ❌ Invalid event data.`, threadID);
            }

            const text = args.join(" ").trim();
            logger.info(`Received command: .tts ${text} in thread ${threadID}`);

     
            if (!text) {
                logger.warn("No text provided");
                return api.sendMessage(
                    `${config.bot.botName}: Please provide text to convert to speech. Example: {pn}tts Hello, how are you?`,
                    threadID,
                    messageID
                );
            }

     
            const apiUrl = `${TTS_API_URL}?text=${encodeURIComponent(text)}`;
            logger.info(`Sending request to TTS API: ${apiUrl}`);

     
            const tempDir = path.join(__dirname, '..', '..', 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            const fileName = `tts_${crypto.randomBytes(8).toString('hex')}.mp3`;
            filePath = path.join(tempDir, fileName);

     
            const response = await axios.get(apiUrl, {
                responseType: 'stream',
                timeout: 30000 
            });

   
            const contentType = response.headers['content-type'];
            if (!contentType || !contentType.startsWith('audio/')) {
                throw new Error("API response is not an audio file");
            }


            const writer = fs.createWriteStream(filePath);
            response.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

     
            const stats = fs.statSync(filePath);
            if (stats.size === 0) throw new Error("Downloaded TTS audio is empty");

     
            const msg = {
                body: `${config.bot.botName}: 🎙️ Here is your text-to-speech audio!`,
                attachment: fs.createReadStream(filePath)
            };

     
            logger.info(`Sending TTS audio for text: "${text}"`);
            await api.sendMessage(msg, threadID);
            logger.info("TTS audio sent successfully");

    
            fs.unlinkSync(filePath);
        } catch (err) {
            logger.error(`Error in tts command: ${err.message}`, { stack: err.stack });
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