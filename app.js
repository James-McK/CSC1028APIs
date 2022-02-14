import { MongoClient } from "mongodb";
import createHttpServer from "./createHttpServer.js";
import queryPhishingDB from "./queryMPhishDB.js";
import getEarliestArchiveDate from "./queryArchiveDate.js";
import dnsLookup from "./queryDNS.js";
import fetchGeolocation from "./queryGeolocation.js";
import fetchSimilarwebRank from "./querySimilarweb.js";
import { fetchSubdomains, fetchReverseDns } from "./querySonar.js";

// TODO: Better way to do this
const uri = "mongodb://localhost:27017";
const client = new MongoClient(uri);

/**
 * Main function
 */
async function main() {
	try {
		// Connect to the MongoDB cluster
		await client.connect();

		// Start the HTTP server
		await createHttpServer(8080, mainQueryCallback);
	} catch (e) {
		// Log any errors
		console.error(e);
	} finally {
		// Database connection should stay open while the app is running, so I think the connection shouldn't be closed?
		//await client.close();
	}
}

async function mainQueryCallback(searchParams) {
	const errorRes = { error: "No valid query!" };
	const ipRegex =
		/^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/;

	// Parse it from a string to a URL object
	let url = tryParseUrl(searchParams.url);
	if (!url) {
		console.log(`Cannot parse ${searchParams.url}!`);
		return errorRes;
	} else {
		console.log(`Queried: ${url}`);

		let ip;
		let reverseDns;

		// If hostname is already an IP address (TODO: Only supports IPv4)
		if (ipRegex.test(url.hostname)) {
			// Fetch the results of the reverse DNS
			ip = { address: url.hostname, family: 4 };
			reverseDns = await Promise.resolve(fetchReverseDns(ip.address));
		} else {
			// Find an IP address the hostname points to
			ip = await Promise.resolve(dnsLookup(url.hostname));
			// I don't know if it makes sense to call reverse dns here but I'm doing it anyway
			reverseDns = await Promise.resolve(fetchReverseDns(ip.address));
		}

		// Prepare a response to the client
		let response = {
			host: url.host,
			pathname: url.pathname,
			ip: ip,
			reverseDns: reverseDns,
			phishingData: await Promise.resolve(queryPhishingDB(client, url)),
			subdomains: await Promise.resolve(fetchSubdomains(url)),
			geolocation: await Promise.resolve(fetchGeolocation(ip.address)),
			similarwebRank: await Promise.resolve(fetchSimilarwebRank(url)),
			archiveDate: await Promise.resolve(getEarliestArchiveDate(url)),
		};

		// Write the respone to the client
		return response;
	}
}

/**
 * Try to parse the URL when it is unknown if the string contains the URL's protocol
 * @param {string} urlStr The string to be parsed
 * @returns {URL} The parsed result
 */
function tryParseUrl(urlStr) {
	try {
		return new URL(urlStr);
	} catch {
		try {
			// Assume http if no protocol given
			return new URL("https://" + urlStr);
		} catch {
			return null;
		}
	}
}

// Run the main function
main().catch(console.error);
