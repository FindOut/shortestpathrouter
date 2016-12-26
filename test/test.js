var ShortestPathRouter = require('../');
var assert = require('assert');

describe('ShortestPathRouter', function() {
	var spr = new ShortestPathRouter();
	it('should return instance on new', function() {
	  assert.ok(spr);
	});

	it('should have the right methods', function() {
		assert.ok(spr.addObstacle, 'has method addObstacle');
		assert.ok(spr.removeObstacle, 'has method removeObstacle');
		assert.ok(spr.addPath, 'has method addObstacle');
		assert.ok(spr.removePath, 'has method addObstacle');
		assert.ok(spr.setSpacing, 'has method setSpacing');
		assert.ok(spr.getSpacing, 'has method getSpacing');
		assert.ok(spr.solve, 'has method solve');
	});

	it('should not change path without any obstacle', function() {
		spr.addPath(new spr.Path({x: 0, y: 0}, {x: 100, y: 0}));
		var result = spr.solve();
		console.log('result', result);
		assert.ok(result, 'result is something');
		assert.equal(result.length, 1, 'result has one item');
		assert.equal(result[0].points.length, 2, 'result path should have two points');
	});

	it('should not change path without any obstacle', function() {
		spr = new ShortestPathRouter();
		spr.addPath(new spr.Path({x: 0, y: 0}, {x: 100, y: 100}));
		spr.addObstacle({x: 45, y: 45, width: 10, height: 10});
		var result = spr.solve();
		console.log('result', result);
		assert.ok(result, 'result is something');
		assert.equal(result.length, 1, 'result has one item');
		assert.equal(result[0].points.length, 2, 'result path should have two points');
	});
});