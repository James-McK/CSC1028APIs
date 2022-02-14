import "dotenv/config";
import getRemoteJSON from "./queryRemoteJSON.js";

/**
 * Fetch if similarweb can still be queried
 * @returns {boolean} The result of the query
 */
async function canQuerySimilarweb() {
	const fetchUrl = "https://api.similarweb.com/user-capabilities?api_key=";
	let res = await Promise.resolve(getRemoteJSON(fetchUrl + process.env.SIMILARWEB_KEY));
	console.log("Similarweb queries remaining: " + res.user_remaining);
	return res.user_remaining > 10;
}

/**
 * The SimilarWeb rank of the given URL
 * @param {URL} url The URL to fetch information about
 * @returns {int} The website's rank, if found, or null if it cannot be found.
 */
export default async function fetchSimilarwebRank(url) {
	if (await Promise.resolve(canQuerySimilarweb())) {
		const fetchUrl = "https://api.similarweb.com/v1/similar-rank/" + url.hostname + "/rank?api_key=";
		let res = await Promise.resolve(getRemoteJSON(fetchUrl + process.env.SIMILARWEB_KEY));

		if (res.meta.status === "Error") return null;
		else return res.similar_rank.rank;
	} else return null;
}
