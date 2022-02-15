/**
 * Try to parse the URL when it is unknown if the string contains the URL's protocol
 * @param {string} urlStr The string to be parsed
 * @returns {URL} The parsed result
 */
export default function tryParseUrl(urlStr) {
	try {
		return new URL(urlStr);
	} catch {
		try {
			// Assume http if no protocol given
			return new URL("https://" + urlStr);
		} catch {
			return null;
		}
	}
}
