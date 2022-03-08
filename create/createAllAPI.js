import { MongoClient } from "mongodb";
import createHttpServer from "./createHttpServer.js";
import queryPhishingDB from "../query/queryMPhishDB.js";
import getEarliestArchiveDate from "../query/queryArchiveDate.js";
import dnsLookup from "../query/queryDNS.js";
import fetchGeolocation from "../query/queryGeolocation.js";
import fetchSimilarwebRank from "../query/querySimilarweb.js";
import { fetchSubdomains } from "../query/querySonar.js";
import queryStackShare from "../query/queryStackShare.js";

/**
 * Main function
 */
async function main() {
	// Database is currently hosted on same machine
	const uri = "mongodb://localhost:27017";
	const client = new MongoClient(uri);
	await client.connect();

	// Phishing DB
	createHttpServer(10130, queryPhishingDB);
	// Similarweb rank
	createHttpServer(10131, fetchSimilarwebRank); // TODO: Fails with wwww.npmjs.com but not npmjs.com!
	// DNS Lookup
	createHttpServer(10132, dnsLookup);
	// Earliest archive date
	createHttpServer(10133, getEarliestArchiveDate);
	// Geolocation data of IP
	createHttpServer(10134, fetchGeolocation);
	// Subdomains (Project Sonar)
	createHttpServer(10135, fetchSubdomains, client);
	// StackShare
	createHttpServer(10136, queryStackShare);
}

// Run the main function
main().catch(console.error);
