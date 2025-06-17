const config = require('../../config/config.json');
const logger = require('../../includes/logger');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ====== CONFIG ZONE ======
const ANISEARCH_API_URL = 'https://nexalo-api.vercel.app/api/animesearch';
const ANIMEINFO_API_URL = 'https://nexalo-api.vercel.app/api/animeinfo';
// ==========================

module.exports = {
    name: "anisearch",
    version: "1.0.0",
    author: "Hridoy",
    description: "Searches for anime and retrieves detailed information.",
    adminOnly: false,
    commandCategory: "Anime",
    guide: "Use {pn}anisearch <anime name> to search for anime details.\nExample: {pn}anisearch One Punch Man",
    cooldowns: 5,
    usePrefix: true,

    async execute({ api, event, args }) {
        const threadID = event.threadID;
        const messageID = event.messageID;

        let filePath; 

        try {
    
            if (!event || !threadID || !messageID) {
                logger.error("Invalid event object in anisearch command", { event });
                return api.sendMessage(`${config.bot.botName}: ❌ Invalid event data.`, threadID);
            }

            const query = args.join(" ").trim();
            logger.info(`Received command: .anisearch ${query} in thread ${threadID}`);

        
            if (!query) {
                logger.warn("No query provided");
                return api.sendMessage(
                    `${config.bot.botName}: Please provide an anime name to search. Example: {pn}anisearch One Punch Man`,
                    threadID,
                    messageID
                );
            }

      
            const searchUrl = `${ANISEARCH_API_URL}?query=${encodeURIComponent(query)}`;
            logger.info(`Sending request to Anime Search API: ${searchUrl}`);

            let searchResponse;
            try {
                searchResponse = await axios.get(searchUrl, { timeout: 30000 });
            } catch (err) {
                throw new Error("Failed to search for anime: " + err.message);
            }

            const searchData = searchResponse.data;
            if (!Array.isArray(searchData) || searchData.length === 0) {
                return api.sendMessage(
                    `${config.bot.botName}: No anime found for "${query}".`,
                    threadID,
                    messageID
                );
            }

        
            const firstAnime = searchData[0];
            const infoUrl = `${ANIMEINFO_API_URL}?url=${encodeURIComponent(firstAnime.link)}`;
            logger.info(`Sending request to Anime Info API: ${infoUrl}`);

            let infoResponse;
            try {
                infoResponse = await axios.get(infoUrl, { timeout: 30000 });
            } catch (err) {
                throw new Error("Failed to fetch anime details: " + err.message);
            }

            const animeInfo = infoResponse.data;
            if (!animeInfo || !animeInfo.title) {
                throw new Error("Invalid anime info response");
            }

   
            const tempDir = path.join(__dirname, '..', '..', 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            const fileName = `anime_${crypto.randomBytes(8).toString('hex')}.jpg`;
            filePath = path.join(tempDir, fileName);

  
            logger.info(`Downloading anime image from: ${animeInfo.imageUrl}`);
            const imageResponse = await axios.get(animeInfo.imageUrl, {
                responseType: 'stream',
                timeout: 30000
            });

      
            const contentType = imageResponse.headers['content-type'];
            if (!contentType || !contentType.startsWith('image/')) {
                throw new Error("API response is not an image file");
            }

       
            const writer = fs.createWriteStream(filePath);
            imageResponse.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

     
            const stats = fs.statSync(filePath);
            if (stats.size === 0) throw new Error("Downloaded image is empty");

   
            const genres = animeInfo.information.genres ? animeInfo.information.genres.replace(/, /g, ", ") : "None";
            const themes = animeInfo.information.themes ? animeInfo.information.themes.replace(/, /g, ", ") : "None";

      
            const msgBody = `${config.bot.botName}: Anime Information\n\n` +
                           `📺 Title: ${animeInfo.title}\n` +
                           `📜 Synopsis: ${animeInfo.synopsis.slice(0, 200)}${animeInfo.synopsis.length > 200 ? '...' : ''}\n` +
                           `🎭 Type: ${animeInfo.information.type}\n` +
                           `📅 Episodes: ${animeInfo.information.episodes}\n` +
                           `⭐ Score: ${animeInfo.statistics.score}\n` +
                           `🎨 Genres: ${genres}\n` +
                           `🏷️ Themes: ${themes}\n` +
                           `🔗 Link: ${animeInfo.link}`;

      
            const msg = {
                body: msgBody,
                attachment: fs.createReadStream(filePath)
            };

    
            logger.info(`Sending anime info for: ${animeInfo.title}`);
            await api.sendMessage(msg, threadID);
            logger.info("Anime info sent successfully");

         
            fs.unlinkSync(filePath);
        } catch (err) {
            logger.error(`Error in anisearch command: ${err.message}`, { stack: err.stack });
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