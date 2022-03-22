import fetch from "node-fetch";

/**
 * Fetch JSON from the given URL
 * @param {string} url The URL from which the JSON should be fetched
 * @returns {JSON} The parsed JSON to be used elsewhere
 */
export default async function getRemoteJSON(url, settings = { method: "GET" }) {
	// Fetch the given URL
	let res = await fetch(url, settings);
	// Get the JSON
	let json = await res.json();
	// Return the result
	return json;
}
