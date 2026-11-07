'use strict';

const integrity = require('./integrity');
const moduleApi = require('./module');

module.exports = {
  ...integrity,
  ...moduleApi,
};
