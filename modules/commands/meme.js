const config = require('../../config/config.json');
const logger = require('../../includes/logger');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createCanvas, loadImage } = require('canvas');

module.exports = {
    name: "meme",
    version: "1.0.0",
    author: "Hridoy",
    description: "Generate a simple meme with your text 😂",
    adminOnly: false,
    commandCategory: "Fun",
    guide: "Use {pn}meme [top text] | [bottom text] to create a meme. You can also specify a template: {pn}meme drake | text1 | text2",
    cooldowns: 5,
    usePrefix: true,

    async execute({ api, event, args }) {
        const threadID = event.threadID;
        const messageID = event.messageID;
        const senderID = event.senderID;

        let filePath;

        try {
     
            const inputText = args.join(" ");
            
      
            let template = "default";
            let topText = "TOP TEXT";
            let bottomText = "BOTTOM TEXT";
            
        
            if (inputText.includes("|")) {
                const parts = inputText.split("|").map(part => part.trim());
                
                if (parts.length === 2) {
              
                    topText = parts[0] || topText;
                    bottomText = parts[1] || bottomText;
                } else if (parts.length >= 3) {
           
                    template = parts[0].toLowerCase() || template;
                    topText = parts[1] || topText;
                    bottomText = parts[2] || bottomText;
                }
            } else if (inputText) {
           
                topText = inputText;
            }
            
            logger.info(`Received command: .meme with template: ${template}, top: "${topText}", bottom: "${bottomText}"`);

          
            const memeBuffer = await createMeme(template, topText, bottomText);

        
            const tempDir = path.join(__dirname, '..', '..', 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            const fileName = `meme_${crypto.randomBytes(8).toString('hex')}.png`;
            filePath = path.join(tempDir, fileName);

            fs.writeFileSync(filePath, memeBuffer);

        
            const msg = {
                body: `${config.bot.botName}: 😂 Here's your meme!`,
                attachment: fs.createReadStream(filePath)
            };

            logger.info(`Sending meme with template: ${template}`);
            await new Promise((resolve, reject) => {
                api.sendMessage(msg, threadID, (err) => {
                    if (err) return reject(err);
                    api.setMessageReaction("😂", messageID, () => {}, true);
                    resolve();
                }, messageID);
            });
            logger.info("Meme sent successfully");

       
            fs.unlinkSync(filePath);
            logger.info(`[Meme Command] Generated meme with template: ${template}`);
        } catch (err) {
            logger.error(`Error in meme command: ${err.message}`, { stack: err.stack });

     
            api.setMessageReaction("❌", messageID, () => {}, true);
            await api.sendMessage(
                `${config.bot.botName}: ⚠️ Error: ${err.message}`,
                threadID,
                messageID
            );

          
            if (filePath && fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

   
        async function createMeme(template, topText, bottomText) {
       
            const templates = {
                "default": {
                    url: "https://i.imgflip.com/4/1bij.jpg", 
                    width: 568,
                    height: 335
                },
                "drake": {
                    url: "https://i.imgflip.com/4/30b1gx.jpg", 
                    width: 1200,
                    height: 1200,
                    special: true 
                },
                "distracted": {
                    url: "https://i.imgflip.com/4/1ur9b0.jpg", 
                    width: 1200,
                    height: 800
                },
                "button": {
                    url: "https://i.imgflip.com/4/1yxkcp.jpg", 
                    width: 600,
                    height: 908,
                    special: true 
                },
                "change": {
                    url: "https://i.imgflip.com/4/1qmn2w.jpg", 
                    width: 482,
                    height: 361,
                    special: true 
                }
            };
            
        
            const selectedTemplate = templates[template] || templates["default"];
            
            try {
             
                const imageResponse = await axios.get(selectedTemplate.url, { responseType: 'arraybuffer' });
                const templateImage = await loadImage(Buffer.from(imageResponse.data));
                
             
                const canvas = createCanvas(selectedTemplate.width, selectedTemplate.height);
                const ctx = canvas.getContext('2d');
                
            
                ctx.drawImage(templateImage, 0, 0, selectedTemplate.width, selectedTemplate.height);
                
           
                if (selectedTemplate.special) {
                    switch(template) {
                        case "drake":
                      
                            ctx.font = 'bold 40px Impact';
                            ctx.fillStyle = '#000000';
                            ctx.textAlign = 'left';
                            
                        
                            wrapText(ctx, bottomText, 650, 300, 500, 50);
                       
                            
                            wrapText(ctx, topText, 650, 900, 500, 50);
                            break;
                            
                        case "button":
                
                            ctx.font = 'bold 30px Impact';
                            ctx.fillStyle = '#FFFFFF';
                            ctx.textAlign = 'center';
                            
                   
                            wrapText(ctx, topText, 200, 200, 150, 40);
                            
                       
                            wrapText(ctx, bottomText, 400, 200, 150, 40);
                            break;
                            
                        case "change":
                          
                            ctx.font = 'bold 30px Impact';
                            ctx.fillStyle = '#000000';
                            ctx.textAlign = 'center';
                            
                       
                            wrapText(ctx, topText, 250, 180, 300, 40);
                            break;
                    }
                } else {
                 
                    ctx.font = 'bold 40px Impact';
                    ctx.fillStyle = '#FFFFFF';
                    ctx.strokeStyle = '#000000';
                    ctx.lineWidth = 3;
                    ctx.textAlign = 'center';
                    
              
                    const topY = 60;
                    wrapText(ctx, topText.toUpperCase(), selectedTemplate.width / 2, topY, selectedTemplate.width - 20, 50, true);
                    
            
                    const bottomY = selectedTemplate.height - 40;
                    wrapText(ctx, bottomText.toUpperCase(), selectedTemplate.width / 2, bottomY, selectedTemplate.width - 20, 50, true);
                }
                
           
                return canvas.toBuffer('image/png');
            } catch (error) {
                logger.error(`Error creating meme: ${error.message}`);
                throw new Error('Failed to create meme.');
            }
        }
        
     
        function wrapText(ctx, text, x, y, maxWidth, lineHeight, stroke = false) {
            const words = text.split(' ');
            let line = '';
            let testLine = '';
            let lineCount = 0;
            
            for (let n = 0; n < words.length; n++) {
                testLine = line + words[n] + ' ';
                const metrics = ctx.measureText(testLine);
                const testWidth = metrics.width;
                
                if (testWidth > maxWidth && n > 0) {
                    if (stroke) {
                        ctx.strokeText(line, x, y - (lineHeight * lineCount));
                        ctx.fillText(line, x, y - (lineHeight * lineCount));
                    } else {
                        ctx.fillText(line, x, y - (lineHeight * lineCount));
                    }
                    
                    line = words[n] + ' ';
                    lineCount++;
                } else {
                    line = testLine;
                }
            }
            
          
            if (stroke) {
                ctx.strokeText(line, x, y - (lineHeight * lineCount));
                ctx.fillText(line, x, y - (lineHeight * lineCount));
            } else {
                ctx.fillText(line, x, y - (lineHeight * lineCount));
            }
        }
    }
};