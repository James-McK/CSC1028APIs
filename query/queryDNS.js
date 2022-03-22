import { lookup } from "dns";
import createCli from "../create/createCli.js";
import parseHostname from "../parse/parseHostname.js";

/**
 * Find the result of DNS for the given hostname
 * @param {string} url The hostname
 * @returns A promise containing the results of the DNS lookup
 */
export default function dnsLookup(url) {
	let parsed = parseHostname(url);

	// Get the result of the DNS request and return it
	return new Promise(function (resolve) {
		lookup(parsed.hostname, (err, address, family) => {
			if (err) {
				console.error(err);
				resolve(null);
			} else
				resolve({
					address: address,
					family: family,
				});
		});
	});
}

/**
 * Callback function if using the CLI
 * @param {Array} args The arguments passed to the app
 */
async function cliCallback(args) {
	args.forEach(async (value) => {
		let res = await dnsLookup(value);
		// Print the result
		console.log(`${value}: ${JSON.stringify(res)}`);
	});
}

createCli(import.meta, process.argv, cliCallback);
