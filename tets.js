const { glob } = require('glob-gitignore');
const core = require('@actions/core');


async function getFiles (dir, patterns = [], negative = []) {
	let lines = 0, ignored=0, counted=0;

	await glob(patterns, {
		cwd: dir,
		ignore: negative,
		nodir: true
	}).then(files => {
		return Promise.all(files.map( async f => {
			try {
				console.log(f);
				counted ++;
			} catch (err) {
				core.error(err);
			}
		}))
	});

	return { lines, ignored, counted };
}

getFiles('./', ['**'], []).then(console.log)
