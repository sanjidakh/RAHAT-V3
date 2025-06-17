const config = require('../../config/config.json');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

module.exports = {
    name: "art",
    version: "1.0.0",
    author: "Hridoy",
    description: "Generate AI art based on a user prompt.",
    adminOnly: false,
    commandCategory: "AI",
    guide: "{pn}art <prompt> - Generate AI art with the given prompt (e.g., !art futuristic city).",
    cooldowns: 10,
    usePrefix: true,

    async execute({ api, event }) {
        const threadID = event.threadID;
        const messageID = event.messageID;
        const args = event.body.split(' ').slice(1);
        const prefix = config.prefix || "!";

        if (!args[0]) {
            return api.sendMessage(`${config.bot.botName}: ❌ Please provide a prompt (e.g., ${prefix}art futuristic city).`, threadID, messageID);
        }

        const prompt = args.join(' ');
        console.log(`Generating AI art for prompt: ${prompt}`);

        try {
            const apiUrl = `https://nexalo-api.vercel.app/api/art?prompt=${encodeURIComponent(prompt)}`;
            console.log(`Sending request to ${apiUrl}`);

            const response = await axios.get(apiUrl, { timeout: 10000 });
            const data = response.data;
            console.log(`API response received: ${JSON.stringify(data)}`);

            if (!data.response) {
                return api.sendMessage(`${config.bot.botName}: ❌ No art generated for "${prompt}".`, threadID, messageID);
            }

            const imageUrl = data.response;
            const tempDir = path.join(__dirname, '../../temp');
            await fs.ensureDir(tempDir);

            const fileName = `art_${Date.now()}_${Math.random().toString(36).substr(2, 5)}.jpg`;
            const filePath = path.join(tempDir, fileName);
            console.log(`Downloading image from ${imageUrl} to ${filePath}`);

            let imageResponse;
            const maxRetries = 2;
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 30000 });
                    break;
                } catch (error) {
                    if (attempt === maxRetries) {
                        throw new Error(`Failed to download image after ${maxRetries} attempts: ${error.message}`);
                    }
                    console.log(`Attempt ${attempt} failed: ${error.message}. Retrying...`);
                    await new Promise(resolve => setTimeout(resolve, 2000)); 
                }
            }

            await fs.writeFile(filePath, imageResponse.data);
            console.log(`Image saved: ${filePath}`);

            const msg = {
                body: `${config.bot.botName}: 🎨 Generated AI art for "${prompt}"!`,
                attachment: fs.createReadStream(filePath)
            };

            await api.sendMessage(msg, threadID, messageID);
            console.log(`Sent art image to thread ${threadID}`);

            await fs.unlink(filePath).catch(err => console.log(`Failed to clean up ${filePath}: ${err.message}`));
            console.log(`Cleaned up ${filePath}`);
        } catch (error) {
            console.log(`Error in art command: ${error.message}`);
            api.sendMessage(`${config.bot.botName}: ❌ Failed to generate art: ${error.message}`, threadID, messageID);
        }
    }
};