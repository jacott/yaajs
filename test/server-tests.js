var yaajs = global.yaajs = require('../');
var expect = require('expect.js');
var path = require('path');

yaajs.nodeRequire = require;

yaajs.module.ctx.config({baseUrl: path.resolve(__dirname)});

yaajs("./test-suite", function (testSuite) {testSuite(expect)});
