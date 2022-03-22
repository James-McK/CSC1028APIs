import getRemoteJSON from "./queryRemoteJSON.js";
import parseHostname from "../parse/parseHostname.js";
import createCli from "../create/createCli.js";

/**
 * @param {URL} url The URL to fetch information about
 * @returns {JSON} The subdomains of the given URL host
 */
export default async function getEarliestArchiveDate(url) {
	// Parse the URL
	let parsed = parseHostname(url);

	// Construct the URL to query
	const fetchUrl = `https://archive.org/wayback/available?timestamp=0&url=${parsed.hostname}`;
	// Get the result of the query
	let res = await Promise.resolve(getRemoteJSON(fetchUrl));
	// If a result was given,
	if (res.archived_snapshots && res.archived_snapshots.closest.timestamp) {
		// Parse it from the date format given into a Date object and return it
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
		// Parse the URL
		let url = parseHostname(value);
		// Get the result of the query
		let res = await getEarliestArchiveDate(url);
		// Print it
		console.log(`${value}: ${res}`);
	});
}

createCli(import.meta, process.argv, cliCallback);
