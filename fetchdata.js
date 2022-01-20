import { MongoClient } from "mongodb";
import fetch from "node-fetch";
//import { readFileSync } from "fs";

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
		await fetchUrlHaus(client);
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
		const fetchUrl = "http://data.phishtank.com/data/online-valid.json";
		const collectionName = "phishtank";

		// Read in the data from phishtank (Already given in JSON format)
		let phishtank = await Promise.resolve(getRemoteJSON(fetchUrl));
		console.log("Fetched PhishTank data...");

		await emptyCollection(client, collectionName);
		// For each phish in the tank:
		for (let phishIn of phishtank) {
			// Parse the URL
			let url = new URL(phishIn.url);

			// I still haven't decided exactly what data I'm storing in the db yet, this is just a first guess.
			// https://nodejs.org/api/url.html
			let details = {
				details_url: phishIn.phish_detail_url,
				target: phishIn.target,
			};

			// Add the details to the phishtank container - the phish tank tank
			await addToDatabase(client, url.hostname, url.pathname, details, collectionName);
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
		const fetchUrl = "https://openphish.com/feed.txt";
		const collectionName = "openphish";

		// Read in the data from OpenPhish
		let openphishText = await Promise.resolve(getRemoteText(fetchUrl));
		console.log("Fetched OpenPhish data...");
		let lines = openphishText.split("\n");

		await emptyCollection(client, collectionName);
		// For each phish in the tank:
		for (let line of lines) {
			if (!line) continue;
			// Parse the URL
			let url = new URL(line);
			let details = null;

			await addToDatabase(client, url.hostname, url.pathname, details, collectionName);
		}

		console.log("Added " + lines.length + " items from OpenPhish...");
	} catch (e) {
		console.log("OpenPhish doesn't seem to be rate limited, so something has gone badly wrong.");
		console.log(e);
		console.log("Continuing to next source anyway...");
	}
}

/**
 * Fetch data from UrlHaus (https://urlhaus.abuse.ch/downloads/csv_online/) and add it to the database.
 * @param {MongoClient} client MongoClient with an open connection
 */
async function fetchUrlHaus(client) {
	try {
		const fetchUrl = "https://urlhaus.abuse.ch/downloads/csv_online/";
		const collectionName = "urlhaus";

		// Read in the data from URLHaus
		let urlHausText = await Promise.resolve(getRemoteText(fetchUrl));

		console.log("Fetched URLHaus data...");
		let lines = urlHausText.split("\n");

		await emptyCollection(client, collectionName);
		// For each phish in the tank:
		for (let line of lines) {
			if (!line || line.charAt(0) === "#") continue;

			let split = line.split('","');
			// Parse the URL
			let url = new URL(split[2]);

			let details = {
				details_url: split[6],
				threat: split[4],
				tags: split[5].split(","),
			};

			await addToDatabase(client, url.hostname, url.pathname, details, collectionName);
		}

		console.log("Added " + lines.length + " items from URLHaus...");
	} catch (e) {
		console.log("Encountered an error while updating URLHaus data:");
		console.log(e);
		console.log("Continuing to next source anyway...");
	}
}

/**
 * Add items to the database in a standardised way
 * @param {MongoClient} client MongoClient with an open connection
 * @param {string} hostname The hostname of the URL
 * @param {string} pathname The pathname of the URL
 * @param {JSON} details Any other details
 * @param {string} collection Name of the collection to add the data to
 * @param {string} dbName Name of the database the collection is in
 */
async function addToDatabase(client, hostname, pathname, details, collection, dbName = "test_db") {
	// For some URLs, the path matters!
	// eg. not everything at sites.google.com is a phishing site, but sites.google.com/site/phishingsite is
	// However while the current approach has the advantage of no false positives, it will also result in some false negatives
	// eg. phishingsite.tld will not be picked even though phishingsite.tld/example is in the database.
	// Is manually picking out the sites that URL paths should be checked on an approach worth considering?
	let hasPath = pathname.length > 3;

	let item = {
		hostname: hostname,
		includesPath: hasPath,
		pathname: pathname,
		details: details,
	};

	await createListing(client, item, collection, dbName);
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
