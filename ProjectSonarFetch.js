import { MongoClient } from "mongodb";
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
		// Connect to the MongoDB cluster
		await client.connect();

		// Project Sonar data
		//await readFromFile(client);
		const url = "https://opendata.rapid7.com/sonar.fdns_v2/2021-12-01-1638317387-fdns_txt_mx_dmarc.json.gz";

		await readFromWeb(client, url);
	} catch (e) {
		// Log any errors
		console.error(e);
	} finally {
		//await client.close();
	}
}

async function readFromWeb(client, url) {
	getHttps(url, function (res) {
		if (res.statusCode === 200) {
			// pipe the response into the gunzip to decompress
			var gunzip = zlib.createGunzip();

			let lineReader = readline.createInterface({
				input: res.pipe(gunzip),
			});

			let arr = [];
			let n = 0;
			lineReader.on("line", (sonarLine) => {
				n += 1;
				//console.log(sonarLine);
				let sonarLineJson = JSON.parse(sonarLine);
				arr.push(sonarLineJson);
				if (n % 1000000 === 0) {
					console.log(n);
					console.log(arr);
					createManyListings(client, arr, "test");
					arr = [];
				}
			});
		} else if (res.statusCode === 301 || res.statusCode === 302) {
			// Recursively follow redirects, only a 200 will resolve.
			console.log(`Redirecting to: ${res.headers.location}`);
			readFromWeb(client, res.headers.location);
		} else {
			console.log(`Download request failed, response status: ${res.statusCode} ${res.statusMessage}`);
		}
	}).on("error", function (e) {
		console.error(e);
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
	let arr = [];
	const sonarDataLocation = "C:\\Users\\James\\Downloads\\fdns_a.json.gz";
	let lineReader = readline.createInterface({
		input: fs.createReadStream(sonarDataLocation).pipe(zlib.createGunzip()),
	});

	let n = 0;
	lineReader.on("line", (sonarLine) => {
		n += 1;
		//console.log(sonarLine);
		let sonarLineJson = JSON.parse(sonarLine);
		arr.push(sonarLineJson);
		if (n % 1000000 === 0) {
			console.log(n);
			console.log(arr);
			//createManyListings(client, arr, "projectsonar");
			arr = [];
		}
	});
}

// Run the main function
main().catch(console.error);
