import parseHostname from "./parseHostname.js";

export default function parseQuery(req) {
	// If already parsed
	if (req.value) return query;

	// Try to parse the request to get the queried URL
	try {
		let reqFullUrl = new URL(req.url, `https://${req.headers.host}`);
		//console.log(reqFullUrl);
		let searchParams = {};

		reqFullUrl.searchParams.forEach((value, key) => {
			searchParams[key] = value;
		});

		let res = {
			value: parseHostname(reqFullUrl.pathname.substring(1)),
			searchParams: searchParams,
		};
		//console.log(res);
		return res;
	} catch {
		return null;
	}
}
