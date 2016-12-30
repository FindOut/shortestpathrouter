var ShortestPathRouter = require('../');
var assert = require('assert');

describe('ShortestPathRouter', function() {
	// it('should return instance on new', function() {
	// 	var spr = new ShortestPathRouter();
	//   assert.ok(spr);
	// });

	// it('should have the right methods', function() {
	// 	var spr = new ShortestPathRouter();
	// 	assert.ok(spr.addObstacle, 'has method addObstacle');
	// 	assert.ok(spr.removeObstacle, 'has method removeObstacle');
	// 	assert.ok(spr.addPath, 'has method addObstacle');
	// 	assert.ok(spr.removePath, 'has method addObstacle');
	// 	assert.ok(spr.setSpacing, 'has method setSpacing');
	// 	assert.ok(spr.getSpacing, 'has method getSpacing');
	// 	assert.ok(spr.solve, 'has method solve');
	// });

	// it('should not change path without any obstacle', function() {
	// 	var spr = new ShortestPathRouter();
	// 	spr.addPath(new spr.Path({x: 0, y: 0}, {x: 100, y: 0}));
	// 	var result = spr.solve();
	// 	console.log('result', result);
	// 	assert.ok(result, 'result is something');
	// 	assert.equal(result.length, 1, 'result has one item');
	// 	assert.equal(result[0].points.length, 2, 'result path should have two points');
	// });

	it('should change path with an obstacle', function() {
		var spr = new ShortestPathRouter();
		spr.addPath(new spr.Path({x: 0, y: 0}, {x: 100, y: 100}));
		spr.addObstacle({x: 45, y: 45, width: 10, height: 10});
		var result = spr.solve();
		console.log('result', result[0].getPoints());
		assert.equal(result.length, 1, 'result has one item');
		assert.equal(result[0].points.length, 3, 'result path should have three points');
	});

	// it('should change path with an obstacle', function() {
	// 	var spr = new ShortestPathRouter();
	// 	spr.addPath(new spr.Path({x: 0, y: 0}, {x: 200, y: 200}));
	// 	spr.addObstacle({x: 45, y: 45, width: 10, height: 10});
	// 	spr.addObstacle({x: 145, y: 145, width: 10, height: 10});
	// 	var result = spr.solve();
	// 	console.log('result', result[0].getPoints());
	// 	assert.equal(result.length, 1, 'result has one item');
	// 	assert.equal(result[0].points.length, 3, 'result path should have three points');
	// });
});