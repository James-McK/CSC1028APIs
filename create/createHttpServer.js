import { createServer } from "http";
import parseQuery from "../parse/parseUserQuery.js";

/**
 * Create a HTTP server to respond to any requests
 */
export default async function createHttpServer(port, callback, extraOpts) {
	const errorRes = { error: "No valid query!" };

	// Create a server object
	createServer(async function (req, res) {
		if (req.method === "GET") {
			// Parse the query to get the search parameters
			let parsedQuery = parseQuery(req);

			// Send a HTTP 200 OK header,
			res.writeHead(200, {
				"Content-Type": "application/json", // and tell the client the Content-Type is application/json
				"X-Clacks-Overhead": "GNU Terry Pratchett", // GNU Terry Pratchett
			});

			if (parsedQuery && parsedQuery.value) {
				// Do something with the user's query
				let result = await callback(parsedQuery.value, extraOpts);

				if (result) {
					// Write the respone to the client
					res.write(JSON.stringify(result));
				} else res.write(JSON.stringify(errorRes));
			} else {
				// No search parameters is currently considered an error
				res.write(JSON.stringify(errorRes));
			}
			res.end(); // End the response
		} else if (req.method === "POST") {
			// I don't know what POST requests are yet, but given that everything seems to use GET requests I'm ignoring POST for now.
		}
	}).listen(port); // The server listens on the given port
}

/**
 * Get the user's request
 * @param {IncomingMessage} req The user's request to the server
 * @returns The details of the user's query if given, or null if the request is invalid
 */
function parseUserQuery(req) {
	// Try to parse the request to get the queried URL
	try {
		let reqFullUrl = new URL(req.url, `https://${req.headers.host}`);
		let searchParams = {};

		reqFullUrl.searchParams.forEach((value, key, parent) => {
			searchParams[key] = value;
		});

		return searchParams;
	} catch {
		return null;
	}
}
