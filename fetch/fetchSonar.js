import { MongoClient } from "mongodb";
import { parse as tldParse } from "tldts-experimental";
import zlib from "zlib";
import fs from "fs";
import { get as getHttps } from "https";
import readline from "readline";

/**
 * Main function
 */
async function main() {
	// Database is currently hosted on same machine
	const uri = "mongodb://localhost:27017";
	const client = new MongoClient(uri);

	try {
		// Connect to MongoDB
		await client.connect();

		// Drop the collection containg Project Sonar data
		try {
			await dropCollection(client, "sonardata");
		} catch {}

		await client.db("test_db").collection("sonardata").createIndex({ domainWithoutSuffix: "text" });

		// Where the data is stored
		const sonarDataLocation = "/home/jamesm/Downloads/fdns_a.json.gz";
		//const sonarDataLocation = "https://opendata.rapid7.com/sonar.fdns_v2/2022-01-28-1643328400-fdns_a.json.gz";
		//const sonarDataLocation = "C:/Users/James/Downloads/fdns_a.json.gz";
		readFromFile(client, sonarDataLocation);
	} catch (e) {
		console.error(e);
	}
}

/**
 * Decompress and parse the data from the given readstream and add it to the database
 * @param {MongoClient} client The client used to connect to the MongoDB database
 * @param {*} readstream The readstream used to access the data
 */
async function parseSonar(client, readstream) {
	// Pipe the response into gunzip to decompress
	let gunzip = zlib.createGunzip();

	// And pipe the decompressed data to readline so the data can be parsed line by line
	let lineReader = readline.createInterface({
		input: readstream.pipe(gunzip),
	});

	let arr = [];
	// Counter used to add the data in blocks of 100000
	let count = 0;

	// For each line,
	lineReader.on("line", (line) => {
		// Parse the JSON
		let lineJson = JSON.parse(line);
		let hostname = lineJson.name;
		// Some hostnames begin with "*." - just deal with the base domain
		if (hostname.substring(0, 2) === "*.") hostname = hostname.substring(2);

		// Parse the hostname
		let tldParsed = tldParse(hostname);

		// If parsed successfully,
		if (tldParsed.domainWithoutSuffix) {
			// Increment the counter
			count++;
			// Push the parsed data to the array
			arr.push({
				domainWithoutSuffix: tldParsed.domainWithoutSuffix,
				publicSuffix: tldParsed.publicSuffix,
				subdomain: tldParsed.subdomain,
				type: lineJson.type,
				value: lineJson.value,
			});

			// If the array contains 100000 items,
			if (count % 100000 === 0) {
				// Add the items to the database and clear the array
				console.log(`${count} lines parsed`);
				createManyListings(client, arr, "sonardata");
				arr = [];
			}
		}
	});
}

/**
 * Add the given JSON to the database
 * @param {MongoClient} client MongoClient with an open connection
 * @param {JSON[]} newListing The new data to be added
 * @param {string} collection Name of the collection to add the data to
 * @param {string} dbName Name of the database the collection is in
 */
async function createManyListings(client, newListing, collection, dbName = "test_db") {
	client.db(dbName).collection(collection).insertMany(newListing, { ordered: false });
}

// Read the data from the given file and begin parsing it
async function readFromFile(client, dataLocation) {
	let stream = fs.createReadStream(dataLocation);
	parseSonar(client, stream);
}

// Outdated after Project Sonar's data is no longer publicly available
async function readFromWeb(client, url) {
	getHttps(url, function (res) {
		// When the data has been reached, begin parsing it
		if (res.statusCode === 200) {
			parseSonar(client, res);
		} else if (res.statusCode === 301 || res.statusCode === 302) {
			// Recursively follow redirects, only a 200 will resolve.
			console.log(`Redirecting to: ${res.headers.location}`);
			readFromWeb(client, res.headers.location);
		} else {
			// Log any other status codes
			console.log(`Download request failed, response status: ${res.statusCode} ${res.statusMessage}`);
		}
	}).on("error", function (e) {
		console.error(e);
	});
}

// Empty the given collection
async function dropCollection(client, collection, dbName = "test_db") {
	client.db(dbName).collection(collection).drop();
}

// Run the main function
main().catch(console.error);
