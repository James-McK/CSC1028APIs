import parseHostname from "../parse/parseHostname.js";
import getRemoteJSON from "./queryRemoteJSON.js";
import { parse as tldParse } from "tldts-experimental";

/**
 * Fetch subdomains of the given URL (Not currently used)
 * @param {URL} url The URL to fetch information about
 * @returns {JSON} The subdomains of the given URL host
 */
async function fetchSubdomainsOnline(url) {
	let parsed = parseHostname(url);
	const fetchUrl = "https://sonar.omnisint.io/subdomains/";
	return await Promise.resolve(getRemoteJSON(fetchUrl + parsed.hostname));
}

/**
 * Fetch the reverse DNS of the given IP (Not currently used)
 * @param {URL} url The URL to fetch information about
 * @returns {JSON} The result of the query
 */
async function fetchReverseDnsOnline(ipAddress) {
	const fetchUrl = "https://sonar.omnisint.io/reverse/";
	return await Promise.resolve(getRemoteJSON(fetchUrl + ipAddress));
}

/**
 * Fetch subdomains of the given domain
 */
async function fetchSubdomains(urlStr, client) {
	let url = tldParse(urlStr.hostname);
	console.log(url);

	// Construct the query making use of text indexes
	let query = {
		$text: { $search: url.domainWithoutSuffix },
		domainWithoutSuffix: url.domainWithoutSuffix,
		publicSuffix: url.publicSuffix,
	};
	// Get and return the result
	let res = await findMany(client, query, "sonardata");
	if (res) return res;
	else return { error: "No result found!" };
}

async function fetchReverseDns() {}

/**
 * Get multiple results from the given query
 * @param {MongoClient} client The client used to connect to the MongoDB database
 * @param {JSON} query The query to be made
 * @param {string} collection The name of the collecton
 * @param {string} db_name The name of the database
 * @param {number} maxResults The maximum number of results to return
 * @returns The result of the query
 */
async function findMany(client, query, collection, db_name = "test_db", maxResults = 1000) {
	const cursor = client.db(db_name).collection(collection).find(query).limit(maxResults);

	const results = await cursor.toArray();

	if (results.length > 0) {
		return results;
	} else {
		console.log("No results found with the given query!");
		return null;
	}
}

export { fetchSubdomains, fetchReverseDns };
