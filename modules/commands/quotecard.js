const config = require('../../config/config.json');
const logger = require('../../includes/logger');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createCanvas, loadImage } = require('canvas');

// ====== CONFIG ZONE ======
const ACCESS_TOKEN = '6628568379|c1e620fa708a1d5696fb991c1bde5662'; 
// ==========================

module.exports = {
    name: "quotecard",
    version: "1.0.0",
    author: "Hridoy",
    description: "Generate a beautiful quote card with your text and customizable styles 📝✨",
    adminOnly: false,
    commandCategory: "Fun",
    guide: "Use {pn}quotecard [style] [quote text] | [author] to generate a quote card. Available styles: elegant, nature, minimal, gradient, dark.",
    cooldowns: 5,
    usePrefix: true,

    async execute({ api, event, args }) {
        const threadID = event.threadID;
        const messageID = event.messageID;
        const senderID = event.senderID;

        let filePath;

        try {
          
            const fullText = args.join(" ");
            
           
            let style = "elegant";
            let quoteText = "The best way to predict the future is to create it.";
            let quoteAuthor = "Abraham Lincoln";
     
            if (fullText.length > 0) {
       
                const styles = ["elegant", "nature", "minimal", "gradient", "dark"];
                const firstWord = args[0].toLowerCase();
                
                if (styles.includes(firstWord)) {
                    style = firstWord;
                    const remainingText = args.slice(1).join(" ");
                    
              
                    if (remainingText.includes("|")) {
                        const parts = remainingText.split("|");
                        quoteText = parts[0].trim();
                        quoteAuthor = parts[1].trim() || "Unknown";
                    } else {
                        quoteText = remainingText.trim();
                    }
                } else {
            
                    if (fullText.includes("|")) {
                        const parts = fullText.split("|");
                        quoteText = parts[0].trim();
                        quoteAuthor = parts[1].trim() || "Unknown";
                    } else {
                        quoteText = fullText.trim();
                    }
                }
            }
            
            logger.info(`Received command: .quotecard with style: ${style}, quote length: ${quoteText.length}`);

      
            const userInfo = await new Promise((resolve, reject) => {
                api.getUserInfo([senderID], (err, info) => {
                    if (err) reject(err);
                    else resolve(info);
                });
            });

            const userName = userInfo[senderID]?.name || "Unknown User";
            
        
            const profilePicUrl = `https://graph.facebook.com/${senderID}/picture?width=512&height=512&access_token=${ACCESS_TOKEN}`;
            const imageResponse = await axios.get(profilePicUrl, { responseType: 'arraybuffer' });
            const profilePic = await loadImage(Buffer.from(imageResponse.data));

    
            const canvasWidth = 1200;
            const canvasHeight = 1200;
            const canvas = createCanvas(canvasWidth, canvasHeight);
            const ctx = canvas.getContext('2d');

       
            await applyBackground(ctx, style, canvasWidth, canvasHeight);
            
    
            drawQuoteText(ctx, quoteText, quoteAuthor, style, canvasWidth, canvasHeight);
            
       
            if (style !== "minimal") {
                drawProfilePicture(ctx, profilePic, style, canvasWidth, canvasHeight);
            }
            
 
            addDecorativeElements(ctx, style, canvasWidth, canvasHeight);
 
            ctx.font = '20px Arial, sans-serif';
            ctx.fillStyle = getTextColor(style, 0.5); 
            ctx.textAlign = 'right';
            ctx.fillText(`${config.bot.botName}`, canvasWidth - 40, canvasHeight - 30);

     
            const tempDir = path.join(__dirname, '..', '..', 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            const fileName = `quotecard_${crypto.randomBytes(8).toString('hex')}.png`;
            filePath = path.join(tempDir, fileName);

            const out = fs.createWriteStream(filePath);
            const stream = canvas.createPNGStream({ quality: 0.95 }); 
            stream.pipe(out);

            await new Promise((resolve, reject) => {
                out.on('finish', resolve);
                out.on('error', reject);
            });

      
            const stats = fs.statSync(filePath);
            if (stats.size === 0) throw new Error("Generated image file is empty");

        
            const msg = {
                body: `${config.bot.botName}: ✨ Here's your "${style}" quote card! ✨`,
                attachment: fs.createReadStream(filePath)
            };

            logger.info(`Sending quote card with style: ${style} for user: ${userName}`);
            await new Promise((resolve, reject) => {
                api.sendMessage(msg, threadID, (err) => {
                    if (err) return reject(err);
                    api.setMessageReaction("📝", messageID, () => {}, true);
                    resolve();
                }, messageID);
            });
            logger.info("Quote card sent successfully");

   
            fs.unlinkSync(filePath);
            logger.info(`[Quotecard Command] Generated quote card for ${userName}`);
        } catch (err) {
            logger.error(`Error in quotecard command: ${err.message}`, { stack: err.stack });

          
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
        
 
        async function applyBackground(ctx, style, width, height) {
            switch (style) {
                case "elegant":
                    
                    const elegantGradient = ctx.createLinearGradient(0, 0, width, height);
                    elegantGradient.addColorStop(0, '#000000');
                    elegantGradient.addColorStop(1, '#2c2c2c');
                    ctx.fillStyle = elegantGradient;
                    ctx.fillRect(0, 0, width, height);
                    
             
                    ctx.fillStyle = 'rgba(212, 175, 55, 0.1)';
                    for (let i = 0; i < width; i += 30) {
                        for (let j = 0; j < height; j += 30) {
                            ctx.beginPath();
                            ctx.arc(i, j, 2, 0, Math.PI * 2);
                            ctx.fill();
                        }
                    }
                    break;
                    
                case "nature":
                  
                    const natureGradient = ctx.createLinearGradient(0, 0, width, height);
                    natureGradient.addColorStop(0, '#134e5e');
                    natureGradient.addColorStop(1, '#71b280');
                    ctx.fillStyle = natureGradient;
                    ctx.fillRect(0, 0, width, height);
                    
       
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
                    ctx.lineWidth = 2;
                    for (let i = 0; i < 20; i++) {
                        const x = Math.random() * width;
                        const y = Math.random() * height;
                        const size = Math.random() * 100 + 50;
                        
                        ctx.beginPath();
                        ctx.moveTo(x, y);
                        ctx.bezierCurveTo(
                            x + size/2, y - size/3,
                            x + size, y - size/6,
                            x + size, y + size/2
                        );
                        ctx.bezierCurveTo(
                            x + size, y + size,
                            x + size/2, y + size,
                            x, y + size/2
                        );
                        ctx.closePath();
                        ctx.stroke();
                    }
                    break;
                    
                case "minimal":
          
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, width, height);
                    
            
                    ctx.strokeStyle = 'rgba(0, 0, 0, 0.05)';
                    ctx.lineWidth = 1;
                    
                    for (let i = 0; i < width; i += 40) {
                        ctx.beginPath();
                        ctx.moveTo(i, 0);
                        ctx.lineTo(i, height);
                        ctx.stroke();
                    }
                    
                    for (let j = 0; j < height; j += 40) {
                        ctx.beginPath();
                        ctx.moveTo(0, j);
                        ctx.lineTo(width, j);
                        ctx.stroke();
                    }
                    break;
                    
                case "gradient":
           
                    const vibrantGradient = ctx.createLinearGradient(0, 0, width, height);
                    vibrantGradient.addColorStop(0, '#8A2387');
                    vibrantGradient.addColorStop(0.5, '#E94057');
                    vibrantGradient.addColorStop(1, '#F27121');
                    ctx.fillStyle = vibrantGradient;
                    ctx.fillRect(0, 0, width, height);
                    
              
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
                    ctx.lineWidth = 5;
                    
                    for (let i = 0; i < 5; i++) {
                        ctx.beginPath();
                        ctx.moveTo(0, 200 + i * 200);
                        
                        for (let x = 0; x < width; x += 20) {
                            const y = 200 + i * 200 + Math.sin(x / 50) * 50;
                            ctx.lineTo(x, y);
                        }
                        
                        ctx.stroke();
                    }
                    break;
                    
                case "dark":
              
                    ctx.fillStyle = '#0a0a0a';
                    ctx.fillRect(0, 0, width, height);
                    
            
                    for (let i = 0; i < 200; i++) {
                        const x = Math.random() * width;
                        const y = Math.random() * height;
                        const radius = Math.random() * 2 + 1;
                        const opacity = Math.random() * 0.8 + 0.2;
                        
                        ctx.beginPath();
                        ctx.arc(x, y, radius, 0, Math.PI * 2);
                        ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
                        ctx.fill();
                    }
            
                    for (let i = 0; i < 5; i++) {
                        const x = Math.random() * width;
                        const y = Math.random() * height;
                        const radius = Math.random() * 300 + 100;
                        
                        const nebulaGradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
                        const hue = Math.random() * 360;
                        nebulaGradient.addColorStop(0, `hsla(${hue}, 100%, 70%, 0.1)`);
                        nebulaGradient.addColorStop(1, `hsla(${hue}, 100%, 50%, 0)`);
                        
                        ctx.beginPath();
                        ctx.arc(x, y, radius, 0, Math.PI * 2);
                        ctx.fillStyle = nebulaGradient;
                        ctx.fill();
                    }
                    break;
            }
        }
        
    
        function drawQuoteText(ctx, text, author, style, width, height) {
            const textColor = getTextColor(style);
            const maxWidth = width * 0.8;
            const startX = width * 0.1;
            let startY = height * 0.4;
            
     
            if (style !== "minimal") {
                ctx.font = 'bold 120px Georgia, serif';
                ctx.fillStyle = getTextColor(style, 0.2);
                ctx.textAlign = 'left';
                ctx.fillText('"', startX - 60, startY - 40);
                
                ctx.textAlign = 'right';
                ctx.fillText('"', width - startX + 60, startY + 120);
            }
            
        
            ctx.font = getFontForStyle(style);
            ctx.fillStyle = textColor;
            ctx.textAlign = 'center';
            
            const words = text.split(' ');
            let line = '';
            let y = startY;
            
            for (let i = 0; i < words.length; i++) {
                const testLine = line + words[i] + ' ';
                const metrics = ctx.measureText(testLine);
                const testWidth = metrics.width;
                
                if (testWidth > maxWidth && i > 0) {
                    ctx.fillText(line, width / 2, y);
                    line = words[i] + ' ';
                    y += 60; 
                } else {
                    line = testLine;
                }
            }
            
            ctx.fillText(line, width / 2, y);
            
       
            if (author) {
                ctx.font = getAuthorFontForStyle(style);
                ctx.fillStyle = getTextColor(style, 0.8);
                ctx.textAlign = 'center';
                
              
                const lineY = y + 80;
                ctx.beginPath();
                ctx.moveTo(width / 2 - 40, lineY);
                ctx.lineTo(width / 2 + 40, lineY);
                ctx.strokeStyle = getTextColor(style, 0.5);
                ctx.lineWidth = 2;
                ctx.stroke();
                
                ctx.fillText(`— ${author}`, width / 2, lineY + 40);
            }
        }
        
     
        function drawProfilePicture(ctx, image, style, width, height) {
            const size = 100;
            const x = width - size - 40;
            const y = height - size - 40;
            
      
            ctx.save();
            ctx.beginPath();
            ctx.arc(x + size/2, y + size/2, size/2, 0, Math.PI * 2);
            ctx.clip();
      
            ctx.drawImage(image, x, y, size, size);
            ctx.restore();
            
       
            ctx.beginPath();
            ctx.arc(x + size/2, y + size/2, size/2, 0, Math.PI * 2);
            ctx.lineWidth = 3;
            ctx.strokeStyle = getProfileBorderColor(style);
            ctx.stroke();
        }
        
  
        function addDecorativeElements(ctx, style, width, height) {
            switch (style) {
                case "elegant":
                  
                    const cornerSize = 100;
                    ctx.strokeStyle = 'rgba(212, 175, 55, 0.6)';
                    ctx.lineWidth = 3;
                    
               
                    ctx.beginPath();
                    ctx.moveTo(40, 40 + cornerSize);
                    ctx.lineTo(40, 40);
                    ctx.lineTo(40 + cornerSize, 40);
                    ctx.stroke();
                    
                 
                    ctx.beginPath();
                    ctx.moveTo(width - 40 - cornerSize, 40);
                    ctx.lineTo(width - 40, 40);
                    ctx.lineTo(width - 40, 40 + cornerSize);
                    ctx.stroke();
                    
               
                    ctx.beginPath();
                    ctx.moveTo(40, height - 40 - cornerSize);
                    ctx.lineTo(40, height - 40);
                    ctx.lineTo(40 + cornerSize, height - 40);
                    ctx.stroke();
                    
               
                    ctx.beginPath();
                    ctx.moveTo(width - 40 - cornerSize, height - 40);
                    ctx.lineTo(width - 40, height - 40);
                    ctx.lineTo(width - 40, height - 40 - cornerSize);
                    ctx.stroke();
                    break;
                    
                case "nature":
               
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
                    ctx.beginPath();
                    ctx.moveTo(40, 40);
                    ctx.bezierCurveTo(
                        width/4, height/8,
                        width/3, height/6,
                        width/2, height/4
                    );
                    ctx.bezierCurveTo(
                        width/3, height/3,
                        width/4, height/4,
                        40, 40
                    );
                    ctx.fill();
                    break;
                    
                case "minimal":
               
                    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
                    ctx.lineWidth = 2;
                    
                    const minCornerSize = 40;
                 
                    [
                        [40, 40, 1, 1], 
                        [width - 40, 40, -1, 1],
                        
                        [40, height - 40, 1, -1], 
                        
                        [width - 40, height - 40, -1, -1] 
                        
                    ].forEach(([x, y, dirX, dirY]) => {
                        ctx.beginPath();
                        ctx.moveTo(x, y);
                        ctx.lineTo(x + minCornerSize * dirX, y);
                        ctx.moveTo(x, y);
                        ctx.lineTo(x, y + minCornerSize * dirY);
                        ctx.stroke();
                    });
                    break;
                    
                case "gradient":
              
                

                    for (let i = 0; i < 5; i++) {
                        const radius = 100 + i * 20;
                        ctx.beginPath();
                        ctx.arc(width, 0, radius, 0, Math.PI * 2);
                        ctx.fillStyle = `rgba(255, 255, 255, ${0.05 - i * 0.01})`;
                        ctx.fill();
                    }
                    
                    for (let i = 0; i < 5; i++) {
                        const radius = 100 + i * 20;
                        ctx.beginPath();
                        ctx.arc(0, height, radius, 0, Math.PI * 2);
                        ctx.fillStyle = `rgba(255, 255, 255, ${0.05 - i * 0.01})`;
                        ctx.fill();
                    }
                    break;
                    
                case "dark":
              
                
                    const centerGradient = ctx.createRadialGradient(
                        width/2, height/2, 0,
                        width/2, height/2, width/2
                    );
                    centerGradient.addColorStop(0, 'rgba(100, 100, 255, 0.1)');
                    centerGradient.addColorStop(1, 'rgba(100, 100, 255, 0)');
                    
                    ctx.beginPath();
                    ctx.arc(width/2, height/2, width/2, 0, Math.PI * 2);
                    ctx.fillStyle = centerGradient;
                    ctx.fill();
                    break;
            }
        }
        
       
        

        function getTextColor(style, opacity = 1) {
            switch (style) {
                case "elegant": return `rgba(212, 175, 55, ${opacity})`; 
                case "nature": return `rgba(255, 255, 255, ${opacity})`;
                case "minimal": return `rgba(0, 0, 0, ${opacity})`;
                case "gradient": return `rgba(255, 255, 255, ${opacity})`;
                case "dark": return `rgba(255, 255, 255, ${opacity})`;
                default: return `rgba(255, 255, 255, ${opacity})`;
            }
        }
        
  
        
        function getFontForStyle(style) {
            switch (style) {
                case "elegant": return 'bold 48px "Palatino Linotype", serif';
                case "nature": return '48px "Georgia", serif';
                case "minimal": return '48px "Arial", sans-serif';
                case "gradient": return 'bold 48px "Verdana", sans-serif';
                case "dark": return '48px "Courier New", monospace';
                default: return '48px "Georgia", serif';
            }
        }
        
        

        function getAuthorFontForStyle(style) {
            switch (style) {
                case "elegant": return 'italic 32px "Palatino Linotype", serif';
                case "nature": return 'italic 32px "Georgia", serif';
                case "minimal": return '32px "Arial", sans-serif';
                case "gradient": return 'italic 32px "Verdana", sans-serif';
                case "dark": return 'italic 32px "Courier New", monospace';
                default: return 'italic 32px "Georgia", serif';
            }
        }
        
      
        function getProfileBorderColor(style) {
            switch (style) {
                case "elegant": return 'rgba(212, 175, 55, 0.8)'; 
                case "nature": return 'rgba(255, 255, 255, 0.8)';
                case "minimal": return 'rgba(0, 0, 0, 0.3)';
                case "gradient": return 'rgba(255, 255, 255, 0.8)';
                case "dark": return 'rgba(100, 100, 255, 0.8)';
                default: return 'rgba(255, 255, 255, 0.8)';
            }
        }
    }
};