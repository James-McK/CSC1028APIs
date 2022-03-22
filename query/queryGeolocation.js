import getRemoteJSON from "./queryRemoteJSON.js";

/**
 * Fetch geolocation information about the given IP
 * @param {URL} url The URL to fetch information about
 * @returns {JSON} The geolocation information on the given IP
 */
export default async function fetchGeolocation(ipAddr) {
	let ip = ipAddr;
	if (ip.ip) ip = ip.ip;
	// Construct the URL to query
	const fetchUrl = `http://ip-api.com/json/${ip}`;
	// Return the result
	return await Promise.resolve(getRemoteJSON(fetchUrl));
}
