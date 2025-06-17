const config = require('../../config/config.json');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const FormData = require('form-data');

module.exports = {
    name: "4k",
    version: "1.0.0",
    author: "Hridoy",
    description: "Enhance a replied image to 4K quality using Remini API after uploading to ImgBB.",
    adminOnly: false,
    commandCategory: "Image",
    guide: "{pn}4k - Reply to an image to enhance it to 4K quality.",
    cooldowns: 10,
    usePrefix: true,

    async execute({ api, event }) {
        const threadID = event.threadID;
        const messageID = event.messageID;
        const prefix = config.prefix || ".";

        if (!event.messageReply || !event.messageReply.attachments || event.messageReply.attachments.length === 0) {
            return api.sendMessage(`${config.bot.botName}: ❌ Please reply to a message with an image to enhance (e.g., ${prefix}4k).`, threadID, messageID);
        }

        const attachment = event.messageReply.attachments[0];
        if (!attachment.url || !attachment.type.includes('photo')) {
            return api.sendMessage(`${config.bot.botName}: ❌ The replied message must contain an image.`, threadID, messageID);
        }

        const imageUrl = attachment.url;
        console.log(`Downloading image from URL: ${imageUrl}`);

        try {
            const tempDir = path.join(__dirname, '../../temp');
            await fs.ensureDir(tempDir);

            const fileName = `original_${Date.now()}_${Math.random().toString(36).substr(2, 5)}.jpg`;
            const filePath = path.join(tempDir, fileName);

            const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 10000 });
            await fs.writeFile(filePath, imageResponse.data);
            console.log(`Image downloaded to: ${filePath}`);

            const form = new FormData();
            form.append('image', fs.createReadStream(filePath));
            console.log(`Uploading image to ImgBB`);

            const imgbbResponse = await axios.post('https://api.imgbb.com/1/upload', form, {
                headers: form.getHeaders(),
                params: { key: '18252cd96ada25e02f3c4eda8840b53b' },
                timeout: 10000
            });

            const imgbbUrl = imgbbResponse.data.data.url;
            console.log(`Image uploaded to ImgBB: ${imgbbUrl}`);

            await fs.unlink(filePath).catch(err => console.log(`Failed to clean up ${filePath}: ${err.message}`));
            console.log(`Cleaned up original image: ${filePath}`);

            const apiUrl = `https://nexalo-api.vercel.app/api/remini?url=${encodeURIComponent(imgbbUrl)}`;
            console.log(`Sending request to Remini API: ${apiUrl}`);

            const reminiResponse = await axios.get(apiUrl, { timeout: 10000 });
            const data = reminiResponse.data;
            console.log(`Remini API response received: ${JSON.stringify(data)}`);

            if (!data.response) {
                return api.sendMessage(`${config.bot.botName}: ❌ Failed to enhance the image. No response from Remini API.`, threadID, messageID);
            }

            const enhancedImageUrl = data.response;
            const enhancedFileName = `remini_${Date.now()}_${Math.random().toString(36).substr(2, 5)}.png`;
            const enhancedFilePath = path.join(tempDir, enhancedFileName);
            console.log(`Downloading enhanced image from ${enhancedImageUrl} to ${enhancedFilePath}`);

            const enhancedImageResponse = await axios.get(enhancedImageUrl, { responseType: 'arraybuffer', timeout: 10000 });
            await fs.writeFile(enhancedFilePath, enhancedImageResponse.data);
            console.log(`Enhanced image saved: ${enhancedFilePath}`);

            const msg = {
                body: `${config.bot.botName}: 🌟 Enhanced image to 4K quality!`,
                attachment: fs.createReadStream(enhancedFilePath)
            };

            await api.sendMessage(msg, threadID, messageID);
            console.log(`Sent enhanced image to thread ${threadID}`);

            await fs.unlink(enhancedFilePath).catch(err => console.log(`Failed to clean up ${enhancedFilePath}: ${err.message}`));
            console.log(`Cleaned up enhanced image: ${enhancedFilePath}`);
        } catch (error) {
            console.log(`Error in 4k command: ${error.message}`);
            api.sendMessage(`${config.bot.botName}: ❌ Failed to enhance image: ${error.message}`, threadID, messageID);
        }
    }
};