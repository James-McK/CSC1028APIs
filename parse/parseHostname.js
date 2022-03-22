// Parse the given URL/hostname
export default function parseHostname(hostname) {
	if (!hostname) return null;
	// If it has already been parsed, no need to parse it again
	if (hostname.hostname) return hostname;

	try {
		// Try to create a URL object
		return new URL(hostname);
	} catch {
		try {
			// Assume https if no protocol given
			return new URL("https://" + hostname);
		} catch {
			return null;
		}
	}
}
