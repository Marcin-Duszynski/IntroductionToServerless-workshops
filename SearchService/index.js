const algoliasearch = require('algoliasearch');

const client = algoliasearch(process.env.ALGOLIA_APP_ID, process.env.ALGOLIA_API_KEY);

exports.handler = async (event, context, callback) => {
    console.log('Received event:', JSON.stringify(event, null, 2));
    const itemsToIndex = [];
    
    event.Records.forEach((record) => {
        console.log({
            msg: 'Processing item',
            item: record.dynamodb.Keys,
            eventName: record.eventName
        });

        let item;

        if (record.eventName == 'REMOVE') {
            item = {
                action: 'deleteObject',
                indexName: process.env.ALGOLIA_INDEX_NAME,
                body: {
                    objectID: record.dynamodb.Keys.objectID.S,
                }
            }
        } else {
            const recordImage = record.dynamodb.NewImage;

            item = {
                action: 'addObject',
                indexName: process.env.ALGOLIA_INDEX_NAME,
                body: {
                    name: recordImage.name.S,
                    description: recordImage.description.S,
                    categories: JSON.parse(recordImage.categories.S),
                    brand: recordImage.brand.S,
                    image: recordImage.image.S,
                    objectID: recordImage.objectID.S,
                }
            }
        }

        itemsToIndex.push(item);
    });

    try {
        const indexingResult = await client.batch(itemsToIndex);

        callback(null, {
            message: 'Indexed successfully',
            result: indexingResult,
        });
    } catch (error) {
        callback(error);
    }
};
