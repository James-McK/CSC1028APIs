import tryParseUrl from "../parse/tryParseUrl.js";

/**
 * Check if the given URL has a match in the given database's collection
 * @param {MongoClient} client MongoClient with an open connection
 * @param {URL} url The URL to search for
 * @param {string} collection The name of the collection to search through
 * @param {string} dbName The name of the database the collection is contained in
 * @returns {JSON} The result, if found
 */
async function queryCollection(client, url, collection, dbName = "test_db") {
	// Check if there is a matching hostname
	let result = await client.db(dbName).collection(collection).findOne({ hostname: url.hostname });

	// If a result is found:
	if (result) {
		// If the path does not need checked:
		if (!result.includesPath) {
			// Match found!
			return result;
		} else {
			// If the path does need checked:
			// Check again if there is a matching hostname and pathname
			result = await client
				.db(dbName)
				.collection(collection)
				.findOne({ hostname: url.hostname, pathname: url.pathname });

			//If a result is found:
			if (result) {
				// Match found!
				return result;
			} else {
				// If no result found:
				// Might be safe, might be missing from database, might be false negative
				return null;
			}
		}
	} else {
		// If no result found:
		return null;
	}
}

/**
 * Check if the given URL has a match in the phishtank database
 * @param {MongoClient} client MongoClient with an open connection
 * @param {URL} url The URL to search for
 * @returns {JSON} The result, if found
 */
async function queryPhishtank(client, url) {
	return await Promise.resolve(queryCollection(client, url, "phishtank"));
}

/**
 * Check if the given URL has a match in the OpenPhish database
 * @param {MongoClient} client MongoClient with an open connection
 * @param {URL} url The URL to search for
 * @returns {JSON} The result, if found
 */
async function queryOpenPhish(client, url) {
	return await Promise.resolve(queryCollection(client, url, "openphish"));
}

/**
 * Check if the given URL has a match in the URLHaus database
 * @param {MongoClient} client MongoClient with an open connection
 * @param {URL} url The URL to search for
 * @returns {JSON} The result, if found
 */
async function queryUrlhaus(client, url) {
	return await Promise.resolve(queryCollection(client, url, "urlhaus"));
}

/**
 * Check if the given URL has a match in the Malware Discoverer database
 * @param {MongoClient} client MongoClient with an open connection
 * @param {URL} url The URL to search for
 * @returns {JSON} The result, if found
 */
async function queryMalwareDiscoverer(client, url) {
	return await Promise.resolve(queryCollection(client, url, "malwarediscoverer"));
}

/**
 * Check if the given URL is contained in a phishing/malware database
 * @param {MongoClient} client MongoClient with an open connection
 * @param {URL} url The URL to search for
 * @returns The result of the given queries
 */
export default async function queryPhishingDB(url) {
	let parsed = tryParseUrl(url);
	let results = [
		await Promise.resolve(queryPhishtank(client, parsed)),
		await Promise.resolve(queryOpenPhish(client, parsed)),
		await Promise.resolve(queryUrlhaus(client, parsed)),
		await Promise.resolve(queryMalwareDiscoverer(client, parsed)),
	];

	// Only return results that exist
	let toReturn = [];
	for (let i = 0; i < results.length; i++) {
		if (results[i]) toReturn.push(results[i]);
	}

	return toReturn;
}
