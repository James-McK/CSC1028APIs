import esMain from "es-main";

/**
 * Allow the given callback to be used as a CLI
 */
export default async function createCli(meta, processArgs, callback) {
	if (esMain(meta)) {
		const args = processArgs.slice(2);

		callback(args);
	}
}
