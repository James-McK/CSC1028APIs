import { MongoClient } from "mongodb";
import fetch from "node-fetch";

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

		// Fetch data from phishtank and add it to the database
		await fetchPhishtank(client);
		await fetchOpenPhish(client);
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
 * @param {MongoClient} client MongoClient with an open connection
 */
async function fetchPhishtank(client) {
	try {
		// Read in the data from phishtank (Already given in JSON format)
		let url = "http://data.phishtank.com/data/online-valid.json";
		let phishtank = await Promise.resolve(getRemoteJSON(url));
		console.log("Fetched PhishTank data...");
		//let phishtank = JSON.parse(readFileSync("phishtank.json", "utf8"));

		await emptyCollection(client, "phishtank");
		// For each phish in the tank:
		for (let phishIn of phishtank) {
			// Parse the URL
			let phishUrl = new URL(phishIn.url);

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
				details_url: phishIn.phish_detail_url,
				target: phishIn.target,
			};

			// Add the details to the phishtank container - the phish tank tank
			await createListing(client, phish, "phishtank");
		}

		console.log("Added " + phishtank.length + " items from PhishTank...");
	} catch (e) {
		//console.log(e);
		console.log("Fetching phistank failed (Probably rate limited). Continuing...");
	}
}

/**
 * Fetch data from OpenPhish (https://openphish.com/feed.txt) and add it to the database.
 * TODO: Look into https://openphish.com/phishing_feeds.html - community version seems to be limited to 500?
 * @param {MongoClient} client MongoClient with an open connection
 */
async function fetchOpenPhish(client) {
	try {
		// Read in the data from phishtank (Already given in JSON format)
		let url = "https://openphish.com/feed.txt";
		let openPhishText = await Promise.resolve(getRemoteText(url));
		console.log("Fetched OpenPhish data...");
		let lines = openPhishText.split("\n");

		await emptyCollection(client, "openphish");
		// For each phish in the tank:
		for (let line of lines) {
			if (!line) continue;
			// Parse the URL
			let phishUrl = new URL(line);

			// Path still matters for OpenPhish data - a couple of the URLs were to backblaze and a link shortener
			let hasPath = phishUrl.pathname.length > 1;

			// I still haven't decided exactly what data I'm storing in the db yet, this is just a first guess.
			// https://nodejs.org/api/url.html
			let phish = {
				hostname: phishUrl.hostname,
				includesPath: hasPath,
				pathname: phishUrl.pathname,
			};

			// Add the details to the phishtank container - the phish tank tank
			await createListing(client, phish, "openphish");
		}

		console.log("Added " + lines.length + " items from OpenPhish...");
	} catch (e) {
		console.log("OpenPhish doesn't seem to be rate limited, so something has gone badly wrong.");
		console.log(e);
		console.log("Continuing to next source anyway...");
	}
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
 * Fetch text from the given URL
 * @param {string} url The URL from which the JSON should be fetched
 * @returns {string} The string to be used elsewhere
 */
async function getRemoteText(url) {
	let settings = { method: "Get" };
	let res = await fetch(url, settings);
	let text = await res.text();
	return text;
}

/**
 * Add the given JSON to the database
 * @param {MongoClient} client MongoClient with an open connection
 * @param {JSON} newListing The new data to be added
 * @param {string} collection Name of the collection to add the data to
 * @param {string} dbName Name of the database the collection is in
 */
async function createListing(client, newListing, collection, dbName = "test_db") {
	await client.db(dbName).collection(collection).insertOne(newListing);
}

/**
 * Remove all items from the given collection
 * @param {MongoClient} client MongoClient with an open connection
 * @param {string} collection Name of the collection to remove the items from
 * @param {string} dbName Name of the database the collection is in
 */
async function emptyCollection(client, collection, dbName = "test_db") {
	await deleteMany(client, {}, collection, dbName);
}

/**
 * Delete items from the given collection that match the given JSON
 * @param {MongoClient} client MongoClient with an open connection
 * @param {JSON} listingDetails The JSON to match with items to be deleted
 * @param {string} collection Name of the collection to remove the items from
 * @param {string} dbName Name of the database the collection is in
 */
async function deleteMany(client, listingDetails, collection, dbName = "test_db") {
	const result = await Promise.resolve(client.db(dbName).collection(collection).deleteMany(listingDetails));
	console.log(`${result.deletedCount} document(s) was/were deleted.`);
}

// Run the main function.
main().catch(console.error);
