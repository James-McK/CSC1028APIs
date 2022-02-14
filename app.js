import { createServer } from "http";
import { MongoClient } from "mongodb";
import fs from "fs";
import zlib from "zlib";
import readline from "readline";
import { lookup } from "dns";
import getRemoteJSON from "./queryRemoteJSON.js";
import queryPhishingDB from "./queryMPhishDB.js";
import getEarliestArchiveDate from "./queryArchiveDate.js";

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
	const errorRes = { error: "No valid query!" };

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
				if (!p) {
					console.log(`Cannot parse ${reqDetails.queriedUrl}!`);
					res.write(JSON.stringify(errorRes));
				} else {
					console.log(`Queried: ${p}`);

					let ip;
					let reverseDns;

					// If hostname is already an IP address (TODO: Only supports IPv4)
					if (ipRegex.test(p.hostname)) {
						// Fetch the results of the reverse DNS
						ip = { address: p.hostname, family: 4 };
						reverseDns = await Promise.resolve(fetchReverseDns(ip.address));
					} else {
						// Find an IP address the hostname points to
						ip = await Promise.resolve(dnsLookup(p.hostname));
						// I don't know if it makes sense to call reverse dns here but I'm doing it anyway
						reverseDns = await Promise.resolve(fetchReverseDns(ip.address));
					}

					// Project Sonar data
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

					// Location where the server is hosted
					let geolocation = await Promise.resolve(fetchGeolocation(ip.address));

					// SimilarWeb Rank
					//let similarwebRank = await Promise.resolve(fetchSimilarwebRank(p));

					// Could the URL contain malware/phishing attack?
					let phishingResults = await Promise.resolve(queryPhishingDB(client, p));

					let archiveDate = await Promise.resolve(getEarliestArchiveDate(p));

					// Prepare a response to the client
					let response = {
						host: p.host,
						pathname: p.pathname,
						ip: ip,
						phishingData: phishingResults,
						subdomains: await Promise.resolve(fetchSubdomains(p)),
						reverseDns: reverseDns,
						geolocation: geolocation,
						//similarwebRank: similarwebRank,
						archiveDate: archiveDate,
					};

					// Write the respone to the client
					res.write(JSON.stringify(response));
				}
			} else {
				res.write(JSON.stringify(errorRes));
			}
			res.end(); // End the response
		} else if (req.method === "POST") {
			// I don't know what POST requests are yet, but given that browsers seem to use GET requests I'm ignoring POST for now.
		}
	}).listen(8080); // The server listens on port 8080
}
/**
 * Get the user's request
 * @param {IncomingMessage} req The user's request to the server
 * @returns The details of the user's query if given, else null
 */
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

/**
 * Find the result of DNS for the given hostname
 * @param {string} hostname The hostname
 * @returns A promise containing the results of the DNS lookup
 */
function dnsLookup(hostname) {
	return new Promise(function (resolve) {
		lookup(hostname, (err, address, family) => {
			if (err) {
				console.error(err);
				resolve(null);
			} else
				resolve({
					address: address,
					family: family,
				});
		});
	});
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
async function fetchReverseDns(ipAddress) {
	const fetchUrl = "https://sonar.omnisint.io/reverse/";
	return await Promise.resolve(getRemoteJSON(fetchUrl + ipAddress));
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
			return new URL("http://" + urlStr);
		} catch {
			return null;
		}
	}
}

// Run the main function
main().catch(console.error);
