import { createServer } from "http";
import { MongoClient } from "mongodb";
import fetch from "node-fetch";
import fs from "fs";
import zlib from "zlib";
import readline from "readline";
import "dotenv/config";
import { lookup } from "dns";

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
	const ipRegex =
		/^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/;

	// Create a server object
	createServer(async function (req, res) {
		if (req.method === "GET") {
			res.writeHead(200, {
				// Send a HTTP 200 OK header,
				"Content-Type": "application/json", // and tell the client the Content-Type is application/json
				"X-Clacks-Overhead": "GNU Terry Pratchett", // GNU Terry Pratchett
			});

			const reqDetails = parseUserQuery(req);

			// If any sort of queried url was given:
			if (reqDetails) {
				// Parse it from a string to a URL object
				let p = tryParseUrl(reqDetails.queriedUrl);

				let ip;
				let reverseDns;
				if (ipRegex.test(p.hostname)) {
					ip = p.hostname;
					reverseDns = await Promise.resolve(fetchReverseDns(p));
				} else {
					ip = await Promise.resolve(dnsLookup(p.hostname));
					reverseDns = null;
				}

				if (reqDetails.isFullDetails) {
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

				let geolocation = await Promise.resolve(fetchGeolocation(ip.address));

				const similarwebRank = await Promise.resolve(fetchSimilarwebRank(p));

				let phishingResults = await Promise.resolve(queryPhishingDB(client, p));

				// Query phishtank

				// Prepare a response to the client
				let response = {
					host: p.host,
					pathname: p.pathname,
					ip: ip,
					phishingData: phishingResults,
					subdomains: await Promise.resolve(fetchSubdomains(p)),
					reverseDns: reverseDns,
					geolocation: geolocation,
					similarwebRank: similarwebRank,
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

function parseUserQuery(req) {
	// Try to parse the request to get the queried URL
	let reqFullUrl;
	let queriedUrl;
	try {
		reqFullUrl = new URL(req.url, `http://${req.headers.host}`);
		queriedUrl = reqFullUrl.searchParams.get("url");

		let isFullDetails = false;
		try {
			isFullDetails = reqFullUrl.searchParams.get("fullDetails");
		} catch {}

		return {
			queriedUrl: queriedUrl,
			isFullDetails: isFullDetails,
		};
	} catch {
		return null;
	}
}

function dnsLookup(hostname) {
	return new Promise(function (resolve, reject) {
		lookup(hostname, (err, address, family) => {
			if (err) {
				console.err(err);
				resolve(null);
			} else
				resolve({
					address: address,
					family: family,
				});
		});
	});
}

async function queryPhishingDB(client, p) {
	let results = [
		await Promise.resolve(queryPhishtank(client, p)),
		await Promise.resolve(queryOpenPhish(client, p)),
		await Promise.resolve(queryUrlhaus(client, p)),
		await Promise.resolve(queryMalwareDiscoverer(client, p)),
	];

	let toReturn = [];

	for (let i = 0; i < results.length; i++) {
		if (results[i]) toReturn.push(results[i]);
	}

	return toReturn;
}

/**
 * Check if the given hostname has a match in the Project Sonar data
 * @param {MongoClient} client MongoClient with an open connection
 * @param {URL} url The URL to search for
 */
async function queryProjectSonar(client, url) {
	let result = await client.db("test_db").collection("projectsonar").findOne({ name: url.hostname });
	console.log(result);
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
async function fetchSimilarwebRank(url) {
	if (await Promise.resolve(canQuerySimilarweb())) {
		const fetchUrl = "https://api.similarweb.com/v1/similar-rank/" + url.hostname + "/rank?api_key=";
		let res = await Promise.resolve(getRemoteJSON(fetchUrl + process.env.SIMILARWEB_KEY));

		if (res.meta.status === "Error") return null;
		else return res.similar_rank.rank;
	} else return null;
}

/**
 * Fetch geolocation information about the given IP
 * @param {URL} url The URL to fetch information about
 * @returns {JSON} The geolocation information on the given IP
 */
async function fetchGeolocation(ipAddr) {
	const fetchUrl = "http://ip-api.com/json/";
	return await Promise.resolve(getRemoteJSON(fetchUrl + ipAddr));
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
