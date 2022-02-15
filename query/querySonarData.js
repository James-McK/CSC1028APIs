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

		let query = { $text: { $search: "rapid7" }, domainWithoutSuffix: "rapid7" };
		await findMany(client, query, "sonardata");
	} catch (e) {
		// Log any errors
		console.error(e);
	} finally {
		await client.close();
	}
}

async function findMany(client, query, collection, db_name = "test_db", maxResults = 1000) {
	const cursor = client.db(db_name).collection(collection).find(query).limit(maxResults);

	const results = await cursor.toArray();

	if (results.length > 0) {
		console.log("Found items:");
		results.forEach((result, i) => {
			console.log(result);
		});
	} else {
		console.log("No results found with the given query!");
	}
}

// Run the main function
main().catch(console.error);
