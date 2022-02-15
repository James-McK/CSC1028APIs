import getRemoteJSON from "./queryRemoteJSON.js";
import tryParseUrl from "../parse/tryParseUrl.js";
import createCli from "../create/createCli.js";

/**
 * @param {URL} url The URL to fetch information about
 * @returns {JSON} The subdomains of the given URL host
 */
export default async function getEarliestArchiveDate(url) {
	let parsed = tryParseUrl(url);

	const fetchUrl = "https://archive.org/wayback/available?timestamp=0&url=";
	let res = await Promise.resolve(getRemoteJSON(fetchUrl + parsed.hostname));
	if (res.archived_snapshots && res.archived_snapshots.closest.timestamp) {
		let timestamp = res.archived_snapshots.closest.timestamp;
		return new Date(timestamp.substring(0, 4), timestamp.substring(4, 6) - 1, timestamp.substring(6, 8));
	} else return null;
}

/**
 * Callback function if using the CLI
 * @param {Array} args The arguments passed to the app
 */
async function cliCallback(args) {
	args.forEach(async (value) => {
		let url = tryParseUrl(value);
		let res = await getEarliestArchiveDate(url);
		console.log(`${value}: ${res}`);
	});
}

createCli(import.meta, process.argv, cliCallback);
