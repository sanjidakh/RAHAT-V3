const logger = require('../../includes/logger');
const config = require('../../config/config.json');
const language = require(`../../languages/${config.language}.json`);

class MessageEvent {
  constructor(api, eventHandler) {
    this.api = api;
    this.eventHandler = eventHandler;
    this.retryCount = 0;
    this.maxRetries = config.retries.maxRetries;
    this.retryDelay = config.retries.retryDelay;
  }

  start(useMqtt = true) {
    logger.info(`${config.bot.botName}: ${language.startup}`);
    const listener = useMqtt ? this.api.listenMqtt : this.api.listen;
    logger.info(`Starting ${useMqtt ? 'MQTT' : 'non-MQTT'} listener...`);

    listener(async (err, event) => {
      if (err) {
        logger.error(`Listener error (${useMqtt ? 'MQTT' : 'non-MQTT'}): ${err.message}`);
        if (useMqtt && this.retryCount < this.maxRetries) {
          this.retryCount++;
          logger.warn(`Retrying MQTT (${this.retryCount}/${this.maxRetries})...`);
          setTimeout(() => this.start(true), this.retryDelay);
          return;
        }
        if (useMqtt) {
          logger.info('MQTT failed, falling back to non-MQTT listener...');
          this.start(false);
          return;
        }
        logger.error('Max retries reached. Stopping.');
        return;
      }

      logger.verbose(`Received event: ${JSON.stringify(event, null, 2)}`);

      await this.eventHandler.handleEvent(event);
    });
  }
}

module.exports = MessageEvent;