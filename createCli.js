import esMain from "es-main";

export default async function createCli(meta, processArgs, callback) {
	if (esMain(meta)) {
		// TODO: Does this work when compiled?
		const args = processArgs.slice(2);

		callback(args);
	}
}
