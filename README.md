# koa-devserver

A development server based on [Koa HTTP framework](https://koajs.com/).

The server was initialy implemented as part of the [Qute](https://qutejs.org) development tools,
but can be used inside any JavaScript build tools like [rollup.js](https://rollupjs.org/) or [Webpack](https://webpack.js.org/).

## Integrations

* [rollup-plugin-koa-devserver](https://github.com/bstefanescu/rollup-plugin-koa-devserver) - An integration as a Rollup plugin.

## Features

* Built-in live reload using [livereload](https://github.com/napcs/node-livereload).
* Displaying build errors in the browser when build fails.
* Customizable build error page.
* Customizable middleware stack - you can use any existing Koa plugins to configure your middleware stack. Or you can write your own middleware if needed.

## Usage

```
npm install -D koa-devserver
```

```javascript
import DevServer from 'koa-devserver';

const server = new DevServer(opts);
server.start();

['SIGINT', 'SIGTERM'].forEach((signal) => {
	process.on(signal, () => {
		server.stop();
		process.exit();
	})
})
```

See the [rollup-plugin-koa-devserver](https://github.com/bstefanescu/rollup-plugin-koa-devserver) for usage inside a rollup build.

### DevServer options

Here is a list of all available options:

```javascript
{
	name: 'Koa DevServer',
	root: '.', // the web root - or ["path/to/root1", "path/to/root2"] for multiple web roots
	host: '127.0.0.1', // the host to listen to
	port: 8080, // the port to listen to
	open: '/path_to_open_in_browser/when/server/starts.html',
	index: 'index.html', // use an index file when GET directory -> passed to koa-send
	verbose: false, // if true print HTTP requests
	https: { // defaults to undefined

	}
	livereload: { // can be a string an array or an object. defaults to undefined.
		// any livereload option
		// plus:
		watch: "path/to/watch", // or an array of paths, regexs or globs
		port: 35729, // use a custom livereload port
		src: 'http://127.0.0.1:35729/livereload.js?snipver=1', // use a custom livereload script src
		errorPage: '/fs/path/to/error_page_template.html' // use a custom error page template
	},
	use: [ koaMiddleware ] // can inject one or more koa middleware in the request execution stack
}
```
* **`name`** - *string* - the name printed in the server banner when server is started. You can change it to any name you want. The default value is *Koa DevServer*.

* **`root`** - *string* or *array* - specify the web content root (i.e. the directory where the requests are resolved to file system paths).
To specify more than one directories, use an array. The request paths will be resolved in each of the specified directory until a file is found. If not match is found a 404 http status is returned.
This option defaults to the current working directory  (i.e. '.').

* **`host`** - *string* - the host name to listen to. Defaults to `127.0.0.1`.
* **`port`** - *integer* - the port to listent to. Defaults to `8080`.
* **`open`** - *string* - The url path to open when server starts (i.e. when `open` method is called). Defaults to `undefined`.
* **`index`** - *string* - the index file name to use when serving directories. It is passed to `koa-send`. Defaults to `index.html`.
* **`verbose`** - *boolean* -  if true prints each HTTP request. Defaults to `false`.
* **`https`** - *object* - specify that **https** should be used. See node `https` module for the available options. Defaults to `undefined`.
* **`use`** - *koa middleware* or *array of koa middlewares*. Can be used to inject any required middleware in the HTTP stack. Each specified middleware will be added by calling `koa.use(middleware)`
* **`livereload`** - *object* or *string* - the livereload configuration. Buy default live reload is off. To **enable live reload** you must specify one or more paths to watch.  \
If you don't need extra live reload configuration you can just use a string or an array as the livereload value: this will be path to watch.  \
If you need to specify additonal options then you need to use as the value an object with at least the `watch` property which should point to the path or array of paths to watch.  \
**Note** that the paths to watch are in the format supported by liverload watch method (i.e. directory paths or glob patterns as supported by [chokidar](https://github.com/paulmillr/chokidar)).  \
Here is the list of supported properties:
	* `watch` - *string* or *array* - as explained above: the path or paths to watch. This will usually point to **the build artifacts**.
	* `port` - *integer* - the port to use. Defaults to `35729`.
	* `src` - *string* - a custom livereload.js script src.
	* `errorPage` - *string* - an optional path to a error template file.
    * any other configuration property supported by the [livereload](https://www.npmjs.com/package/livereload) library.

## Example

Using a default configuration with the koa cors middleware and using a liverelaod on the `build/dev`directory:

```javascript
new DevServer({
	use: require('@koa/cors')(),
	livereload: 'build/dev'
}).start();
```

## License

[MIT](LICENSE)

## Authors

**[Bogdan Stefanescu](mailto:bogdan@quandora.com)** - *Intial Work* - [Quandora](https://quandora.com)
