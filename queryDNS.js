import { lookup } from "dns";

/**
 * Find the result of DNS for the given hostname
 * @param {string} hostname The hostname
 * @returns A promise containing the results of the DNS lookup
 */
export default function dnsLookup(hostname) {
	return new Promise(function (resolve) {
		lookup(hostname, (err, address, family) => {
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
