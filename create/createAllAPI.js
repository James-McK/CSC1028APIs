import createHttpServer from "./createHttpServer.js";
import queryPhishingDB from "../query/queryMPhishDB.js";
import getEarliestArchiveDate from "../query/queryArchiveDate.js";
import dnsLookup from "../query/queryDNS.js";
import fetchGeolocation from "../query/queryGeolocation.js";
import fetchSimilarwebRank from "../query/querySimilarweb.js";

/**
 * Main function
 */
async function main() {
	createHttpServer(10130, queryPhishingDB);
	createHttpServer(10131, fetchSimilarwebRank);
	createHttpServer(10132, dnsLookup);
	createHttpServer(10133, getEarliestArchiveDate);
	createHttpServer(10134, fetchGeolocation);
}

// Run the main function
main().catch(console.error);
