export default function parseHostname(hostname) {
	if (!hostname) return null;
	if (hostname.hostname) return hostname;

	try {
		return new URL(hostname);
	} catch {
		try {
			// Assume http if no protocol given
			return new URL("https://" + hostname);
		} catch {
			return null;
		}
	}
}
