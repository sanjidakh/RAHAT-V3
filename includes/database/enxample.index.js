const { MongoClient } = require('mongodb');
const logger = require('../logger');

const uri = "mongodb+srv://<username>:<password>@cluster0.mongodb.net/nexasim?retryWrites=true&w=majority"; // Replace with your MongoDB URL
const client = new MongoClient(uri);

async function connect() {
    try {
        await client.connect();
        logger.info('Connected to MongoDB');
        return client.db('nexasim');
    } catch (err) {
        logger.error(`Failed to connect to MongoDB: ${err.message}`);
        process.exit(1);
    }
}

module.exports = { connect };