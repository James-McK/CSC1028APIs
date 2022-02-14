import getRemoteJSON from "./queryRemoteJSON.js";

/**
 * @param {URL} url The URL to fetch information about
 * @returns {JSON} The subdomains of the given URL host
 */
export default async function getEarliestArchiveDate(url) {
	const fetchUrl = "https://archive.org/wayback/available?timestamp=0&url=";
	let res = await Promise.resolve(getRemoteJSON(fetchUrl + url.hostname));
	if (res.archived_snapshots && res.archived_snapshots.closest.timestamp) {
		let timestamp = res.archived_snapshots.closest.timestamp;
		return new Date(timestamp.substring(0, 4), timestamp.substring(4, 6) - 1, timestamp.substring(6, 8));
	} else return null;
}
