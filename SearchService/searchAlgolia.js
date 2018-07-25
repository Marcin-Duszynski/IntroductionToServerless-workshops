const algoliasearch = require('algoliasearch');

const index = algoliasearch(process.env.ALGOLIA_APP_ID, process.env.ALGOLIA_API_KEY)
                .initIndex(process.env.ALGOLIA_INDEX_NAME);

exports.handler = async (event, context, callback) => {
  try {
    const searchResult = await index.search({
                                      query: event.query,
                                    });
    callback(null, searchResult);
  } catch (error) {
    callback(error);
  }
}