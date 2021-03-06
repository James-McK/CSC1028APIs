import "dotenv/config";
import { request, gql } from "graphql-request";
import parseHostname from "../parse/parseHostname.js";
import createCli from "../create/createCli.js";

/**
 * Query stackshare for the given hostname
 * @param {URL} url The URL to fetch information about
 * @returns {JSON} The subdomains of the given URL host
 */
export default async function queryStackShare(url) {
	// Can't query without an API key
	if (!process.env.STACKSHARE_KEY) return null;

	let parsed = parseHostname(url);

	const postUrl = "https://api.stackshare.io/graphql";
	// I don't understand graphql well enough to explain this
	let query = gql`
		query getData($hostname: String!, $results: Int!) {
			enrichment(domain: $hostname) {
				domain
				companyId
				companyName
				companyTools(first: $results, after: "") {
					count
					pageInfo {
						hasNextPage
						endCursor
					}
					edges {
						node {
							tool {
								id
								name
							}
							sourcesSummary
							sources
						}
					}
				}
			}
		}
	`;

	let variables = {
		hostname: parsed.hostname,
		results: 10, // Number of results to get
	};

	// Fetch the result
	return new Promise((resolve) => {
		request({
			url: postUrl,
			document: query,
			variables: variables,
			requestHeaders: { "x-api-key": process.env.STACKSHARE_KEY },
		}).then((data) => {
			resolve(data);
		});
	});
}

/**
 * Callback function if using the CLI
 * @param {Array} args The arguments passed to the app
 */
async function cliCallback(args) {
	args.forEach(async (value) => {
		// Parse the URL
		let url = parseHostname(value);
		let res = await getEarliestArchiveDate(url);
		// Print the result
		console.log(`${value}: ${res}`);
	});
}

createCli(import.meta, process.argv, cliCallback);
