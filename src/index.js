const { badgen } = require('badgen');
const { isMatch } = require('micromatch');
const fs = require('fs').promises;
const path = require('path');
const github = require('@actions/github');
const core = require('@actions/core');


async function isDir (path) {
	const stats = await fs.stat(path);
	return stats.isDirectory();
}

function norm(base, file) {
	let r = path.resolve(file).replace(/\\/g, '/');
	return r
		.replace(path.resolve(base)
			.replace(/\\/g, '/'), '')
		.replace(/^\//, '');
}


async function countLines(fullPath) {
	return new Promise((res, rej) => {
		let count = 1;
		require('fs').createReadStream(fullPath)
			.on('data', function(chunk) {
				let index = -1;
				while((index = chunk.indexOf(10, index + 1)) > -1) count++
			})
			.on('end', function() {
				res(count);
			})
			.on('error', function(err) {
				rej(err)
			});
	})
}

const countThrottled = throttle(countLines, 10);

/**
 * Recursively count the lines in all matching files within the given directory.
 *
 * @param dir {string} The path to check.
 * @param patterns {string[]} array of patterns to match against.
 * @param negative {string[]} array of patterns to NOT match against.
 * @param oBase {string|null} Leave as null, used internally for recursion.
 * @return {Promise<{ignored: number, lines: number, counted: number}>} An array of all files located, as absolute paths.
 */
async function getFiles (dir, patterns = [], negative = [], oBase=null) {
	const subDirs = await fs.readdir(dir);
	const base = oBase || dir;
	let lines = 0, ignored=0, counted=0;
	await Promise.all(subDirs.map(async (subdir) => {
		const fullPath = path.resolve(dir, subdir);
		if (await isDir(fullPath)) {
			const res = await getFiles(fullPath, patterns, negative, base);
			lines += res.lines;
			ignored += res.ignored;
			counted += res.counted;
		} else {
			const np = norm(base, fullPath);
			if ((!patterns.length || isMatch(np, patterns)) && !isMatch(np, negative)) {
				if (core.isDebug()) core.debug(`Counting:${np}`);
				try {
					lines += await countThrottled(fullPath);
					counted++;
				} catch (err) {
					core.error(err);
				}
			} else {
				ignored++;
			}
		}
	}));

	return { lines, ignored, counted };
}

function throttle(callback, limit=5) {
	let idx = 0;
	const queue = new Array(limit);

	return async (...args) => {
		const offset = idx++ % limit;
		const blocker = queue[offset];
		let cb = null;
		queue[offset] = new Promise((res) => cb = res);  // Next call waits for this call's resolution.

		if (blocker) await blocker;
		try {
			return await callback.apply(this, args);
		} finally {
			cb();
		}
	}
}


function makeBadge(text, config) {
	let { label, color, style, scale, labelcolor } = (config || {});
	label = label || 'Lines of Code';
	color = color || 'blue';
	labelcolor = labelcolor || '555';
	style = style || 'classic';
	scale = scale? parseInt(scale) : 1;

	// only `status` is required.
	return badgen({
		label: `${label}`,     // <Text>
		labelcolor,                     // <Color RGB> or <Color Name> (default: '555')
		status: `${text}`,               // <Text>, required
		color,    // <Color RGB> or <Color Name> (default: 'blue')
		style,    // 'flat' or 'classic' (default: 'classic')
		scale     // Set badge scale (default: 1)
	});
}


const st = Date.now();
const dir = core.getInput('directory') || './';
const badge = core.getInput('badge') || './badge.svg';
const patterns = (core.getInput('patterns')||'').split('|').map(s => s.trim()).filter(s=>s);
const ignore = (core.getInput('ignore') || '').split('|').map(s => s.trim()).filter(s=>s);

const badgeOpts = {};
for (const en of Object.keys(process.env)) {
	if (en.startsWith('INPUT_BADGE_')) {
		badgeOpts[en.replace('INPUT_BADGE_', '').toLowerCase()] = process.env[en]
	}
}

getFiles(dir, patterns, ignore).then( async ret => {
	core.info(`Counted ${ret.lines} Lines from ${ret.counted} Files, ignoring ${ret.ignored} Files.`)
	core.info(`Took: ${Date.now() - st}`);

	core.setOutput("total_lines", `${ret.lines}`);
	core.setOutput("ignored_files", `${ret.ignored}`);
	core.setOutput("counted_files", `${ret.counted}`);
	core.setOutput("elapsed_ms", `${Date.now() - st}`);
	core.setOutput("output_path", `${badge}`);

	await fs.writeFile(badge, makeBadge(ret.lines.toLocaleString(), badgeOpts));
})
