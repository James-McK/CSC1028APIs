import { MongoClient } from "mongodb";
import { readFileSync } from "fs";

/**
 * Main function
 */
async function main() {
	// Database is currently hosted on same machine
	const uri = "mongodb://localhost:27017";
	const client = new MongoClient(uri);

	try {
		// Connect to the database
		await client.connect();

		// TODO: Clear contents of database?

		// Fetch data from phishtank and add it to the database
		await fetchPhishtank(client);
		// TODO: Other data sources
	} catch (e) {
		// Log any errors
		console.error(e);
	} finally {
		// Close the client connection before exiting
		await client.close();
	}
}

/**
 * Fetch data from phishtank (http://data.phishtank.com/data/online-valid.json) and add it to the database.
 * TODO: data is currently only fetched from a local copy named phishtank.json!
 * @param {MongoClient} client MongoClient with an open connection
 */
async function fetchPhishtank(client) {
	// Read in the data from phishtank (Already given in JSON format)
	let phishtank = JSON.parse(readFileSync("phishtank.json", "utf8"));

	// For each phish in the tank:
	for (obj of phishtank) {
		// Parse the URL
		let phishUrl = new URL(obj.url);

		// For some URLs, the path matters!
		// eg. not everything at sites.google.com is a phishing site, but sites.google.com/site/phishingsite is
		// However while the current approach has the advantage of no false positives, it will also result in some false negatives
		// eg. phishingsite.tld will not be picked even though phishingsite.tld/en is in the database.
		// Is manually picking out the sites that URL paths should be checked on an approach worth considering?
		let hasPath = phishUrl.pathname.length > 1;

		// I still haven't decided exactly what data I'm storing in the db yet, this is just a first guess.
		// https://nodejs.org/api/url.html
		let phish = {
			hostname: phishUrl.hostname,
			includesPath: hasPath,
			pathname: phishUrl.pathname,
			// Query and hash probably don't matter in this case
			details_url: obj.phish_detail_url,
			target: obj.target,
		};

		// Add the details to the phishtank container
		await createListing(client, phish, "phishtank");
	}
}

/**
 * Add the given JSON to the database
 * @param {MongoClient} client MongoClient with an open connection
 * @param {JSON} newListing The new data to be added
 * @param {string} collection Name of the collection to add the data to
 * @param {string} dbName Name of the database to be added to
 */
async function createListing(
	client,
	newListing,
	collection,
	dbName = "test_db"
) {
	const result = await client
		.db(dbName)
		.collection(collection)
		.insertOne(newListing);
	console.log(
		`New listing created with the following id: ${result.insertedId}`
	);
}

// Run the main function.
main().catch(console.error);
