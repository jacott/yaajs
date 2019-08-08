const yaajs = global.yaajs = require('../');
const expect = require('expect.js');
const path = require('path');

yaajs.nodeRequire = require;

yaajs.module.ctx.config({baseUrl: path.resolve(__dirname)});

yaajs("./test-suite", function (testSuite) {testSuite(expect)});
