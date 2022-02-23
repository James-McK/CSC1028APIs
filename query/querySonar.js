import parseHostname from "../parse/parseHostname.js";
import getRemoteJSON from "./queryRemoteJSON.js";
import { parse as tldParse } from "tldts-experimental";

/**
 * Fetch subdomains of the given URL
 * @param {URL} url The URL to fetch information about
 * @returns {JSON} The subdomains of the given URL host
 */
async function fetchSubdomainsOnline(url) {
	let parsed = parseHostname(url);
	const fetchUrl = "https://sonar.omnisint.io/subdomains/";
	return await Promise.resolve(getRemoteJSON(fetchUrl + parsed.hostname));
}

/**
 * Fetch the reverse DNS of the given IP
 * @param {URL} url The URL to fetch information about
 * @returns {JSON} The result of the query
 */
async function fetchReverseDnsOnline(ipAddress) {
	const fetchUrl = "https://sonar.omnisint.io/reverse/";
	return await Promise.resolve(getRemoteJSON(fetchUrl + ipAddress));
}

async function fetchSubdomains(urlStr, client) {
	let url = tldParse(urlStr.hostname);
	console.log(url);
	let query = {
		$text: { $search: url.domainWithoutSuffix },
		domainWithoutSuffix: url.domainWithoutSuffix,
		publicSuffix: url.publicSuffix,
	};
	let res = await findMany(client, query, "sonardata");
	if (res) return res;
	else return { error: "No result found!" };
}

async function fetchReverseDns() {}

async function findMany(client, query, collection, db_name = "test_db", maxResults = 1000) {
	const cursor = client.db(db_name).collection(collection).find(query).limit(maxResults);

	const results = await cursor.toArray();

	if (results.length > 0) {
		// console.log("Found items:");
		// results.forEach((result, i) => {
		// 	console.log(result);
		// });
		return results;
	} else {
		console.log("No results found with the given query!");
		return null;
	}
}

export { fetchSubdomains, fetchReverseDns };
