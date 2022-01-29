import { MongoClient } from "mongodb";
import zlib from "zlib";
import fs from "fs";
import { get as getHttps } from "https";
import readline from "readline";
import { parse as tldtsParse } from "tldts-experimental";

/**
 * Main function
 */
async function main() {
	// Database is currently hosted on same machine
	const uri = "mongodb://localhost:27017";
	const client = new MongoClient(uri);

	//const

	try {
		// Connect to the MongoDB cluster
		await client.connect();

		//client.db("test_db").collection("sonartest").createIndex( { })

		// Project Sonar data
		await readFromFile(client);

		//const url = "https://opendata.rapid7.com/sonar.fdns_v2/2021-12-01-1638317387-fdns_txt_mx_dmarc.json.gz";
		const url = "https://opendata.rapid7.com/sonar.fdns_v2/2021-12-31-1640909088-fdns_a.json.gz";
		//await readFromWeb(client, url, parseSonar);
	} catch (e) {
		// Log any errors
		console.error(e);
	} finally {
		//await client.close();
	}
}

async function readFromWeb(client, url, parseMethod) {
	getHttps(url, function (res) {
		if (res.statusCode === 200) {
			parseMethod(client, res);
		} else if (res.statusCode === 301 || res.statusCode === 302) {
			// Recursively follow redirects, only a 200 will resolve.
			console.log(`Redirecting to: ${res.headers.location}`);
			readFromWeb(client, res.headers.location, parseMethod);
		} else {
			console.log(`Download request failed, response status: ${res.statusCode} ${res.statusMessage}`);
		}
	}).on("error", function (e) {
		console.error(e);
	});
}

async function parseSonar(client, input) {
	// Pipe the response into gunzip to decompress
	var gunzip = zlib.createGunzip();

	let lineReader = readline.createInterface({
		input: input.pipe(gunzip),
	});

	let arr = [];
	let n = 0;
	let failed = 0;
	lineReader.on("line", (line) => {
		let lineJson = JSON.parse(line);
		if (lineJson.name.substring(0, 2) === "*.") lineJson.name = lineJson.name.substring(2);
		let tldParsed = tldtsParse(lineJson.name);

		if (!tldParsed.domainWithoutSuffix) {
			failed++;
			if (failed % 10 === 0) console.log(`Failed: ${failed}`);
		} else {
			n++;
			//console.log(parsed);
			arr.push({
				domainWithoutSuffix: tldParsed.domainWithoutSuffix,
				publicSuffix: tldParsed.publicSuffix,
				subdomain: tldParsed.subdomain,
				type: lineJson.type,
				value: lineJson.value,
			});
			if (n % 1000000 === 0) {
				console.log(`${n} lines parsed`);
				createManyListings(client, arr, "test");
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
	client.db(dbName).collection(collection).insertMany(newListing);
}

async function readFromFile(client) {
	const sonarDataLocation = "C:\\Users\\James\\Downloads\\fdns_a.json.gz";
	parseSonar(client, fs.createReadStream(sonarDataLocation));
}

// Run the main function
main().catch(console.error);
