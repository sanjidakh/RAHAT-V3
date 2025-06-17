const config = require('../../config/config.json');
const { connect } = require('../../includes/database/index');
const logger = require('../../includes/logger');

module.exports = {
    name: "rules",
    version: "1.0.0",
    author: "Hridoy",
    description: "Manages thread-specific rules.",
    adminOnly: false,
    commandCategory: "utility",
    guide: "Use {pn}rules to view rules\n{pn}rules add <text> to add a rule (admin only)\n{pn}rules edit <number> <text> to edit a rule (admin only)\n{pn}rules move <num1> <num2> to swap rules (admin only)\n{pn}rules delete <number> to delete a rule (admin only)\n{pn}rules reset to reset all rules (admin only)\n{pn}rules <number> to view a specific rule",
    cooldowns: 5,
    usePrefix: true,

    async execute({ api, event, args }) {
        try {
            if (!event || !event.threadID || !event.messageID) {
                logger.error("Invalid event object in rules command", { event });
                return api.sendMessage(`${config.bot.botName}: ❌ Invalid event data.`, event.threadID);
            }

            const db = await connect();
            const threadsCollection = db.collection('threads');
            const threadID = event.threadID;
            const senderID = event.senderID;


            let threadData = await threadsCollection.findOne({ threadID });
            let rulesOfThread = threadData?.data?.rules || [];
            const totalRules = rulesOfThread.length;


            const adminIDs = config.bot.adminIDs || [];
            const threadInfo = await new Promise((resolve) => {
                api.getThreadInfo(threadID, (err, info) => resolve(err ? {} : info));
            });
            const groupAdmins = threadInfo.adminIDs ? threadInfo.adminIDs.map(admin => admin.id) : [];
            const isBotAdmin = adminIDs.includes(senderID);
            const isGroupAdmin = groupAdmins.includes(senderID);
            const isAdmin = isBotAdmin || isGroupAdmin;

            const type = args[0]?.toLowerCase();

        
            if (!type) {
                if (totalRules === 0) {
                    return api.sendMessage(
                        `${config.bot.botName}: No rules have been set for this thread.`,
                        threadID,
                        event.messageID
                    );
                }

                let i = 1;
                const msg = rulesOfThread.reduce((text, rule) => text += `${i++}. ${rule}\n`, "");
                api.sendMessage(
                    `${config.bot.botName}: Thread Rules:\n\n${msg}`,
                    threadID,
                    (err, info) => {
                        if (err) {
                            logger.error(`Error sending rules message: ${err.message}`);
                            return;
                        }
                        global.replyHandlers = global.replyHandlers || new Map();
                        global.replyHandlers.set(info.messageID, {
                            commandName: "rules",
                            author: senderID,
                            rulesOfThread,
                            messageID: info.messageID
                        });
                        logger.info(`Reply handler set for rules message: ${info.messageID}`);
                    },
                    event.messageID
                );
            }

            else if (["add", "-a"].includes(type)) {
                if (!isAdmin) {
                    return api.sendMessage(
                        `${config.bot.botName}: ❌ Only bot admins or group admins can add rules.`,
                        threadID,
                        event.messageID
                    );
                }

                if (!args[1]) {
                    return api.sendMessage(
                        `${config.bot.botName}: Please provide the rule content to add.`,
                        threadID,
                        event.messageID
                    );
                }

                const newRule = args.slice(1).join(" ");
                rulesOfThread.push(newRule);

                await threadsCollection.updateOne(
                    { threadID },
                    { $set: { "data.rules": rulesOfThread } },
                    { upsert: true }
                );

                api.sendMessage(
                    `${config.bot.botName}: ✅ Rule added successfully: "${newRule}"`,
                    threadID,
                    event.messageID
                );
            }

            else if (["edit", "-e"].includes(type)) {
                if (!isAdmin) {
                    return api.sendMessage(
                        `${config.bot.botName}: ❌ Only bot admins or group admins can edit rules.`,
                        threadID,
                        event.messageID
                    );
                }

                const stt = parseInt(args[1]);
                if (isNaN(stt) || stt < 1) {
                    return api.sendMessage(
                        `${config.bot.botName}: Please provide a valid rule number to edit.`,
                        threadID,
                        event.messageID
                    );
                }

                if (!rulesOfThread[stt - 1]) {
                    return api.sendMessage(
                        `${config.bot.botName}: Rule ${stt} does not exist. ${totalRules === 0 ? "No rules set." : `Total rules: ${totalRules}`}`,
                        threadID,
                        event.messageID
                    );
                }

                if (!args[2]) {
                    return api.sendMessage(
                        `${config.bot.botName}: Please provide the new content for rule ${stt}.`,
                        threadID,
                        event.messageID
                    );
                }

                const newContent = args.slice(2).join(" ");
                rulesOfThread[stt - 1] = newContent;

                await threadsCollection.updateOne(
                    { threadID },
                    { $set: { "data.rules": rulesOfThread } },
                    { upsert: true }
                );

                api.sendMessage(
                    `${config.bot.botName}: ✅ Rule ${stt} edited successfully: "${newContent}"`,
                    threadID,
                    event.messageID
                );
            }
   
            else if (["move", "-m"].includes(type)) {
                if (!isAdmin) {
                    return api.sendMessage(
                        `${config.bot.botName}: ❌ Only bot admins or group admins can move rules.`,
                        threadID,
                        event.messageID
                    );
                }

                const num1 = parseInt(args[1]);
                const num2 = parseInt(args[2]);
                if (isNaN(num1) || isNaN(num2) || num1 < 1 || num2 < 1) {
                    return api.sendMessage(
                        `${config.bot.botName}: Please provide two valid rule numbers to swap.`,
                        threadID,
                        event.messageID
                    );
                }

                if (!rulesOfThread[num1 - 1] || !rulesOfThread[num2 - 1]) {
                    let msg = "";
                    if (!rulesOfThread[num1 - 1] && !rulesOfThread[num2 - 1]) {
                        msg = `Rules ${num1} and ${num2} do not exist`;
                    } else if (!rulesOfThread[num1 - 1]) {
                        msg = `Rule ${num1} does not exist`;
                    } else {
                        msg = `Rule ${num2} does not exist`;
                    }
                    msg += `. ${totalRules === 0 ? "No rules set." : `Total rules: ${totalRules}`}`;
                    return api.sendMessage(
                        `${config.bot.botName}: ${msg}`,
                        threadID,
                        event.messageID
                    );
                }

                if (num1 === num2) {
                    return api.sendMessage(
                        `${config.bot.botName}: Cannot move a rule to the same position.`,
                        threadID,
                        event.messageID
                    );
                }

  
                [rulesOfThread[num1 - 1], rulesOfThread[num2 - 1]] = [rulesOfThread[num2 - 1], rulesOfThread[num1 - 1]];

                await threadsCollection.updateOne(
                    { threadID },
                    { $set: { "data.rules": rulesOfThread } },
                    { upsert: true }
                );

                api.sendMessage(
                    `${config.bot.botName}: ✅ Rules ${num1} and ${num2} have been swapped successfully.`,
                    threadID,
                    event.messageID
                );
            }

            else if (["delete", "del", "-d"].includes(type)) {
                if (!isAdmin) {
                    return api.sendMessage(
                        `${config.bot.botName}: ❌ Only bot admins or group admins can delete rules.`,
                        threadID,
                        event.messageID
                    );
                }

                const stt = parseInt(args[1]);
                if (isNaN(stt) || stt < 1) {
                    return api.sendMessage(
                        `${config.bot.botName}: Please provide a valid rule number to delete.`,
                        threadID,
                        event.messageID
                    );
                }

                const ruleToDelete = rulesOfThread[stt - 1];
                if (!ruleToDelete) {
                    return api.sendMessage(
                        `${config.bot.botName}: Rule ${stt} does not exist. ${totalRules === 0 ? "No rules set." : `Total rules: ${totalRules}`}`,
                        threadID,
                        event.messageID
                    );
                }

                rulesOfThread.splice(stt - 1, 1);

                await threadsCollection.updateOne(
                    { threadID },
                    { $set: { "data.rules": rulesOfThread } },
                    { upsert: true }
                );

                api.sendMessage(
                    `${config.bot.botName}: ✅ Rule ${stt} deleted successfully: "${ruleToDelete}"`,
                    threadID,
                    event.messageID
                );
            }

            else if (["remove", "reset", "-r", "-rm"].includes(type)) {
                if (!isAdmin) {
                    return api.sendMessage(
                        `${config.bot.botName}: ❌ Only bot admins or group admins can reset rules.`,
                        threadID,
                        event.messageID
                    );
                }

                api.sendMessage(
                    `${config.bot.botName}: Are you sure you want to reset all rules? React to this message to confirm.`,
                    threadID,
                    (err, info) => {
                        if (err) {
                            logger.error(`Error sending reset confirmation message: ${err.message}`);
                            return;
                        }
                        global.reactionHandlers = global.reactionHandlers || new Map();
                        global.reactionHandlers.set(info.messageID, {
                            commandName: "rules",
                            messageID: info.messageID,
                            author: senderID
                        });
                        logger.info(`Reaction handler set for reset confirmation: ${info.messageID}`);
                    },
                    event.messageID
                );
            }

            else if (!isNaN(type)) {
                let msg = "";
                for (const stt of args) {
                    const ruleNum = parseInt(stt);
                    const rule = rulesOfThread[ruleNum - 1];
                    if (rule) {
                        msg += `${ruleNum}. ${rule}\n`;
                    }
                }

                if (msg === "") {
                    return api.sendMessage(
                        `${config.bot.botName}: Rule ${type} does not exist. ${totalRules === 0 ? "No rules set." : `Total rules: ${totalRules}`}`,
                        threadID,
                        event.messageID
                    );
                }

                api.sendMessage(
                    `${config.bot.botName}: Requested Rule:\n\n${msg}`,
                    threadID,
                    event.messageID
                );
            }

            else {
                api.sendMessage(
                    `${config.bot.botName}: Invalid syntax. Usage: {pn}rules [add/edit/move/delete/reset] <args> or {pn}rules <number>`,
                    threadID,
                    event.messageID
                );
            }
        } catch (error) {
            logger.error(`Error in rules execute: ${error.message}`, { event, args });
            try {
                await api.sendMessage(
                    `${config.bot.botName}: ❌ An error occurred while processing the rules command.`,
                    event.threadID,
                    event.messageID
                );
            } catch (sendErr) {
                logger.error(`Failed to send error message in execute: ${sendErr.message}`);
            }
        }
    },

    async onReply({ api, event }) {
        try {
            if (!event || !event.threadID || !event.messageReply || !event.messageReply.messageID) {
                logger.error("Invalid event object in rules onReply", { event });
                return;
            }

            if (!global.replyHandlers || !global.replyHandlers.has(event.messageReply.messageID)) {
                logger.warn(`No reply handler found for message ID: ${event.messageReply.messageID}`);
                return;
            }

            const replyData = global.replyHandlers.get(event.messageReply.messageID);
            const { commandName, author, rulesOfThread } = replyData;

            if (commandName !== "rules") return;
            if (author !== event.senderID) {
                return api.sendMessage(
                    `${config.bot.botName}: Only the user who requested the rules can reply.`,
                    event.threadID,
                    event.messageID
                );
            }

            const num = parseInt(event.body || "");
            if (isNaN(num) || num < 1) {
                return api.sendMessage(
                    `${config.bot.botName}: Please reply with a valid rule number.`,
                    event.threadID,
                    event.messageID
                );
            }

            const totalRules = rulesOfThread.length;
            if (num > totalRules) {
                return api.sendMessage(
                    `${config.bot.botName}: Rule ${num} does not exist. ${totalRules === 0 ? "No rules set." : `Total rules: ${totalRules}`}`,
                    event.threadID,
                    event.messageID
                );
            }

            api.sendMessage(
                `${config.bot.botName}: Rule ${num}: ${rulesOfThread[num - 1]}`,
                event.threadID,
                (err) => {
                    if (err) {
                        logger.error(`Error sending reply message: ${err.message}`);
                        return;
                    }
                    api.unsendMessage(replyData.messageID, (err) => {
                        if (err) {
                            logger.error(`Error unsending original message: ${err.message}`);
                        }
                    });
                },
                event.messageID
            );
        } catch (error) {
            logger.error(`Error in rules onReply: ${error.message}`, { event });
            try {
                await api.sendMessage(
                    `${config.bot.botName}: ❌ An error occurred while processing your reply.`,
                    event.threadID,
                    event.messageID
                );
            } catch (sendErr) {
                logger.error(`Failed to send error message in onReply: ${sendErr.message}`);
            }
        }
    },

    async onReaction({ api, event }) {
        try {
            if (!event || !event.threadID || !event.messageID) {
                logger.error("Invalid event object in rules onReaction", { event });
                return;
            }

            if (!global.reactionHandlers || !global.reactionHandlers.has(event.messageID)) {
                logger.warn(`No reaction handler found for message ID: ${event.messageID}`);
                return;
            }

            const reactionData = global.reactionHandlers.get(event.messageID);
            const { commandName, author } = reactionData;

            if (commandName !== "rules") return;
            if (author !== event.userID) {
                return api.sendMessage(
                    `${config.bot.botName}: Only the user who requested the reset can react.`,
                    event.threadID
                );
            }

            const db = await connect();
            const threadsCollection = db.collection('threads');
            const threadID = event.threadID;

            await threadsCollection.updateOne(
                { threadID },
                { $set: { "data.rules": [] } },
                { upsert: true }
            );

            api.sendMessage(
                `${config.bot.botName}: ✅ All rules have been reset successfully.`,
                threadID
            );

            global.reactionHandlers.delete(event.messageID);
            logger.info(`Reaction handler removed for message ID: ${event.messageID}`);
        } catch (error) {
            logger.error(`Error in rules onReaction: ${error.message}`, { event });
            try {
                await api.sendMessage(
                    `${config.bot.botName}: ❌ An error occurred while processing your reaction.`,
                    event.threadID
                );
            } catch (sendErr) {
                logger.error(`Failed to send error message in onReaction: ${sendErr.message}`);
            }
        }
    }
};