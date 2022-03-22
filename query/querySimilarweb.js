import "dotenv/config";
import getRemoteJSON from "./queryRemoteJSON.js";
import parseHostname from "../parse/parseHostname.js";
import createCli from "../create/createCli.js";

/**
 * Fetch if similarweb can still be queried
 * @returns {boolean} The result of the query
 */
async function canQuerySimilarweb(logQueriesRemaining) {
	// Can't query without an API key
	if (!process.env.SIMILARWEB_KEY) return false;
	// The URL to query to find the number of queries remaining
	const fetchUrl = `https://api.similarweb.com/user-capabilities?api_key=${process.env.SIMILARWEB_KEY}`;
	let res = await Promise.resolve(getRemoteJSON(fetchUrl));
	// Log the number of remaining queries
	if (logQueriesRemaining) console.log("Similarweb queries remaining: " + res.user_remaining);

	// Keep at least 10 queries remaining as a buffer
	return res.user_remaining > 10;
}

/**
 * The SimilarWeb rank of the given URL
 * @param {*} url The URL to fetch information about
 * @returns {number} The website's rank, if found, or -1 if it cannot be found.
 */
export default async function fetchSimilarwebRank(url, logQueriesRemaining = true) {
	// If we still have API queries remaining
	if (await Promise.resolve(canQuerySimilarweb(logQueriesRemaining))) {
		// Parse the URL
		let parsed = parseHostname(url);
		// Construct the URL to query
		const fetchUrl = `https://api.similarweb.com/v1/similar-rank/${parsed.hostname}/rank?api_key=${process.env.SIMILARWEB_KEY}`;

		// Get the result of the query
		let res = await Promise.resolve(getRemoteJSON(fetchUrl));

		// If an error occurred, return -1, otherwise return the rank
		if (res.meta.status === "Error") return -1;
		else return res.similar_rank.rank;
	} else return null;
}

/**
 * Callback function if using the CLI
 * @param {Array} args The arguments passed to the app
 */
async function cliCallback(args) {
	args.forEach(async (value) => {
		// Parse the given URL
		let url = parseHostname(value);
		// Make the query
		let res = await fetchSimilarwebRank(url, false);
		// Print the result
		console.log(`${value}: ${res}`);
	});
}

createCli(import.meta, process.argv, cliCallback);
