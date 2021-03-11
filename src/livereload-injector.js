/*
 * Live reload server with in page build error reporting
 */
import fs from 'fs';
import fspath from 'path';
import {Transform} from 'stream';

function transformStream(stream, tr) {
    var r = new Transform({
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
        if (val) {
            return val.replace(/</g, '&lt;').replace(/>/g,'&gt;'); // escape <, >
        } else {
            return '';
        }
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

function createError(error) {
    const result = Object.assign({}, error);
    result.file = error.file || error.id;
    result.line = error.line || (error.log && error.loc.line);
    result.column = error.column || (error.log && error.loc.column);
    if (result.file) {
        if (!result.line || !result.column) {
            result.location = result.file;
        } else {
            result.location = result.file + ' ('+(result.line||'0')+':'+(result.column||'0')+')';
        }
    } else {
        result.location = 'unknown';
    }
    return result;
}

function livereload(opts) {
    opts = opts || {};
    const livereloadSnippet = "\n<script type='application/javascript' src='"+livereloadSrc(opts)+"'></script>\n";
    const errorProvider = opts.errorProvider;
    const errorSnippet = errorProvider ? loadErrorSnippet(opts.errorFile) : null;

    return async function livereload(ctx, next) {
        await next();
        if (ctx.res.headersSent || !ctx.writable || !ctx.body) return;
        if (ctx.response.type && !ctx.response.type.includes('html')) return;

        let snippet = livereloadSnippet;
        if (errorProvider && errorProvider.error) {
            const error = createError(errorProvider.error);
            //console.log('+++++++++++++++++++++++++++\n', error, '\n+++++++++++++++++++++++++');
            snippet = expandVars(errorSnippet, error)+snippet;
        }

        injectSnippet(ctx, snippet);
    }
}

export default livereload;
