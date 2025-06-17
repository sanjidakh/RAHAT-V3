const config = require('../../config/config.json');
const logger = require('../../includes/logger');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createCanvas } = require('canvas');

module.exports = {
    name: "arttext",
    version: "1.0.0",
    author: "Hridoy",
    description: "Generate stylized text art with cool effects 🎨",
    adminOnly: false,
    commandCategory: "Fun",
    guide: "Use {pn}arttext [style] [your text] to create stylized text. Styles: neon, shadow, retro, glitch, bubble",
    cooldowns: 3,
    usePrefix: true,

    async execute({ api, event, args }) {
        const threadID = event.threadID;
        const messageID = event.messageID;
        const senderID = event.senderID;

        let filePath;

        try {
            // Parse command arguments
            let style = "neon";
            let text = "AWESOME";
            
            if (args.length > 0) {
                const styles = ["neon", "shadow", "retro", "glitch", "bubble"];
                if (styles.includes(args[0].toLowerCase())) {
                    style = args[0].toLowerCase();
                    text = args.slice(1).join(" ") || "AWESOME";
                } else {
                    text = args.join(" ");
                }
            }
            
            // Limit text length to prevent issues
            if (text.length > 30) {
                text = text.substring(0, 30);
            }
            
            logger.info(`Received command: .arttext with style: ${style}, text: ${text}`);

            // Create the canvas
            const canvasWidth = 800;
            const canvasHeight = 400;
            const canvas = createCanvas(canvasWidth, canvasHeight);
            const ctx = canvas.getContext('2d');

            // Apply background based on style
            applyBackground(ctx, style, canvasWidth, canvasHeight);
            
            // Draw the stylized text
            drawStylizedText(ctx, text, style, canvasWidth, canvasHeight);
            
            // Add a subtle signature
            ctx.font = '16px Arial, sans-serif';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.textAlign = 'right';
            ctx.fillText(`${config.bot.botName}`, canvasWidth - 20, canvasHeight - 20);

            // Save the canvas image to a temporary file
            const tempDir = path.join(__dirname, '..', '..', 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            const fileName = `arttext_${crypto.randomBytes(8).toString('hex')}.png`;
            filePath = path.join(tempDir, fileName);

            const out = fs.createWriteStream(filePath);
            const stream = canvas.createPNGStream({ quality: 0.95 });
            stream.pipe(out);

            await new Promise((resolve, reject) => {
                out.on('finish', resolve);
                out.on('error', reject);
            });

            // Send the image to the user
            const msg = {
                body: `${config.bot.botName}: ✨ Here's your "${style}" text art! ✨`,
                attachment: fs.createReadStream(filePath)
            };

            await new Promise((resolve, reject) => {
                api.sendMessage(msg, threadID, (err) => {
                    if (err) return reject(err);
                    api.setMessageReaction("🎨", messageID, () => {}, true);
                    resolve();
                }, messageID);
            });
            logger.info("Art text sent successfully");

            // Delete the temporary file after sending
            fs.unlinkSync(filePath);
        } catch (err) {
            logger.error(`Error in arttext command: ${err.message}`, { stack: err.stack });

            // Send error message with reaction
            api.setMessageReaction("❌", messageID, () => {}, true);
            await api.sendMessage(
                `${config.bot.botName}: ⚠️ Error: ${err.message}`,
                threadID,
                messageID
            );

            // Ensure the temporary file is deleted even if sending fails
            if (filePath && fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
        
        // Helper function to apply background
        function applyBackground(ctx, style, width, height) {
            switch (style) {
                case "neon":
                    // Dark background for neon effect
                    ctx.fillStyle = '#0a0a0a';
                    ctx.fillRect(0, 0, width, height);
                    break;
                    
                case "shadow":
                    // Gradient background for shadow effect
                    const shadowGradient = ctx.createLinearGradient(0, 0, width, height);
                    shadowGradient.addColorStop(0, '#2c3e50');
                    shadowGradient.addColorStop(1, '#4ca1af');
                    ctx.fillStyle = shadowGradient;
                    ctx.fillRect(0, 0, width, height);
                    break;
                    
                case "retro":
                    // Retro sunset gradient
                    const retroGradient = ctx.createLinearGradient(0, 0, 0, height);
                    retroGradient.addColorStop(0, '#ff8c00');
                    retroGradient.addColorStop(0.5, '#ff0080');
                    retroGradient.addColorStop(1, '#4b0082');
                    ctx.fillStyle = retroGradient;
                    ctx.fillRect(0, 0, width, height);
                    
                    // Add retro sun
                    ctx.beginPath();
                    ctx.arc(width/2, height * 0.8, height * 0.3, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
                    ctx.fill();
                    
                    // Add grid lines
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
                    ctx.lineWidth = 2;
                    
                    // Horizontal lines
                    for (let y = height * 0.6; y < height; y += 20) {
                        ctx.beginPath();
                        ctx.moveTo(0, y);
                        ctx.lineTo(width, y);
                        ctx.stroke();
                    }
                    break;
                    
                case "glitch":
                    // Dark background for glitch effect
                    ctx.fillStyle = '#121212';
                    ctx.fillRect(0, 0, width, height);
                    
                    // Add glitch lines
                    for (let i = 0; i < 10; i++) {
                        const y = Math.random() * height;
                        const h = Math.random() * 20 + 5;
                        const color = `rgba(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255}, 0.3)`;
                        
                        ctx.fillStyle = color;
                        ctx.fillRect(0, y, width, h);
                    }
                    break;
                    
                case "bubble":
                    // Light gradient for bubble effect
                    const bubbleGradient = ctx.createLinearGradient(0, 0, width, height);
                    bubbleGradient.addColorStop(0, '#89f7fe');
                    bubbleGradient.addColorStop(1, '#66a6ff');
                    ctx.fillStyle = bubbleGradient;
                    ctx.fillRect(0, 0, width, height);
                    
                    // Add bubble circles
                    for (let i = 0; i < 20; i++) {
                        const x = Math.random() * width;
                        const y = Math.random() * height;
                        const radius = Math.random() * 40 + 10;
                        
                        ctx.beginPath();
                        ctx.arc(x, y, radius, 0, Math.PI * 2);
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                        ctx.fill();
                    }
                    break;
            }
        }
        
        // Helper function to draw stylized text
        function drawStylizedText(ctx, text, style, width, height) {
            // Center position
            const centerX = width / 2;
            const centerY = height / 2;
            
            switch (style) {
                case "neon":
                    // Neon glow effect
                    const neonColor = '#00ffff';
                    
                    // Set font
                    ctx.font = 'bold 80px Arial, sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    
                    // Draw multiple layers of glow
                    for (let i = 10; i > 0; i--) {
                        ctx.shadowColor = neonColor;
                        ctx.shadowBlur = i * 5;
                        ctx.fillStyle = `rgba(0, 255, 255, ${i/10})`;
                        ctx.fillText(text, centerX, centerY);
                    }
                    
                    // Draw the main text
                    ctx.shadowBlur = 20;
                    ctx.fillStyle = '#ffffff';
                    ctx.fillText(text, centerX, centerY);
                    break;
                    
                case "shadow":
                    // 3D shadow effect
                    ctx.font = 'bold 90px Impact, sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    
                    // Draw multiple shadow layers
                    for (let i = 15; i > 0; i--) {
                        ctx.fillStyle = `rgba(0, 0, 0, ${i/30})`;
                        ctx.fillText(text, centerX + i, centerY + i);
                    }
                    
                    // Draw the main text
                    ctx.fillStyle = '#ffffff';
                    ctx.fillText(text, centerX, centerY);
                    break;
                    
                case "retro":
                    // Retro 80s style text
                    ctx.font = 'bold 90px "Arial Black", sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    
                    // Draw outline
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 8;
                    ctx.strokeText(text, centerX, centerY);
                    
                    // Draw fill
                    const retroTextGradient = ctx.createLinearGradient(
                        centerX - ctx.measureText(text).width/2, centerY - 40,
                        centerX + ctx.measureText(text).width/2, centerY + 40
                    );
                    retroTextGradient.addColorStop(0, '#ff00ff');
                    retroTextGradient.addColorStop(1, '#00ffff');
                    
                    ctx.fillStyle = retroTextGradient;
                    ctx.fillText(text, centerX, centerY);
                    break;
                    
                case "glitch":
                    // Glitch effect
                    ctx.font = 'bold 80px "Courier New", monospace';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    
                    // Draw glitch layers
                    ctx.fillStyle = '#ff0000';
                    ctx.fillText(text, centerX - 4, centerY - 2);
                    
                    ctx.fillStyle = '#00ffff';
                    ctx.fillText(text, centerX + 4, centerY);
                    
                    ctx.fillStyle = '#ffffff';
                    ctx.fillText(text, centerX, centerY);
                    
                    // Add random glitch rectangles
                    for (let i = 0; i < 5; i++) {
                        const glitchX = centerX - ctx.measureText(text).width/2 + Math.random() * ctx.measureText(text).width;
                        const glitchY = centerY - 30 + Math.random() * 60;
                        const glitchW = Math.random() * 30 + 10;
                        const glitchH = Math.random() * 15 + 5;
                        
                        ctx.fillStyle = i % 2 === 0 ? '#ff0000' : '#00ffff';
                        ctx.fillRect(glitchX, glitchY, glitchW, glitchH);
                    }
                    break;
                    
                case "bubble":
                    // Bubble text effect
                    ctx.font = 'bold 90px "Comic Sans MS", cursive';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    
                    // Draw bubble shadow
                    ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
                    ctx.shadowBlur = 15;
                    ctx.shadowOffsetX = 5;
                    ctx.shadowOffsetY = 5;
                    
                    // Draw text with gradient
                    const bubbleTextGradient = ctx.createLinearGradient(
                        centerX, centerY - 40,
                        centerX, centerY + 40
                    );
                    bubbleTextGradient.addColorStop(0, '#ffffff');
                    bubbleTextGradient.addColorStop(1, '#e0e0e0');
                    
                    ctx.fillStyle = bubbleTextGradient;
                    ctx.fillText(text, centerX, centerY);
                    
                    // Draw outline
                    ctx.strokeStyle = '#4a90e2';
                    ctx.lineWidth = 2;
                    ctx.strokeText(text, centerX, centerY);
                    
                    // Reset shadow
                    ctx.shadowColor = 'transparent';
                    ctx.shadowBlur = 0;
                    ctx.shadowOffsetX = 0;
                    ctx.shadowOffsetY = 0;
                    break;
            }
        }
    }
};