'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var process = _interopDefault(require('process'));
var fs = _interopDefault(require('fs'));
var fspath = _interopDefault(require('path'));
var http = _interopDefault(require('http'));
var https = _interopDefault(require('https'));
var send = _interopDefault(require('koa-send'));
var Koa = _interopDefault(require('koa'));
var opener = _interopDefault(require('opener'));
var livereload$1 = _interopDefault(require('livereload'));
var stream = require('stream');

/*
 * Live reload server with in page build error reporting
 */

function transformStream(stream$1, tr) {
    var r = new stream.Transform({
        transform(chunk, encoding, cb) {
            if (this.buffers == null) {
                this.buffers = [];
            }
            const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding);
            this.buffers.push(buffer);
            cb();
        },
        flush(cb) {
            if (this.buffers) {
                const buffer = tr(Buffer.concat(this.buffers).toString('utf8'));
                this.push(buffer, 'utf8');
                cb();
                this.buffers = null;
            }
        }
    });
    return r;
}


function injectSnippet(ctx, snippet) {
    var body = ctx.body;
    if (Buffer.isBuffer(body)) { // Buffer
        ctx.body = body.toString();
    } else if (typeof body === 'string') { // String
        ctx.body = body.replace(/<\/\s*body\s*>/, snippet + "<\/body>");
    } else if (typeof body.pipe === 'function') { // Stream
        const stream = transformStream(body, function(text) {
            return text.replace(/<\/\s*body\s*>/, snippet + "<\/body>");
        });
        ctx.body = stream;
        body.pipe(stream);
    } else {
        throw new Error('Unexpected body type', body);
    }
}


function getProp(obj, key) {
    if (key.indexOf('.') > -1) {
        const path = key.split('.');
        for (let i=0,l=path.length;i<l;i++) {
            obj = obj[path[i]];
            if (obj === undefined) break;
        }
        return obj;
    } else {
        return obj[key];
    }
}


function expandVars(text, vars) {
    return text.replace(/\$\{([$A-Za-z_]+[$A-Za-z_0-9.]*)\}/g, function(m, p1) {
        const val = getProp(vars, p1);
        return val === undefined ? m : val;
    });
}

function loadErrorSnippet(file) {
    return fs.readFileSync(file || fspath.join(__dirname, 'error.html'), 'utf8');
}

function livereloadSrc(opts) {
    if (opts.src) return src;
    const port = opts.port || 35729;
    const hostname = opts.hostname || '127.0.0.1';
    const protocol = opts.protocol || 'http';
    return protocol+'://'+hostname+':'+port+'/livereload.js?snipver=1';
}

function livereload(opts) {
    opts = opts || {};
    const livereloadSnippet = "\n<script type='application/javascript' src='"+livereloadSrc(opts)+"'></script>\n";
    const errorProvider = opts.error;
    const errorSnippet = errorProvider ? loadErrorSnippet(opts.errorFile) : null;

    return async function livereload(ctx, next) {
        await next();
        if (ctx.res.headersSent || !ctx.writable || !ctx.body) return;
        if (ctx.response.type && !ctx.response.type.includes('html')) return;

        let snippet = livereloadSnippet;
        if (errorProvider.error) {
            snippet = expandVars(errorSnippet, errorProvider.error)+snippet;
        }

        injectSnippet(ctx, snippet);
    }
}

function green(text) {
  return '\u001b[1m\u001b[32m' + text + '\u001b[39m\u001b[22m';
}

/**
 * Serve a file from multiple roots. Return the first matching file.
 */
function serve(roots, index, verbose) {
	const opts = roots.map(root => { return {root: root, index: index, format: true } });
	return async function(ctx) {
		const path = ctx.path;
		for (var i=0,l=opts.length;i<l;i++) {
			try {
				await send(ctx, path, opts[i]);
				if (verbose) console.log('Serving ', path, '->', fspath.join(opts[i].root, path));
				return;
			} catch(e) {
				if (e.code !== 'ENOENT') {
					console.error('Failed to serve '+ctx.path, e);
					ctx.status = 500;
					return;
				}
			}
		}
		if (verbose) console.log('Serving ', path, '->', "404 - Not Found");
		ctx.status = 404;
	}
}

function createLiveReloadOptions(opts) {
	if (!opts) return null;
	if (typeof opts === 'string') {
		return {watch: opts};
	} else if (Array.isArray(opts)) {
		return {watch: opts};
	} else {
		if (!opts.watch) throw new Error('Invalid livereload value. A "watch" property is required!');
		return opts;
	}
}

function DevServer(opts) {
	this.name = opts.name || 'Koa DevServer';
	let roots = opts.root || process.cwd();
	this.host = opts.host || '127.0.0.1';
	this.port = opts.port || 8080;
	this.protocol = opts.https ? 'https' : 'http';
	this.url = this.protocol + '://' + this.host + ':' + this.port;
	this.openUrl = opts.open ? (opts.open === true ? '/' : opts.open) : null;
	this.verbose = !!opts.verbose;
	this.index = opts.index || 'index.html';
	this.error = null;
	this.livereload = createLiveReloadOptions(opts.livereload);

	const app = new Koa();

	if (this.livereload) {
		const _opts = { host: this.host, protocol: this.protocol, error: this };
		const src = this.livereload.src;
		const port = this.livereload.port;
		const errorPage = this.livereload.errorPage;
		if (src) _opts.src = src;
		if (port) _opts.port = port;
		if (errorPage) _opts.errorPage = errorPage;
		app.use(livereload(_opts));
	}

	if (Array.isArray(opts.use)) {
		opts.use.forEach(fn => app.use(fn));
	} else if (opts.use) { // check if function?
		app.use(opts.use);
	}

	// add serveFile middleware at the end
	if (!Array.isArray(roots)) {
		roots = [roots];
	}
	roots = roots.map(root => fspath.resolve(root) );
	this.roots = roots;
	app.use(serve(this.roots, this.index, this.verbose));

	const webServer = opts.https ? https.createServer(opts.https, app.callback()) : http.createServer(app.callback());

	this.webServer = webServer;
	this.app = app;

}

DevServer.prototype = {
	banner() {
		const banner = "-----------------------------------------------------------------------------------------------------\n"
		+`  ${green(this.name)}\n`
		+`  Serving ${green(this.url)} -> ${this.roots}\n`
		+`  Live Reload: ${green(this.livereload?'ON':'OFF')}\n`
		+"-----------------------------------------------------------------------------------------------------";
		return banner;
	},
	start(silent) {
		if (this.livereload) {
			//exclusions:[/node_modules\//]
			const opts = Object.assign({}, this.livereload);
			// by default exclude node_modules
			if (!opts.exclusions) {
				opts.exclusions = [/node_modules\//];
			} else {
				opts.exclusions.push(/node_modules\//);
			}
			if (opts.watch) {
				if (Array.isArray(opts.watch)) {
					opts.watch.forEach(path=>fspath.resolve(path));
				} else {
					opts.watch = fspath.resolve(opts.watch);
				}
			}
			this.liveServer = livereload$1.createServer(opts);
			if (opts.watch) {
				this.liveServer.watch(opts.watch || this.roots);
			}
		}
		this.webServer.listen(this.port, this.host);

		if (!silent) {
			console.log(this.banner());
		}
		this.running = true;
		return this;
	},
	stop() {
		if (this.webServer) {
			this.webServer.close();
		}
		if (this.liveServer) {
			this.liveServer.close();
			this.liveServer = null;
		}
		return this;
	},
	// open url in browser if opts.open is set
	open(url) {
		if (!url) {
			url = this.openUrl ? fspath.join(this.url, this.openUrl) : null;
		}
		if (url) {
			// open in browser
			opener(url);
		}
		return this;
	},
	setError(error) {
		if (!error) {
			if (this.error) {
				this.error = null;
				this.refresh();
			}
		} else {
			this.error = error;
			this.refresh();
		}
	},
	clearError() {
		this.setError(null);
	},
	refresh() {
		this.liveServer && this.liveServer.refresh('/');
	}
};

module.exports = DevServer;