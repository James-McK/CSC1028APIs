import pkg from "commoncrawl";
const { getIndex: getCCIndex, searchURL: searchCCURL } = pkg;

/**
 * Main function
 */
async function main() {
	getCCIndex().then((data) => {
		//console.log(data);
	});

	searchCCURL("mck.is").then((data) => {
		console.log(data);
	});
}

// Run the main function
main().catch(console.error);
