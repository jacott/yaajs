# Yaajs

Yet Another [AMD](https://github.com/amdjs/amdjs-api) compliant
javascript library. This is an alternative to
[RequireJS](https://github.com/jrburke/requirejs).

The main goals of Yaajs are to be more hackable with improved support
for testing, development and debugging. In particular Yaajs manages a
module dependancy graph and provides a `Module#unload` method to remove
a module and all modules dependant on it. It also trys to help find
where loading failed due to syntax/loading errors and dependency
cycles.

Only modern browsers and NodeJS >= version 8 are supported.


## Install

```sh
npm i yaajs
```

## Use

## API

See [AMD API](https://github.com/amdjs/amdjs-api) for the common API.

See the tests in the tests directory for features specific to yaajs.

Config options are:

1. baseUrl
1. paths
1. packages
1. config
1. shim - Shim support is non-compliant at the moment. It supports
   init and deps but only ensures deps are loaded before init is run;
   not before module is loaded.
1. enforceDefine
1. enforceAcyclic - An error is thrown if a dependency cycle is found.
1. recordExports - Module exports which are objects are mapped to
   their module the method `Context#exportsModule(export)` returns an
   array of modules with that export.


## Testing / Developing

```sh
$ npm t
```

## License

The MIT License (MIT)

Copyright (c) 2016-2019 Geoff Jacobsen <geoffjacobsen@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
