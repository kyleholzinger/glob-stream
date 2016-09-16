'use strict';

var Combine = require('ordered-read-streams');
var unique = require('unique-stream');
var pumpify = require('pumpify');
var isNegatedGlob = require('is-negated-glob');
var extend = require('extend');

var GlobStream = require('./stream');

function globStream(globs, opt) {
  if (!opt) {
    opt = {};
  }

  var ourOpt = extend({}, opt);
  var ignore = ourOpt.ignore;

  if (typeof ourOpt.cwd !== 'string') {
    ourOpt.cwd = process.cwd();
  }
  if (typeof ourOpt.dot !== 'boolean') {
    ourOpt.dot = false;
  }
  if (typeof ourOpt.silent !== 'boolean') {
    ourOpt.silent = true;
  }
  if (typeof ourOpt.nonull !== 'boolean') {
    ourOpt.nonull = false;
  }
  if (typeof ourOpt.cwdbase !== 'boolean') {
    ourOpt.cwdbase = false;
  }
  if (ourOpt.cwdbase) {
    ourOpt.base = ourOpt.cwd;
  }
  // Normalize string `ignore` to array
  if (typeof ignore === 'string') {
    ignore = [ignore];
  }
  // Ensure `ignore` is an array
  if (!Array.isArray(ignore)) {
    ignore = [];
  }

  // Only one glob no need to aggregate
  if (!Array.isArray(globs)) {
    globs = [globs];
  }

  var positives = [];
  var negatives = [];

  globs.forEach(function(globString, index) {
    if (typeof globString !== 'string') {
      throw new Error('Invalid glob at index ' + index);
    }

    var glob = isNegatedGlob(globString);
    var globArray = glob.negated ? negatives : positives;

    globArray.push({
      index: index,
      glob: glob.pattern,
    });
  });

  if (positives.length === 0) {
    throw new Error('Missing positive glob');
  }

  // Only one positive glob no need to aggregate
  if (positives.length === 1) {
    return streamFromPositive(positives[0]);
  }

  // Create all individual streams
  var streams = positives.map(streamFromPositive);

  // Then just pipe them to a single unique stream and return it
  var aggregate = new Combine(streams);
  var uniqueStream = unique('path');

  return pumpify.obj(aggregate, uniqueStream);

  function streamFromPositive(positive) {
    var negativeGlobs = negatives
      .filter(indexGreaterThan(positive.index))
      .map(toGlob)
      .concat(ignore);
    return new GlobStream(positive.glob, negativeGlobs, ourOpt);
  }
}

function indexGreaterThan(index) {
  return function(obj) {
    return obj.index > index;
  };
}

function toGlob(obj) {
  return obj.glob;
}

module.exports = globStream;
