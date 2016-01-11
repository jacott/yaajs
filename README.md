# Yaajs

Yet Another [AMD](https://github.com/amdjs/amdjs-api) compliant
javascript library. This is an alternative to
[RequireJS](https://github.com/jrburke/requirejs). The main goals of
Yaajs are to be smaller and more hackable with improved support for
testing, development and debugging. In particular Yaajs manages a
module dependancy tree and provides a `Module#unload` method to remove
a module and all modules dependant on it.

Yaajs is also mostly compiliant to the RequireJS api but does have
some missing features and some more advanced options are done in a
different manner.

Only modern browsers and NodeJS are supported.


## Install

```sh
npm i yaajs
```

## Use

## API

See [AMD](https://github.com/amdjs/amdjs-api) API

Shims have a slightly non-compliant API to improve
performance and size; see tests for details.

## Testing / Developing

```sh
$ tools/run-tests
```

## License

The MIT License (MIT)

Copyright (c) 2016 Geoff Jacobsen <geoffjacobsen@gmail.com>

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
