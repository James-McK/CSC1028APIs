import { createServer } from "http";
import { MongoClient } from "mongodb";
import fetch from "node-fetch";
import fs from "fs";
import zlib from "zlib";
import readline from "readline";

/**
 * Main function
 */
async function main() {
	// Database is currently hosted on same machine
	const uri = "mongodb://localhost:27017";
	const client = new MongoClient(uri);

	try {
		// Connect to the MongoDB cluster
		await client.connect();

		// Start the HTTP server
		await createHttpServer(client);
	} catch (e) {
		// Log any errors
		console.error(e);
	} finally {
		// Database connection should stay open while the app is running, so I think the connection shouldn't be closed?
		//await client.close();
	}
}

/**
 * Create a HTTP server to respond to any requests
 * @param {MongoClient} client MongoClient with an open connection
 */
async function createHttpServer(client) {
	// Create a server object
	createServer(async function (req, res) {
		const ipRegex =
			/^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/;
		if (req.method === "GET") {
			res.writeHead(200, {
				// Send a HTTP 200 OK header,
				"Content-Type": "application/json", // and tell the client the Content-Type is application/json
				"X-Clacks-Overhead": "GNU Terry Pratchett", // GNU Terry Pratchett
			});

			// Try to parse the request to get the queried URL
			let reqFullUrl;
			let queriedUrl;
			try {
				reqFullUrl = new URL(req.url, `http://${req.headers.host}`);
				queriedUrl = reqFullUrl.searchParams.get("url");
			} catch {}

			// If any sort of queried url was given:
			if (queriedUrl) {
				let isFullDetails = false;
				try {
					isFullDetails = reqFullUrl.searchParams.get("fullDetails");
				} catch {}

				// Parse it from a string to a URL object
				let p = tryParseUrl(queriedUrl);

				let reverseDns = null;
				if (ipRegex.test(p.hostname)) {
					reverseDns = await Promise.resolve(fetchReverseDns(p));
				}

				if (isFullDetails) {
					// queryProjectSonar(client, p);

					//let arr = [];
					const sonarDataLocation = "C:\\Users\\James\\Downloads\\fdns_a.json.gz";
					let lineReader = readline.createInterface({
						input: fs.createReadStream(sonarDataLocation).pipe(zlib.createGunzip()),
					});

					let n = 0;
					lineReader.on("line", (sonarLine) => {
						n += 1;
						let sonarLineJson = JSON.parse(sonarLine);
						//arr.push(sonarLineJson);
						if (n % 1000000 === 0) {
							console.log(n);
							//console.log(arr);
							//createManyListings(client, arr, "projectsonar");
							//arr = [];
						}
						if (sonarLineJson.name === p.hostname || sonarLineJson.name.endsWith("." + p.hostname)) {
							console.log(sonarLineJson);
						}
					});
				}

				let geolocation = null;
				if (ipRegex.test(p.hostname)) {
					geolocation = await Promise.resolve(fetchGeolocation(p));
				}

				// Query phishtank
				let phishtankResult = await Promise.resolve(queryPhishtank(client, p));
				let openphishResult = await Promise.resolve(queryOpenPhish(client, p));
				let urlhausResult = await Promise.resolve(queryUrlhaus(client, p));
				let malwareDiscovererResult = await Promise.resolve(queryMalwareDiscoverer(client, p));

				// Prepare a response to the client
				let response = {
					protocol: p.protocol,
					host: p.host,
					pathname: p.pathname,
					phishtank: phishtankResult,
					openphish: openphishResult,
					urlhaus: urlhausResult,
					malwareDiscoverer: malwareDiscovererResult,
					subdomains: await Promise.resolve(fetchSubdomains(p)),
					reverseDns: reverseDns,
					geolocation: geolocation,
				};

				// Write the respone to the client
				res.write(JSON.stringify(response));
			} else {
				res.write('{ "error": "No valid query" }');
			}
			res.end(); // End the response
		} else if (req.method === "POST") {
			// I don't know what POST requests are yet, but given that browsers seem to use GET requests I'm ignoring POST for now.
		}
	}).listen(8080); // The server listens on port 8080
}

/**
 * Check if the given hostname has a match in the Project Sonar data
 * @param {MongoClient} client MongoClient with an open connection
 * @param {URL} url The URL to search for
 */
async function queryProjectSonar(client, url) {
	console.log("here");
	let result = await client.db("test_db").collection("projectsonar").findOne({ name: url.hostname });
	console.log(result);
	console.log("here 2");
}

/**
 * Add the given JSON to the database
 * @param {MongoClient} client MongoClient with an open connection
 * @param {JSON[]} newListing The new data to be added
 * @param {string} collection Name of the collection to add the data to
 * @param {string} dbName Name of the database the collection is in
 */
async function createManyListings(client, newListing, collection, dbName = "test_db") {
	client.db(dbName).collection(collection).insertMany(newListing);
}

/**
 * Fetch geolocation information about the given IP
 * @param {URL} url The URL to fetch information about
 * @returns {JSON} The geolocation information on the given IP
 */
async function fetchGeolocation(url) {
	const fetchUrl = "http://ip-api.com/json/";
	return await Promise.resolve(getRemoteJSON(fetchUrl + url.hostname));
}

/**
 * Fetch subdomains of the given URL
 * @param {URL} url The URL to fetch information about
 * @returns {JSON} The subdomains of the given URL host
 */
async function fetchSubdomains(url) {
	const fetchUrl = "https://sonar.omnisint.io/subdomains/";
	return await Promise.resolve(getRemoteJSON(fetchUrl + url.hostname));
}

/**
 * Fetch the reverse DNS of the given IP
 * @param {URL} url The URL to fetch information about
 * @returns {JSON} The result of the query
 */
async function fetchReverseDns(url) {
	const fetchUrl = "https://sonar.omnisint.io/reverse/";
	return await Promise.resolve(getRemoteJSON(fetchUrl + url.hostname));
}

/**
 * Fetch JSON from the given URL
 * @param {string} url The URL from which the JSON should be fetched
 * @returns {JSON} The parsed JSON to be used elsewhere
 */
async function getRemoteJSON(url) {
	let settings = { method: "Get" };
	let res = await fetch(url, settings);
	let json = await res.json();
	return json;
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
		// Assume http if no protocol given
		return new URL("http://" + urlStr);
	}
}

/**
 * Check if the given URL has a match in the phishtank database
 * @param {MongoClient} client MongoClient with an open connection
 * @param {URL} url The URL to search for
 * @returns {JSON} The result, if found
 */
async function queryPhishtank(client, url) {
	return await Promise.resolve(queryCollection(client, url, "phishtank"));
}

/**
 * Check if the given URL has a match in the OpenPhish database
 * @param {MongoClient} client MongoClient with an open connection
 * @param {URL} url The URL to search for
 * @returns {JSON} The result, if found
 */
async function queryOpenPhish(client, url) {
	return await Promise.resolve(queryCollection(client, url, "openphish"));
}

/**
 * Check if the given URL has a match in the URLHaus database
 * @param {MongoClient} client MongoClient with an open connection
 * @param {URL} url The URL to search for
 * @returns {JSON} The result, if found
 */
async function queryUrlhaus(client, url) {
	return await Promise.resolve(queryCollection(client, url, "urlhaus"));
}

/**
 * Check if the given URL has a match in the Malware Discoverer database
 * @param {MongoClient} client MongoClient with an open connection
 * @param {URL} url The URL to search for
 * @returns {JSON} The result, if found
 */
async function queryMalwareDiscoverer(client, url) {
	return await Promise.resolve(queryCollection(client, url, "malwarediscoverer"));
}

/**
 * Check if the given URL has a match in the phishtank database
 * @param {MongoClient} client MongoClient with an open connection
 * @param {URL} url The URL to search for
 * @param {string} collection The name of the collection to search through
 * @param {string} dbName The name of the database the collection is contained in
 * @returns {JSON} The result, if found
 */
async function queryCollection(client, url, collection, dbName = "test_db") {
	// Check if there is a matching hostname
	let result = await client.db(dbName).collection(collection).findOne({ hostname: url.hostname });

	// If a result is found:
	if (result) {
		// If the path does not need checked:
		if (!result.includesPath) {
			// Match found!
			return result;
		} else {
			// If the path does need checked:
			// Check again if there is a matching hostname and pathname
			result = await client
				.db(dbName)
				.collection(collection)
				.findOne({ hostname: url.hostname, pathname: url.pathname });

			//If a result is found:
			if (result) {
				// Match found!
				return result;
			} else {
				// If no result found:
				// Might be safe, might be missing from database, might be false negative
				return null;
			}
		}
	} else {
		// If no result found:
		return null;
	}
}

// Run the main function
main().catch(console.error);
