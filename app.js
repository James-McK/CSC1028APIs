import { createServer } from "http";
import { parse } from "url";
import { MongoClient } from "mongodb";

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
		if (req.method === "GET") {
			res.writeHead(200, {
				// Send a HTTP 200 OK header,
				"Content-Type": "application/json", // and tell the client the Content-Type is application/json
				"X-Clacks-Overhead": "GNU Terry Pratchet", // GNU Terry Pratchett
			});

			// Try to parse the request to get the queried URL
			let queriedUrl;
			try {
				queriedUrl = new URL(req.url, `http://${req.headers.host}`).searchParams.get("url");
			} catch {}

			// If any sort of queried url was given:
			if (queriedUrl) {
				// Parse it from a string to a URL object
				let p = tryParseUrl(queriedUrl);

				// Query phishtank
				let phishtankResult = await Promise.resolve(queryPhishtank(client, p));

				// Prepare a response to the client
				let response = {
					protocol: p.protocol,
					host: p.host,
					pathname: p.pathname,
					phishtank: phishtankResult,
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
	// Check if there is a matching hostname
	let result = await client
		.db("test_db")
		.collection("phishtank")
		.findOne({ hostname: url.hostname });

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
				.db("test_db")
				.collection("phishtank")
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
