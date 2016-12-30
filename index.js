'use strict';

module.exports = ShortestPathRouter;

var PositionConstants = new function() {
	this.NONE = 0;
	this.LEFT = 1;
	this.CENTER = 2;
	this.RIGHT = 4;
	this.LEFT_CENTER_RIGHT = this.LEFT | this.CENTER | this.RIGHT;
	this.ALWAYS_LEFT = 64;
	this.ALWAYS_RIGHT = 128;
	this.TOP = 8;
	this.MIDDLE = 16;
	this.BOTTOM = 32;
	this.TOP_MIDDLE_BOTTOM = this.TOP | this.MIDDLE | this.BOTTOM;
	this.NORTH = 1;
	this.SOUTH = 4;
	this.WEST = 8;
	this.EAST = 16;
	this.HORIZONTAL = 64;
	this.VERTICAL = 128;
	this.NORTH_EAST = this.NORTH | this.EAST;
	this.NORTH_WEST = this.NORTH | this.WEST;
	this.SOUTH_EAST = this.SOUTH | this.EAST;
	this.SOUTH_WEST = this.SOUTH | this.WEST;
	this.NORTH_SOUTH = this.NORTH | this.SOUTH;
	this.EAST_WEST = this.EAST | this.WEST;
	this.NSEW = this.NORTH_SOUTH | this.EAST_WEST;
}();

function checkClass(o, clazz, msg) {
	if (!(Object.getPrototypeOf(o) === clazz.prototype)) {
		throw new Error('invalid class. Should be ' + clazz.name + ' is ' + o + (msg || ''))
	}
}

function checkObstacles(obstacles) {
	for (var i = 0; i < obstacles.length; i++) {
		checkClass(obstacles[i], Obstacle, ' i:' + i)
	}
}

function arrayContainsEqual(a, o) {
	for (var i in a) {
		if (a[i].equals(o)) {
			return true;
		}
	}
	return false;
}

function arrayReverse(a) {
	var i = 0, j = a.length - 1;
	while (i < j) {
		var t = a[i];
		a[i] = a[j];
		a[j] = t;
		i++; j--;
	}
}

var Geometry = {};
	/**
	 * Determines whether the two line segments p1->p2 and p3->p4, given by
	 * p1=(x1, y1), p2=(x2,y2), p3=(x3,y3), p4=(x4,y4) intersect. Two line
	 * segments are regarded to be intersecting in case they share at least one
	 * common point, i.e if one of the two line segments starts or ends on the
	 * other line segment or the line segments are collinear and overlapping,
	 * then they are as well considered to be intersecting.
	 * 
	 * @param x1
	 *            x coordinate of starting point of line segment 1
	 * @param y1
	 *            y coordinate of starting point of line segment 1
	 * @param x2
	 *            x coordinate of ending point of line segment 1
	 * @param y2
	 *            y coordinate of ending point of line segment 1
	 * @param x3
	 *            x coordinate of the starting point of line segment 2
	 * @param y3
	 *            y coordinate of the starting point of line segment 2
	 * @param x4
	 *            x coordinate of the ending point of line segment 2
	 * @param y4
	 *            y coordinate of the ending point of line segment 2
	 * 
	 * @return <code>true</code> if the two line segments formed by the given
	 *         coordinates share at least one common point.
	 * 
	 * @since 3.1
	 */
	Geometry.linesIntersect = function(x1, y1, x2, y2,
			x3, y3, x4, y4) {

		// calculate bounding box of segment p1->p2
		var bb1_x = Math.min(x1, x2);
		var bb1_y = Math.min(y1, y2);
		var bb2_x = Math.max(x1, x2);
		var bb2_y = Math.max(y1, y2);

		// calculate bounding box of segment p3->p4
		var bb3_x = Math.min(x3, x4);
		var bb3_y = Math.min(y3, y4);
		var bb4_x = Math.max(x3, x4);
		var bb4_y = Math.max(y3, y4);

		// check if bounding boxes intersect
		if (!(bb2_x >= bb3_x && bb4_x >= bb1_x && bb2_y >= bb3_y && bb4_y >= bb1_y)) {
			// if bounding boxes do not intersect, line segments cannot
			// intersect either
			return false;
		}

		// If p3->p4 is inside the triangle p1-p2-p3, then check whether the
		// line p1->p2 crosses the line p3->p4.
		var p1p3_x = x1 - x3;
		var p1p3_y = y1 - y3;
		var p2p3_x = x2 - x3;
		var p2p3_y = y2 - y3;
		var p3p4_x = x3 - x4;
		var p3p4_y = y3 - y4;
		if (Geometry.productSign(Geometry.crossProduct(p2p3_x, p2p3_y, p3p4_x, p3p4_y),
				Geometry.crossProduct(p3p4_x, p3p4_y, p1p3_x, p1p3_y)) >= 0) {
			var p2p1_x = x2 - x1;
			var p2p1_y = y2 - y1;
			var p1p4_x = x1 - x4;
			var p1p4_y = y1 - y4;
			return Geometry.productSign(Geometry.crossProduct(-p1p3_x, -p1p3_y, p2p1_x, p2p1_y),
					Geometry.crossProduct(p2p1_x, p2p1_y, p1p4_x, p1p4_y)) <= 0;
		}
		return false;
	}

	Geometry.productSign = function(x, y) {
		if (x == 0 || y == 0) {
			return 0;
		} else if (x < 0 ^ y < 0) {
			return -1;
		}
		return 1;
	}

	Geometry.crossProduct = function(x1, y1, x2, y2) {
		return x1 * y2 - x2 * y1;
	}


function Point() {
	return {x: 0, y: 0};
}

function PointList() {
	var list = [], bounds = {};
	list.getPoint = function(destPoint, i) {
		var p = list[i];
		destPoint.x = p.x;
		destPoint.y = p.y;
		return p;
	};
  	list.removeAllPoints = function() {
		bounds = null;
		list.length = 0;
	};

	return list;
}

function ArrayList() {
	var list = [];
	list.contains = function(obj) {
		return list.indexOf(obj) != -1;
	}
	return list;
}

//-------------------------Segment

/**
 * A Segment representation for the ShortestPathRouting. A segment is a line between
 * two vertices.
 * 
 * This class is for internal use only
 * @author Whitney Sorenson
 * @since 3.0
 */
function Segment(start, end) {
	/**
	 * Creates a segment between the given start and end points.
	 * @param start the start vertex
	 * @param end the end vertex
	 */
	
	this.start = start;
	this.end = end;

	/**
	 * Returns the cosine of the made between this segment and the given segment
	 * @param otherSegment the other segment
	 * @return cosine value (not arc-cos)
	 */
	function cosine(otherSegment) {
		var cos = (((this.start.x - this.end.x) * (otherSegment.end.x - otherSegment.start.x))
				+ ((this.start.y - this.end.y) * (otherSegment.end.y - otherSegment.start.y)))
					/ (this.getLength() * otherSegment.getLength());
		var sin = (((this.start.x - this.end.x) * (otherSegment.end.y - otherSegment.start.y))
				- ((this.start.y - this.end.y) * (otherSegment.end.x - otherSegment.start.x)));
		if (sin < 0.0)
			return (1 + cos);
			
		return -(1 + cos);
	}

	/**
	 * Returns the cross product of this segment and the given segment
	 * @param otherSegment the other segment
	 * @return the cross product
	 */
	function crossProduct(otherSegment) {
		return (((this.start.x - this.end.x) * (otherSegment.end.y - this.end.y))
				- ((this.start.y - this.end.y) * (otherSegment.end.x - this.end.x)));
	}

	function getLength() {
		return (this.end.getDistance(this.start));
	}

	/**
	 * Returns a number that represents the sign of the slope of this segment. It does 
	 * not return the actual slope.
	 * @return number representing sign of the slope
	 */
	function getSlope() {
		if (this.end.x - this.start.x >= 0) 
			return (this.end.y - this.start.y);
		else 
			return -(this.end.y - this.start.y);
	}

	/**
	 * Returns true if the given segment intersects this segment.
	 * @param sx start x
	 * @param sy start y
	 * @param tx end x
	 * @param ty end y
	 * @return true if the segments intersect
	 */
	function intersects4(sx, sy, tx, ty) {
		var b1 = sy > ty ? ty : sy;
		var b2 = sy > ty ? sy : ty;
		var a1 = this.start.y > this.end.y ? this.end.y : this.start.y;
		var a2 = this.start.y > this.end.y ? this.start.y : this.end.y;
		if (b2 < a1 || a2 < b1)
			return false;

		var d1 = sx > tx ? tx : sx;
		var d2 = sx > tx ? sx : tx;
		var c1 = this.start.x > this.end.x ? this.end.x : this.start.x;
		var c2 = this.start.x > this.end.x ? this.start.x : this.end.x;
		if (d2 < c1 || c2 < d1) 
			return false;
		
		return Geometry.linesIntersect(this.start.x, this.start.y, this.end.x, this.end.y, sx, sy, tx, ty);
	}

	/**
	 * Return true if the segment represented by the points intersects this segment.
	 * @param s start point
	 * @param t end point
	 * @return true if the segments intersect
	 */
	function intersects2(s, t) {
		return this.intersects4(s.x, s.y, t.x, t.y);
	}

	/**
	 * @see java.lang.Object#toString()
	 */
	function toString() {
		return start + "---" + end;
	}

	this.intersects2 = intersects2;
	this.intersects4 = intersects4;
	this.crossProduct = crossProduct;
	this.getSlope = getSlope;
	this.cosine = cosine;
	this.getLength = getLength;

	return this;
}

//-------------------------Path

/**
 * A Path representation for the ShortestPathRouting. A Path has a start and end
 * point and may have bendpoints. The output of a path is accessed via the
 * method <code>getPoints()</code>.
 *
 * This class is for internal use only.
 *
 * @author Whitney Sorenson
 * @since 3.0
 */
function Path(a1, a2, a3) {

	/**
	 * A Stack of segments.
	 */
	function SegmentStack() {
		var stack = [];
		return {
			length: function() {
				return stack.length
			},
			pop: function() {
				return stack.pop();
			},
			popObstacle: function() {
				return stack.pop();
			},
			push: function(obj) {
				stack.push(obj);
			},
			top: function() {
				return stack[stack.length - 1];
			}
		}
	}

	var CURRENT = new Point();
	var EPSILON = 1.04;
	var NEXT = new Point();
	var OVAL_CONSTANT = 1.13;

	/**
	 * The bendpoint constraints. The path must go through these bendpoints.
	 */
	var bendpoints;	// PointList

	/**
	 * An arbitrary data field which can be used to map a Path back to some
	 * client object.
	 */
	var excludedObstacles = [];	// List
	var grownSegments = [];	// List
	/**
	 * this field is for internal use only. It is true whenever a property has
	 * been changed which requires the solver to resolve this path.
	 */
	this.isDirty = true;

	this.isInverted = false;
	this.isMarked = false;
	var points = new PointList();	// PointList

	/**
	 * The previous cost ratio of the path. The cost ratio is the actual path
	 * length divided by the length from the start to the end.
	 */
	var prevCostRatio;	// double
	var segments = [];	// List

	var stack = new SegmentStack();	// SegmentStack
	var subPath;	// Path
	var threshold;	// double
	var visibleObstacles = [];	// Set
	var visibleVertices = [];	// Set



	if (arguments.length == 1) {
		this.data = a1;
	} else if (arguments.length == 2) {
		if (a1.prototype === Vertex.prototype) {
			this.start = a1;
	    	this.end = a2;
		} else {
			this.start = new Vertex(a1, null);
			this.end = new Vertex(a2, null);
		}
	} else if (arguments.length == 3) {
    	this.data = a1;
		if (a2.prototype === Vertex.prototype) {
			this.start = a2;
			this.end = a3;
		} else {
			this.start = new Vertex(a2, null);
			this.end = new Vertex(a3, null);
		}
	}


	/**
	 * Attempts to add all segments between the given obstacles to the
	 * visibility graph.
	 *
	 * @param source
	 *            the source obstacle
	 * @param target
	 *            the target obstacle
	 */
	function addAllSegmentsBetween(source, target) {
		checkClass(source, Obstacle);
		checkClass(target, Obstacle);

		addConnectingSegment(new Segment(source.bottomLeft(), target.bottomLeft()),
				source, target, false, false);
		addConnectingSegment(
				new Segment(source.bottomRight(), target.bottomRight()), source,
				target, true, true);
		addConnectingSegment(new Segment(source.topLeft(), target.topLeft()),
				source, target, true, true);
		addConnectingSegment(new Segment(source.topRight(), target.topRight()),
				source, target, false, false);

		if (source.bottom() == target.bottom()) {
			addConnectingSegment(new Segment(source.bottomLeft(),
					target.bottomRight()), source, target, false, true);
			addConnectingSegment(new Segment(source.bottomRight(),
					target.bottomLeft()), source, target, true, false);
		}
		if (source.y == target.y) {
			addConnectingSegment(new Segment(source.topLeft(), target.topRight()),
					source, target, true, false);
			addConnectingSegment(new Segment(source.topRight(), target.topLeft()),
					source, target, false, true);
		}
		if (source.x == target.x) {
			addConnectingSegment(
					new Segment(source.bottomLeft(), target.topLeft()), source,
					target, false, true);
			addConnectingSegment(
					new Segment(source.topLeft(), target.bottomLeft()), source,
					target, true, false);
		}
		if (source.right() == target.right()) {
			addConnectingSegment(new Segment(source.bottomRight(),
					target.topRight()), source, target, true, false);
			addConnectingSegment(new Segment(source.topRight(),
					target.bottomRight()), source, target, false, true);
		}
	}

	/**
	 * Attempts to add a segment between the given obstacles to the visibility
	 * graph. This method is specifically written for the case where the two
	 * obstacles intersect and contains a boolean as to whether to check the
	 * diagonal that includes the top right point of the other obstacle.
	 *
	 * @param segment
	 *            the segment to check
	 * @param o1
	 *            the first obstacle
	 * @param o2
	 *            the second obstacle
	 * @param checktopRight()1
	 *            whether or not to check the diagonal containing top right
	 *            point
	 */
	function addConnectingSegment(segment, o1, o2, checktopRight1, checktopRight2) {
		checkClass(segment, Segment);
		checkClass(o1, Obstacle);
		checkClass(o2, Obstacle);

		if (threshold != 0
				&& (segment.end.getDistance(end)
						+ segment.end.getDistance(start) > threshold || segment.start
						.getDistance(end) + segment.start.getDistance(start) > threshold))
			return;

		if (o2.containsProper(segment.start) || o1.containsProper(segment.end))
			return;

		if (checktopRight1
				&& segment.intersects4(o1.x, o1.bottom() - 1, o1.right() - 1,
						o1.y))
			return;
		if (checktopRight2
				&& segment.intersects4(o2.x, o2.bottom() - 1, o2.right() - 1,
						o2.y))
			return;
		if (!checktopRight1
				&& segment.intersects4(o1.x, o1.y, o1.right() - 1,
						o1.bottom() - 1))
			return;
		if (!checktopRight2
				&& segment.intersects4(o2.x, o2.y, o2.right() - 1,
						o2.bottom() - 1))
			return;

		stack.push(o1);
		stack.push(o2);
		stack.push(segment);
	}

	/**
	 * Adds an obstacle to the visibility graph and generates new segments
	 *
	 * @param newObs
	 *            the new obstacle, should not be in the graph already
	 */
	function addObstacle(newObs) {
		checkClass(newObs, Obstacle);

		visibleObstacles.push(newObs);
		for (var i = 0; i < visibleObstacles.length; i++) {
			var currObs = visibleObstacles[i];
			if (newObs != currObs) {
				addSegmentsFor(newObs, currObs);
			}
		}
		addPerimiterSegments(newObs);
		addSegmentsFor(this.start, newObs);
		addSegmentsFor(this.end, newObs);
	}

	/**
	 * Adds the segments along the perimiter of an obstacle to the visiblity
	 * graph queue.
	 *
	 * @param obs
	 *            the obstacle
	 */
	function addPerimiterSegments(obs) {
		checkClass(obs, Obstacle);

		var seg = new Segment(obs.topLeft(), obs.topRight());
		stack.push(obs);
		stack.push(undefined);
		stack.push(seg);
		seg = new Segment(obs.topRight(), obs.bottomRight());
		stack.push(obs);
		stack.push(undefined);
		stack.push(seg);
		seg = new Segment(obs.bottomRight(), obs.bottomLeft());
		stack.push(obs);
		stack.push(undefined);
		stack.push(seg);
		seg = new Segment(obs.bottomLeft(), obs.topLeft());
		stack.push(obs);
		stack.push(undefined);
		stack.push(seg);
	}

	/**
	 * Attempts to add a segment to the visibility graph. First checks to see if
	 * the segment is outside the threshold oval. Then it compares the segment
	 * against all obstacles. If it is clean, the segment is finally added to
	 * the graph.
	 *
	 * @param segment
	 *            the segment
	 * @param exclude1
	 *            an obstacle to exclude from the search
	 * @param exclude2
	 *            another obstacle to exclude from the search
	 * @param allObstacles
	 *            the list of all obstacles
	 */
	function addSegment(segment, exclude1, exclude2, allObstacles) {
		checkClass(segment, Segment);
		exclude1 && checkClass(exclude1, Obstacle);
		exclude2 && checkClass(exclude2, Obstacle);
		// console.log('allObstacles', allObstacles);

		// console.log('addSegment(.start:',segment.start,', ');
		if (threshold != 0
			&& (segment.end.getDistance(this.end)
					+ segment.end.getDistance(this.start) > threshold || segment.start
					.getDistance(this.end) + segment.start.getDistance(this.start) > threshold)) {
			return;
		}

		for (var i = 0; i < allObstacles.length; i++) {
			var obs = allObstacles[i];
			checkClass(obs, Obstacle);

			if (obs == exclude1 || obs == exclude2 || obs.exclude) {
				continue;
			}
			if (segment.intersects4(obs.x, obs.y, obs.right() - 1, obs.bottom() - 1)
					|| segment.intersects4(obs.x, obs.bottom() - 1, obs.right() - 1, obs.y)
					|| obs.containsProper(segment.start)
					|| obs.containsProper(segment.end)) {
				if (!arrayContainsEqual(visibleObstacles, obs))
					this.addObstacle(obs);
				return;
			}
		}

		linkVertices(segment);
	}

	/**
	 * Adds the segments between the given obstacles.
	 *
	 * @param source
	 *            source obstacle
	 * @param target
	 *            target obstacle
	 */
	function addSegmentsFor(source, target) {
		checkClass(source, Obstacle);
		checkClass(target, Obstacle);

		if (source.intersects(target))
			addAllSegmentsBetween(source, target);
		else if (target.bottom() - 1 < source.y)
			addSegmentsTargetAboveSource(source, target);
		else if (source.bottom() - 1 < target.y)
			addSegmentsTargetAboveSource(target, source);
		else if (target.right() - 1 < source.x)
			addSegmentsTargetBesideSource(source, target);
		else
			addSegmentsTargetBesideSource(target, source);
	}

	/**
	 * Adds the segments between the given obstacles.
	 *
	 * @param source
	 *            source obstacle
	 * @param target
	 *            target obstacle
	 */
	function addSegmentsFor(vertex, obs) {
		checkClass(vertex, Vertex);
		checkClass(obs, Obstacle);

		var seg = undefined;
		var seg2 = undefined;

		switch (obs.getPosition(vertex)) {
		case PositionConstants.SOUTH_WEST:
		case PositionConstants.NORTH_EAST:
			seg = new Segment(vertex, obs.topLeft());
			seg2 = new Segment(vertex, obs.bottomRight());
			break;
		case PositionConstants.SOUTH_EAST:
		case PositionConstants.NORTH_WEST:
			seg = new Segment(vertex, obs.topRight());
			seg2 = new Segment(vertex, obs.bottomLeft());
			break;
		case PositionConstants.NORTH:
			seg = new Segment(vertex, obs.topLeft());
			seg2 = new Segment(vertex, obs.topRight());
			break;
		case PositionConstants.EAST:
			seg = new Segment(vertex, obs.bottomRight());
			seg2 = new Segment(vertex, obs.topRight());
			break;
		case PositionConstants.SOUTH:
			seg = new Segment(vertex, obs.bottomRight());
			seg2 = new Segment(vertex, obs.bottomLeft());
			break;
		case PositionConstants.WEST:
			seg = new Segment(vertex, obs.topLeft());
			seg2 = new Segment(vertex, obs.bottomLeft());
			break;
		default:
			if (vertex.x == obs.x) {
				seg = new Segment(vertex, obs.topLeft());
				seg2 = new Segment(vertex, obs.bottomLeft());
			} else if (vertex.y == obs.y) {
				seg = new Segment(vertex, obs.topLeft());
				seg2 = new Segment(vertex, obs.topRight());
			} else if (vertex.y == obs.bottom() - 1) {
				seg = new Segment(vertex, obs.bottomLeft());
				seg2 = new Segment(vertex, obs.bottomRight());
			} else if (vertex.x == obs.right() - 1) {
				seg = new Segment(vertex, obs.topRight());
				seg2 = new Segment(vertex, obs.bottomRight());
			} else {
				throw "Unexpected vertex conditions";
			}
		}

		stack.push(obs);
		stack.push(null);
		stack.push(seg);
		stack.push(obs);
		stack.push(null);
		stack.push(seg2);
	}

	// Obstacle source, Obstacle target
	function addSegmentsTargetAboveSource(source, target) {
		checkClass(source, Obstacle);
		checkClass(target, Obstacle);
		// target located above source
		var seg = undefined;
		var seg2 = undefined;
		if (target.x > source.x) {
			seg = new Segment(source.topLeft(), target.topLeft());
			if (target.x < source.right() - 1)
				seg2 = new Segment(source.topRight(), target.bottomLeft());
			else
				seg2 = new Segment(source.bottomRight(), target.topLeft());
		} else if (source.x == target.x) {
			seg = new Segment(source.topLeft(), target.bottomLeft());
			seg2 = new Segment(source.topRight(), target.bottomLeft());
		} else {
			seg = new Segment(source.bottomLeft(), target.bottomLeft());
			seg2 = new Segment(source.topRight(), target.bottomLeft());
		}

		stack.push(source);
		stack.push(target);
		stack.push(seg);
		stack.push(source);
		stack.push(target);
		stack.push(seg2);
		seg = undefined;
		seg2 = undefined;

		if (target.right() < source.right()) {
			seg = new Segment(source.topRight(), target.topRight());
			if (target.right() - 1 > source.x)
				seg2 = new Segment(source.topLeft(), target.bottomRight());
			else
				seg2 = new Segment(source.bottomLeft(), target.topRight());
		} else if (source.right() == target.right()) {
			seg = new Segment(source.topRight(), target.bottomRight());
			seg2 = new Segment(source.topLeft(), target.bottomRight());
		} else {
			seg = new Segment(source.bottomRight(), target.bottomRight());
			seg2 = new Segment(source.topLeft(), target.bottomRight());
		}

		stack.push(source);
		stack.push(target);
		stack.push(seg);
		stack.push(source);
		stack.push(target);
		stack.push(seg2);
	}

	// Obstacle source, Obstacle target
	function addSegmentsTargetBesideSource(source, target) {
		checkClass(source, Obstacle);
		checkClass(target, Obstacle);
		// target located above source
		var seg = undefined;
		var seg2 = undefined;
		if (target.y > source.y) {
			seg = new Segment(source.topLeft(), target.topLeft());
			if (target.y < source.bottom() - 1)
				seg2 = new Segment(source.bottomLeft(), target.topRight());
			else
				seg2 = new Segment(source.bottomRight(), target.topLeft());
		} else if (source.y == target.y) {
			// degenerate case
			seg = new Segment(source.topLeft(), target.topRight());
			seg2 = new Segment(source.bottomLeft(), target.topRight());
		} else {
			seg = new Segment(source.topRight(), target.topRight());
			seg2 = new Segment(source.bottomLeft(), target.topRight());
		}
		stack.push(source);
		stack.push(target);
		stack.push(seg);
		stack.push(source);
		stack.push(target);
		stack.push(seg2);
		seg = undefined;
		seg2 = undefined;

		if (target.bottom() < source.bottom()) {
			seg = new Segment(source.bottomLeft(), target.bottomLeft());
			if (target.bottom() - 1 > source.y)
				seg2 = new Segment(source.topLeft(), target.bottomRight());
			else
				seg2 = new Segment(source.topRight(), target.bottomLeft());
		} else if (source.bottom() == target.bottom()) {
			seg = new Segment(source.bottomLeft(), target.bottomRight());
			seg2 = new Segment(source.topLeft(), target.bottomRight());
		} else {
			seg = new Segment(source.bottomRight(), target.bottomRight());
			seg2 = new Segment(source.topLeft(), target.bottomRight());
		}
		stack.push(source);
		stack.push(target);
		stack.push(seg);
		stack.push(source);
		stack.push(target);
		stack.push(seg2);
	}

	/**
	 *
	 */
	function cleanup() {
		// segments.length = 0;
		visibleVertices.length = 0;
	}

	/**
	 * Begins the creation of the visibility graph with the first segment
	 *
	 * @param allObstacles
	 *            list of all obstacles
	 */
	function createVisibilityGraph(allObstacles) {
		checkObstacles(allObstacles);

		stack.push(null);
		stack.push(null);
		stack.push(new Segment(this.start, this.end));

		while (stack.length() != 0) {
			// console.log('cvg2',stack.length());
			this.addSegment(stack.pop(), stack.popObstacle(), stack.popObstacle(), allObstacles);
		}
	}

	/**
	 * Once the visibility graph is constructed, this is called to label the
	 * graph and determine the shortest path. Returns false if no path can be
	 * found.
	 *
	 * @return true if a path can be found.
	 */
	function determineShortestPath() {
		if (!this.labelGraph())
			return false;
		var vertex = this.end;
		prevCostRatio = this.end.cost / this.start.getDistance(this.end);

		var nextVertex;
		while (!vertex.equals(this.start)) {
			nextVertex = vertex.label;
			if (!nextVertex)
				return false;
			segments.push(new Segment(nextVertex, vertex));
			vertex = nextVertex;
		}

		arrayReverse(segments);
		return true;
	}

	/**
	 * Resets all necessary fields for a solve.
	 */
	function fullReset() {
		visibleVertices.length = 0;
		segments.length = 0;
		if (prevCostRatio == 0) {
			var distance = this.start.getDistance(this.end);
			threshold = distance * OVAL_CONSTANT;
		} else
			threshold = prevCostRatio * EPSILON * this.start.getDistance(this.end);
		visibleObstacles.length = 0;
		this.resetPartial();
	}

	/**
	 * Creates the visibility graph and returns whether or not a shortest path
	 * could be determined.
	 *
	 * @param allObstacles
	 *            the list of all obstacles
	 * @return true if a shortest path was found
	 */
	function generateShortestPath(allObstacles) {
		this.createVisibilityGraph(allObstacles);

		if (visibleVertices.length == 0)
			return false;

		return this.determineShortestPath();
	}

	/**
	 * Returns the list of constrained points through which this path must pass
	 * or <code>null</code>.
	 *
	 * @see #setBendPoints(PointList)
	 * @return list of bend points
	 */
	function getBendPoints() {
		return bendpoints;
	}

	/**
	 * Returns the end point for this path
	 *
	 * @return end point for this path
	 */
	function getEndPoint() {
		return this.end;
	}

	/**
	 * Returns the solution to this path.
	 *
	 * @return the points for this path.
	 */
	function getPoints() {
		return points;
	}

	/**
	 * Returns the start point for this path
	 *
	 * @return start point for this path
	 */
	function getStartPoint() {
		return this.start;
	}

	/**
	 * Returns a subpath for this path at the given segment
	 *
	 * @param currentSegment
	 *            the segment at which the subpath should be created
	 * @return the new path
	 */
	function getSubPath(currentSegment) {
		// ready new path
		var newPath = new Path(currentSegment.start, end);
		var currIndex = grownSegments.indexOf(currentSegment);
		newPath.grownSegments = grownSegments.slice(
				currIndex, grownSegments.length);

		// fix old path
		grownSegments = grownSegments.slice(0,
				grownSegments.indexOf(currentSegment) + 1);
		end = currentSegment.end;

		subPath = newPath;
		return newPath;
	}

	/**
	 * Resets the vertices that this path has traveled prior to this segment.
	 * This is called when the path has become inverted and needs to rectify any
	 * labeling mistakes it made before it knew it was inverted.
	 *
	 * @param currentSegment
	 *            the segment at which the path found it was inverted
	 */
	function invertPriorVertices(currentSegment) {
		var stop = grownSegments.indexOf(currentSegment);
		for (var i = 0; i < stop; i++) {
			vertex = grownSegments[i].end;
			if (vertex.type == Vertex.INNIE)
				vertex.type = Vertex.OUTIE;
			else
				vertex.type = Vertex.INNIE;
		}
	}

	/**
	 * Returns true if this obstacle is in the visibility graph
	 *
	 * @param obs
	 *            the obstacle
	 * @return true if obstacle is in the visibility graph
	 */
	function isObstacleVisible(obs) {
		return visibleObstacles.contains(obs);
	}

	/**
	 * Labels the visibility graph to assist in finding the shortest path
	 *
	 * @return false if there was a gap in the visibility graph
	 */
	function labelGraph() {
		var numPermanentNodes = 1;
		var vertex = this.start;
		var neighborVertex = undefined;
		vertex.isPermanent = true;
		var newCost;
		while (numPermanentNodes != visibleVertices.length) {
			var neighbors = vertex.neighbors;
			if (!neighbors)
				return false;
			// label neighbors if they have a new shortest path
			for (var i = 0; i < neighbors.length; i++) {
				neighborVertex = neighbors[i];
				if (!neighborVertex.isPermanent) {
					newCost = vertex.cost + vertex.getDistance(neighborVertex);
					if (neighborVertex.label == null) {
						neighborVertex.label = vertex;
						neighborVertex.cost = newCost;
					} else if (neighborVertex.cost > newCost) {
						neighborVertex.label = vertex;
						neighborVertex.cost = newCost;
					}
				}
			}
			// find the next none-permanent, labeled vertex with smallest cost
			var smallestCost = 0;
			var tempVertex = undefined;
			for (var vi = 0; vi < visibleVertices.length; vi++) {
				tempVertex = visibleVertices[vi];
				if (!tempVertex.isPermanent
						&& tempVertex.label
						&& (tempVertex.cost < smallestCost || smallestCost == 0)) {
					smallestCost = tempVertex.cost;
					vertex = tempVertex;
				}
			}
			// set the new vertex to permanent.
			vertex.isPermanent = true;
			numPermanentNodes++;
		}
		return true;
	}

	/**
	 * Links two vertices together in the visibility graph
	 *
	 * @param segment
	 *            the segment to add
	 */
	function linkVertices(segment) {
		if (segment.start.neighbors == null)
			segment.start.neighbors = [];
		if (segment.end.neighbors == null)
			segment.end.neighbors = [];

		if (!arrayContainsEqual(segment.start.neighbors, segment.end)) {
			segment.start.neighbors.push(segment.end);
			segment.end.neighbors.push(segment.start);
		}

		visibleVertices.push(segment.start);
		visibleVertices.push(segment.end);
	}

	/**
	 * Called to reconnect a subpath back onto this path. Does a depth-first
	 * search to reconnect all paths. Should be called after sorting.
	 */
	function reconnectSubPaths() {
		if (subPath) {
			subPath.reconnectSubPaths();

			var changedSegment = subPath.grownSegments.remove(0);
			var oldSegment = grownSegments.get(grownSegments
					.length - 1);

			oldSegment.end = changedSegment.end;
			grownSegments.addAll(subPath.grownSegments);

			subPath.points.removePoint(0);
			this.points.removePoint(points.length - 1);
			this.points.addAll(subPath.points);

			visibleObstacles.addAll(subPath.visibleObstacles);

			this.end = subPath.end;
			subPath = undefined;
		}
	}

	/**
	 * Refreshes the exclude field on the obstacles in the list. Excludes all
	 * obstacles that contain the start or end point for this path.
	 *
	 * @param allObstacles
	 *            list of all obstacles
	 */
	function refreshExcludedObstacles(allObstacles) {
		excludedObstacles.length = 0;

		for (var i = 0; i < allObstacles.length; i++) {
			var o = allObstacles[i];
			o.exclude = false;

			if (o.contains(this.start)) {
				if (o.containsProper(this.start))
					o.exclude = true;
				else {
					/*
					 * $TODO Check for corners. If the path begins exactly at
					 * the corner of an obstacle, the exclude should also be
					 * true.
					 *
					 * Or, change segment intersection so that two segments that
					 * share an endpoint do not intersect.
					 */
				}
			}

			if (o.contains(this.end)) {
				if (o.containsProper(this.end))
					o.exclude = true;
				else {
					// check for corners. See above statement.
				}
			}

			if (o.exclude && !excludedObstacles.contains(o))
				excludedObstacles.push(o);
		}
	}

	/**
	 * Resets the fields for everything in the solve after the visibility graph
	 * steps.
	 */
	function resetPartial() {
		this.isMarked = false;
		this.isInverted = false;
		subPath = undefined;
		this.isDirty = false;
		grownSegments.length = 0;
		points.removeAllPoints();
	}

	/**
	 * Sets the list of bend points to the given list and dirties the path.
	 *
	 * @param bendPoints
	 *            the list of bend points
	 */
	function setBendPoints(bendPoints) {
		this.bendpoints = bendPoints;
		this.isDirty = true;
	}

	/**
	 * Sets the end point for this path to the given point.
	 *
	 * @param end
	 *            the new end point for this path
	 */
	function setEndPoint(end) {
					if (!end.getDistance) throw 'new Path(no vertex!, ) '

		if (end.equals(this.end))
			return;
		this.end = new Vertex(end, undefined);
		this.isDirty = true;
	}

	/**
	 * Sets the start point for this path to the given point.
	 *
	 * @param start
	 *            the new start point for this path
	 */
	function setStartPoint(start) {
					if (!start.getDistance) throw 'new Path(no vertex!, ) '

		if (start.equals(this.start))
			return;
		this.start = new Vertex(start, unedfined);
		this.isDirty = true;
	}

	/**
	 * Returns <code>true</code> if the path is clean and intersects the given
	 * obstacle. Also dirties the path in the process.
	 *
	 * @since 3.0
	 * @param obs
	 *            the obstacle
	 * @return <code>true</code> if a clean path touches the obstacle
	 */
	function testAndSet(obs) {
		if (this.isDirty)
			return false;
		// This will never actually happen because obstacles are not stored by
		// identity
		if (excludedObstacles.contains(obs))
			return false;

		var seg1 = new Segment(obs.topLeft(), obs.bottomRight());
		var seg2 = new Segment(obs.topRight(), obs.bottomLeft());

		for (var s = 0; s < points.length - 1; s++) {
			points.getPoint(CURRENT, s);
			points.getPoint(NEXT, s + 1);

			if (seg1.intersects2(CURRENT, NEXT)
					|| seg2.intersects2(CURRENT, NEXT) || obs.contains(CURRENT)
					|| obs.contains(NEXT)) {
				this.isDirty = true;
				return true;
			}
		}
		return false;
	}

	this.refreshExcludedObstacles = refreshExcludedObstacles;
    this.resetPartial = resetPartial;
    this.segments = segments;
    this.grownSegments = grownSegments;
    this.points = points;
    this.reconnectSubPaths = reconnectSubPaths;
    this.cleanup = cleanup;
    this.testAndSet = testAndSet;
    this.getBendPoints = getBendPoints;
    this.getEndPoint = getEndPoint;
    this.getStartPoint = getStartPoint;
    this.getPoints = getPoints;
    this.fullReset = fullReset;
    this.generateShortestPath = generateShortestPath;
    this.createVisibilityGraph = createVisibilityGraph;
    this.addSegment = addSegment;
    this.addObstacle = addObstacle;
    this.determineShortestPath = determineShortestPath;
    this.labelGraph = labelGraph;

	return this;
}

//-------------------------Vertex

/**
 * A vertex representation for the ShortestPathRouting. Vertices are either one of
 * four corners on an <code>Obstacle</code>(Rectangle), or one of the two end points of a
 * <code>Path</code>.
 *
 * This class is not intended to be subclassed.
 * @author Whitney Sorenson
 * @since 3.0
 */
function Vertex(a1, a2, a3) {

	// constants for the vertex type
	var NOT_SET = 0 // int
	var INNIE = 1 // int
	var OUTIE = 2 // int

	// for shortest path
	var neighbors // List
	var isPermanent = false;
	var label // Vertex
	var cost = 0 // double
	var spacing = 0 // int
	// for routing
	var nearestObstacle = 0 // int
	var offset = 0 // double
	var type = NOT_SET; // int
	var count = 0 // int
	var totalCount = 0 // int
	var obs // Obstacle
	var paths // List
	var nearestObstacleChecked = false;
	var cachedCosines // Map
	var positionOnObstacle = -1;  // int

	var origX, origY; // int

	this.fullReset = fullReset;
	this.addPath = addPath;
	this.cachedCosines = function() {return cachedCosines};
	this.bend = bend;

	if (arguments.length == 3) {
	// new Vertex(x, y, obstacle)
	this.x = a1;
	this.y = a2;
	origX = a1;
	origY = a2;
	this.obs = a3;
	if (obs) {
	  spacing = 4;
	}
	} else {
	// new Vertex(point, obstacle)
	this.x = a1.x;
	this.y = a1.y;
	origX = a1.x;
	origY = a1.y;
	this.obs = a2;
	if (obs) {
	  spacing = 4;
	}
	}

	/**
	* Adds a path to this vertex, calculates angle between two segments and caches it.
	*
	* @param path the path
	* @param start the segment to this vertex
	* @param end the segment away from this vertex
	*/
	function addPath(path, start, end) {
		if (!paths) {
			paths = [];
			cachedCosines = {};
		}
		if (!arrayContainsEqual(paths, path))
			paths.push(path);
		cachedCosines[path] = start.cosine(end); // Double
	}

	/**
	* Creates a point that represents this vertex offset by the given amount times
	* the offset.
	*
	* @param modifier the offset
	* @return a Point that has been bent around this vertex
	*/
	function bend(modifier) { // Point
		var point = {x: this.x, y: this.y};
		if ((positionOnObstacle & PositionConstants.NORTH) > 0)
			point.y -= modifier * offset;
		else
			point.y += modifier * offset;
		if ((positionOnObstacle & PositionConstants.EAST) > 0)
			point.x += modifier * offset;
		else
			point.x -= modifier * offset;
		return point;
	}

	/**
	* Resets all fields on this Vertex.
	*/
	function fullReset() {
		totalCount = 0;
		type = NOT_SET;
		count = 0;
		cost = 0;
	//	offset = getSpacing();
		offset = spacing;
		nearestObstacle = 0;
		label = undefined;
		nearestObstacleChecked = false;
		isPermanent = false;
		neighbors = undefined;
	//	if (neighbors != null)
	//		neighbors.length = 0;
		cachedCosines = undefined;
	//	if (cachedCosines != null)
	//		cachedCosines.length = 0;
		paths = undefined;
	//	if (paths != null)
	//		paths.length = 0;
	}

	/**
	* Returns a Rectangle that represents the region around this vertex that
	* paths will be traveling in.
	*
	* @param extraOffset a buffer to add to the region.
	* @return the rectangle
	*/
	function getDeformedRectangle(extraOffset) {  // Rectangle
		rect = {x: 0, y: 0, width: 0, height: 0};

		if ((positionOnObstacle & PositionConstants.NORTH) > 0) {
			rect.y = y - extraOffset;
			rect.height = origY - y + extraOffset;
		} else {
			rect.y = origY;
			rect.height = y - origY + extraOffset;
		}
		if ((positionOnObstacle & PositionConstants.EAST) > 0) {
			rect.x = origX;
			rect.width = x - origX + extraOffset;
		} else {
			rect.x = x - extraOffset;
			rect.width = origX - x + extraOffset;
		}

		return rect;
	}
	/*
	private int getSpacing() {
		if (obs == null)
			return 0;
		return obs.getSpacing();
	}
	*/
	/**
	* Grows this vertex by its offset to its maximum size.
	*/
	function grow() {
		var modifier // int

		if (nearestObstacle == 0) {
	//		modifier = totalCount * getSpacing();
			modifier = totalCount * spacing;
		} else {
			modifier = (nearestObstacle / 2) - 1;
	}
		if ((positionOnObstacle & PositionConstants.NORTH) > 0) {
			this.y -= modifier;
		} else {
	  this.y += modifier;
		}

	if ((positionOnObstacle & PositionConstants.EAST) > 0) {
	  this.x += modifier;
		} else {
	  this.x -= modifier
	}
	}

	/**
	* Shrinks this vertex to its original size.
	*/
	function shrink() {
		this.x = this.origX;
	this.y = this.origY;
	}

	/**
	* Updates the offset of this vertex based on its shortest distance.
	*/
	function updateOffset() {
		if (nearestObstacle != 0) {
			offset = ((nearestObstacle / 2) - 1) / totalCount;
		}
	}

	this.getDistance = function(vertex) {
		var dx = this.x - vertex.x;
		var dy = this.y - vertex.y;
		return Math.sqrt(dx * dx + dy * dy);
	}

	this.equals = function(v) {
		return this.x === v.x && this.y === v.y;
	}
	
  	return this;
}

//-------------------------Obstacle

/**
 * An obstacle representation for the ShortestPathRouting. This is a subclass of Rectangle.
 *
 * This class is for internal use only.
 * @author Whitney Sorenson
 * @since 3.0
 */
/**
 * Creates a new obstacle from the given rectangle bounds.
 * @param rect the bounds
 */
function Obstacle(rect, router) {
	var exclude;
	var topLeft, topRight, bottomLeft, bottomRight, center; // Vertex

	this.topLeft = function() {return topLeft};
	this.topRight = function() {return topRight};
	this.bottomLeft = function() {return bottomLeft};
	this.bottomRight = function() {return bottomRight};
	this.center = function() {return center};
	this.right = function() {return topRight.x};
	this.bottom = function() {return bottomLeft.y};

		/**
		 * <P>
		 * Returns an integer which represents the position of the given point with
		 * respect to this rectangle. Possible return values are bitwise ORs of the
		 * constants WEST, EAST, NORTH, and SOUTH as found in
		 * {@link org.eclipse.draw2d.PositionConstants}.
		 * 
		 * <P>
		 * Returns PositionConstant.NONE if the given point is inside this
		 * Rectangle.
		 * 
		 * @param p
		 *            The Point whose position has to be determined
		 * @return An <code>int</code> which is a PositionConstant
		 * @see org.eclipse.draw2d.PositionConstants
		 * @since 2.0
		 */
	this.getPosition = function(p) {
		var result = PositionConstants.NONE;

		if (this.contains(p))
			return result;

		if (p.x < this.x)
			result = PositionConstants.WEST;
		else if (p.x >= (this.x + this.width))
			result = PositionConstants.EAST;

		if (p.y < this.y)
			result = result | PositionConstants.NORTH;
		else if (p.y >= (this.y + this.height))
			result = result | PositionConstants.SOUTH;

		return result;
	};


	this.equals = function(o) {
		return this.x === o.x
			&& this.y === o.y
			&& this.width === o.width
			&& this.height === o.height;
	};

	    /**
	     * Returns <code>true</code> if the given point is contained but not on the boundary of
	     * this obstacle.
	     * @param p a point
	     * @return <code>true</code> if properly contained
	     */
    this.containsProper = function(p) {
    	return p.x > this.x
    		&& p.x < this.x + this.width - 1
    		&& p.y > this.y
    		&& p.y < this.y + this.height - 1;
    },

    /**
     * Returns whether the given coordinates are within the boundaries of this
     * Rectangle. The boundaries are inclusive of the top and left edges, but
     * exclusive of the bottom and right edges.
     *
     * @param x
     *            X value
     * @param y
     *            Y value
     * @return true if the coordinates are within this Rectangle
     * @since 2.0
     */
    this.containsXY = function(x, y) {
      return y >= this.y && y < this.y + this.height
          && x >= this.x && x < this.x + this.width;
    },

    /**
     * Returns whether the given point is within the boundaries of this
     * Rectangle. The boundaries are inclusive of the top and left edges, but
     * exclusive of the bottom and right edges.
     *
     * @param p
     *            Point being tested for containment
     * @return true if the Point is within this Rectangle
     * @since 2.0
     */
    this.contains = function(p) {
      return this.containsXY(p.x, p.y);
    },

    this.getSpacing = function() {
    	return router.getSpacing();
    },
    /**
     * Grows all vertices on this obstacle.
     */
    this.growVertices = function() {
    	growVertex(topLeft);
    	growVertex(topRight);
    	growVertex(bottomLeft);
    	growVertex(bottomRight);
    },
    /**
     * Requests a full reset on all four vertices of this obstacle.
     */
    this.reset = function() {
    	topLeft.fullReset();
    	bottomLeft.fullReset();
    	bottomRight.fullReset();
    	topRight.fullReset();
    },
    /**
     * Shrinks all four vertices of this obstacle.
     */
    this.shrinkVertices = function() {
    	shrinkVertex(topLeft);
    	shrinkVertex(topRight);
    	shrinkVertex(bottomLeft);
    	shrinkVertex(bottomRight);
    }

	this.router = router;
	this.x = rect.x;
	this.y = rect.y;
	this.width = rect.width;
	this.height = rect.height;

	topLeft = new Vertex(this.x, this.y, this);
	topLeft.positionOnObstacle = PositionConstants.NORTH_WEST;
	topRight = new Vertex(this.x + this.width - 1, this.y, this);
	topRight.positionOnObstacle = PositionConstants.NORTH_EAST;
	bottomLeft = new Vertex(this.x, this.y + this.height - 1, this);
	bottomLeft.positionOnObstacle = PositionConstants.SOUTH_WEST;
	bottomRight = new Vertex(this.x + this.width - 1, this.y + this.height - 1, this);
	bottomRight.positionOnObstacle = PositionConstants.SOUTH_EAST;
	center = new Vertex(this.x + this.width / 2, this.y + this.height / 2, this);

	exclude = false;

	function growVertex(vertex) {
		if (vertex.totalCount > 0)
			vertex.grow();
	}

	function shrinkVertex(vertex) {
		if (vertex.totalCount > 0)
			vertex.shrink();
	}
	return this;
}

//-------------------------ShortestPathRouter

/**
 * @ngdoc service
 * @name fomodApp.ShortestPathRouter
 * @description
 * # ShortestPathRouter
 * Service in the fomodApp.
 */
function ShortestPathRouter() {
    var NUM_GROW_PASSES = 2;
    var spacing = 4;

    var growPassChangedObstacles;	// boolean
    var orderedPaths;	// List
    var pathsToChildPaths = {};	// Map

    var stack;	// PathStack
    var subPaths;	// List

    var userObstacles = [];	// List
    var userPaths = [];	// List
    var workingPaths = [];	// List

    function addObstacle(rect) {
      return internalAddObstacle(new Obstacle(rect, this));
    }

    function addPath(path) {
    	userPaths.push(path);
    	workingPaths.push(path);
    }

    /**
     * Fills the point lists of the Paths to the correct bent points.
     */	
    function bendPaths() {
    	for (var i = 0; i < orderedPaths.length; i++) {
    		var path = orderedPaths[i];
    		var segment = undefined;
    		path.points.push([path.start.x, path.start.y]);
    		for (var v = 0; v < path.grownSegments.length; v++) {
    			segment = path.grownSegments[v];
    			var vertex = segment.end;

    			if (vertex && v < path.grownSegments.length - 1) {
    				if (vertex.type == Vertex.INNIE) {
    					vertex.count++;
    					path.points.push(vertex.bend(vertex.count));
    				} else {
    					path.points.apush(vertex.bend(vertex.totalCount));
    					vertex.totalCount--;
    				}
    			}
    		}
    		path.points.push([path.end.x, path.end.y]);
    	}
    }

    /**
     * Checks a vertex to see if its offset should shrink
     * @param vertex the vertex to check
     */
    function checkVertexForIntersections(vertex) {
    	if (vertex.nearestObstacle != 0 || vertex.nearestObstacleChecked)
    		return;
    	var sideLength, x, y; // int

    	sideLength = 2 * (vertex.totalCount * getSpacing()) + 1;

    	if ((vertex.positionOnObstacle & PositionConstants.NORTH) > 0)
    		y = vertex.y - sideLength;
    	else
    		y = vertex.y;
    	if ((vertex.positionOnObstacle & PositionConstants.EAST) > 0)
    		x = vertex.x;
    	else
    		x = vertex.x - sideLength;

    	r = new Rectangle(x, y, sideLength, sideLength);

    	var xDist, yDist;  // int

    	for (var o = 0; o < userObstacles.length; o++) {
    		obs = userObstacles[o]; // Obstacle
    		if (obs != vertex.obs && r.intersects(obs)) {
    			var pos = obs.getPosition(vertex); // int
    			if (pos == 0)
    				continue;

    			if ((pos & PositionConstants.NORTH) > 0)
    				//	 use top
    				yDist = obs.y - vertex.y;
    			else
    				// use bottom
    				yDist = vertex.y - obs.bottom() + 1;
    			if ((pos & PositionConstants.EAST) > 0)
    				//	 use right
    				xDist = vertex.x - obs.right() + 1;
    			else
    				//	 use left
    				xDist = obs.x - vertex.x;

    			if (Math.max(xDist, yDist) < vertex.nearestObstacle
    					|| vertex.nearestObstacle == 0) {
    				vertex.nearestObstacle = Math.max(xDist, yDist);
    				vertex.updateOffset();
    			}

    		}
    	}

    	vertex.nearestObstacleChecked = true;
    }

    /**
     * Checks all vertices along paths for intersections
     */
    function checkVertexIntersections() {
    	for (var i = 0; i < workingPaths.length; i++) {
    		var path = workingPaths[i];  // Path

    		for (var s = 0; s < path.segments.length - 1; s++) {
    			var vertex = path.segments[s].end;
    			checkVertexForIntersections(vertex);
    		}
    	}
    }

    /**
     * Frees up fields which aren't needed between invocations.
     */
    function cleanup() {
    	for (var i = 0; i < workingPaths.length; i++) {
    		var path = workingPaths[i];
    		path.cleanup();
    	}
    }

    /**
     * Counts how many paths are on given vertices in order to increment their total count.
     */
    function countVertices() {
    	for (var i = 0; i < workingPaths.length; i++) {
    		var path =  workingPaths[i];   // Path
    		for (var v = 0; v < path.segments.length - 1; v++)
    			path.segments[v].end.totalCount++;
    	}
    }

    /**
     * Dirties the paths that are on the given vertex
     * @param vertex the vertex that has the paths
     */
    function dirtyPathsOn(vertex) {
    	var paths = vertex.paths;
    	if (paths != null && paths.length != 0) {
    		for (var i = 0; i < paths.length; i++)
    			paths[i].isDirty = true;
    		return true;
    	}
    	return false;
    }

    /**
     * Resyncs the parent paths with any new child paths that are necessary because bendpoints
     * have been added to the parent path.
     *
    function generateChildPaths() {
    	for (var i = 0; i < userPaths.length; i++) {
    		var path = userPaths[i];   // Path
    		PointList bendPoints = path.bendpoints;
    		if (bendPoints != null && bendPoints.size() != 0) {
    			List childPaths = new ArrayList(bendPoints.size() + 1);
    			Path child = null;
    			Vertex prevVertex = path.start;
    			Vertex currVertex = null;

    			for (var b = 0; b < bendPoints.length; b++) {
    				var bp = bendPoints.getPoint(b);   // Point
    				currVertex = new Vertex(bp, null);
    				child = new Path(prevVertex, currVertex);
    				childPaths.add(child);
    				workingPaths.add(child);
    				prevVertex = currVertex;
    			}

    			child = new Path(prevVertex, path.end);
    			childPaths.add(child);
    			workingPaths.add(child);
    			pathsToChildPaths.put(path, childPaths);
    		} else
    			workingPaths.add(path);
    	} //End FOR
    }*/

    /**
     * Returns the closest vertex to the given segment.
     * @param v1 the first vertex
     * @param v2 the second vertex
     * @param segment the segment
     * @return v1, or v2 whichever is closest to the segment
     */
    function getNearestVertex(v1, v2, segment) {
    	if (segment.start.getDistance(v1) + segment.end.getDistance(v1)
    			> segment.start.getDistance(v2) + segment.end.getDistance(v2))
    		return v2;
    	else
    		return v1;
    }

    /**
     * Returns the spacing maintained between paths.
     * @return the default path spacing
     * @see #setSpacing(int)
     * @since 3.2
     */
    function getSpacing() {
    	return spacing;
    }

    /**
     * Returns the subpath for a split on the given path at the given segment.
     * @param path the path
     * @param segment the segment
     * @return the new subpath
     */
    function getSubpathForSplit(path, segment) {
    	newPath = path.getSubPath(segment);
    	workingPaths.push(newPath);
    	subPaths.push(newPath);
    	return newPath;
    }

    /**
     * Grows all obstacles in in routing and tests for new intersections
     */
    function growObstacles() {
    	growPassChangedObstacles = false;
    	for (var i = 0; i < NUM_GROW_PASSES; i++) {
    		if (i == 0 || growPassChangedObstacles)
    			growObstaclesPass();
    	}
    }

    /**
     * Performs a single pass of the grow obstacles step, this can be repeated as desired.
     * Grows obstacles, then tests paths against the grown obstacles.
     */
    function growObstaclesPass() {
    	// grow obstacles
    	for (var i = 0; i < userObstacles.length; i++)
    		userObstacles[i].growVertices();

    	// go through paths and test segments
    	for (var i = 0; i < workingPaths.length; i++) {
    		var path =  workingPaths[i];   // Path

    		for (var e in path.excludedObstacles)
    			path.excludedObstacles[e].exclude = true;

    		if (path.grownSegments.length == 0) {
    			for (var s in path.segments)
    				testOffsetSegmentForIntersections(path.segments[s], -1, path);
    		} else {
    			var counter = 0;
    			var currentSegments = path.grownSegments.slice();
    			for (var s = 0; s < currentSegments.length; s++)
    				counter += testOffsetSegmentForIntersections(currentSegments[s], s + counter, path);
    		}

    		for (var e in path.excludedObstacles)
    			path.excludedObstacles[e].exclude = false;

    	}

    	// revert obstacles
    	for (var i = 0; i < userObstacles.length; i++)
    		userObstacles[i].shrinkVertices();
    }

    /**
     * Adds an obstacle to the routing
     * @param obs the obstacle
     */
    function internalAddObstacle(obs) {
    	checkClass(obs, Obstacle);
    	userObstacles.push(obs);
    	return testAndDirtyPaths(obs);
    }

    /**
     * Removes an obstacle from the routing.
     * @param rect the bounds of the obstacle
     * @return the obstacle removed
     */
    function internalRemoveObstacle(rect) {
    	var obs;
    	var index = -1;
    	for (var i = 0; i < userObstacles.length; i++) {
    		obs = userObstacles[i];
    		if (obs.equals(rect)) {
    			index = i;
    			break;
    		}
    	}

    	userObstacles.splice(index, 1);

    	result = false;
    	result |= dirtyPathsOn(obs.bottomLeft);
    	result |= dirtyPathsOn(obs.topLeft());
    	result |= dirtyPathsOn(obs.bottomRight());
    	result |= dirtyPathsOn(obs.topRight());

    	for (var p = 0; p < workingPaths.length; p++) {
    		var path = workingPaths[p];   // Path
    		if (path.isDirty)
    			continue;
    		if (path.isObstacleVisible(obs))
    			path.isDirty = result = true;
    	}

    	return result;
    }

    /**
     * Labels the given path's vertices as innies, or outies, as well as determining if this
     * path is inverted.
     * @param path the path
     */
    function labelPath(path) {
    	var segment, nextSegment, vertex;
    	var agree = false;
    	for (var v = 0; v < path.grownSegments.length - 1; v++) {
    		segment = path.grownSegments[v];
    		nextSegment = path.grownSegments[v + 1];
    		vertex = segment.end;
    		var crossProduct = segment.crossProduct(new Segment(vertex, vertex.obs.center()));

    		if (vertex.type == Vertex.NOT_SET) {
    			labelVertex(segment, crossProduct, path);
    		} else if (!path.isInverted
    				&& ((crossProduct > 0 && vertex.type == Vertex.OUTIE)
    						|| (crossProduct < 0 && vertex.type == Vertex.INNIE))) {
    			if (agree) {
    				// split detected.
    				stack.push(getSubpathForSplit(path, segment));
    				return;
    			} else {
    				path.isInverted = true;
    				path.invertPriorVertices(segment);
    			}
    		} else if (path.isInverted
    				&& ((crossProduct < 0 && vertex.type == Vertex.OUTIE)
    						|| (crossProduct > 0 && vertex.type == Vertex.INNIE))) {
    			// split detected.
    			stack.push(getSubpathForSplit(path, segment));
    			return;
    		} else
    			agree = true;

    		if (vertex.paths != null) {
    			for (var i in vertex.paths) {
    				var nextPath = vertex.paths[i];   // Path
    				if (!nextPath.isMarked) {
    					nextPath.isMarked = true;
    					stack.push(nextPath);
    				}
    			}
    		}

    		vertex.addPath(path, segment, nextSegment);
    	}
    }

    /**
     * Labels all path's vertices in the routing.
     */
    function labelPaths() {
    	var path;
    	for (var i = 0; i < workingPaths.length; i++) {
    		path = workingPaths[i];
    		stack.push(path);
    	}

    	while (stack.length != 0) {
    		path = stack.pop();
    		if (!path.isMarked) {
    			path.isMarked = true;
    			labelPath(path);
    		}
    	}

    	// revert is marked so we can use it again in ordering.
    	for (var i = 0; i < workingPaths.length; i++) {
    		path = workingPaths[i];
    		path.isMarked = false;
    	}
    }

    /**
     * Labels the vertex at the end of the semgent based on the cross product.
     * @param segment the segment to this vertex
     * @param crossProduct the cross product of this segment and a segment to the obstacles center
     * @param path the path
     */
    function labelVertex(segment, crossProduct, path) {
    //	 assumes vertex in question is segment.end
    	if (crossProduct > 0) {
    		if (path.isInverted)
    			segment.end.type = Vertex.OUTIE;
    		else
    			segment.end.type = Vertex.INNIE;
    	} else if (crossProduct < 0) {
    		if (path.isInverted)
    			segment.end.type = Vertex.INNIE;
    		else
    			segment.end.type = Vertex.OUTIE;
    	} else if (segment.start.type != Vertex.NOT_SET)
    		segment.end.type = segment.start.type;
    	else
    		segment.end.type = Vertex.INNIE;
    }

    /**
     * Orders the path by comparing its angle at shared vertices with other paths.
     * @param path the path
     */
    function orderPath(path) {
    	if (path.isMarked)
    		return;
    	path.isMarked = true;
    	var segment, vertex;
    	for (var v = 0; v < path.grownSegments.length - 1; v++) {
    		segment = path.grownSegments[v];
    		vertex = segment.end;
    		var thisAngle = vertex.cachedCosines()[path]; // double
    		if (path.isInverted)
    			thisAngle = -thisAngle;

    		for (var i in vertex.paths) {
    			var vPath = vertex.paths[i];   // Path
    			if (!vPath.isMarked) {
    				otherAngle = vertex.cachedCosines()[vPath];  // double

    				if (vPath.isInverted)
    					otherAngle = -otherAngle;

    				if (otherAngle < thisAngle)
    					orderPath(vPath);
    			}
    		}
    	}

    	orderedPaths.push(path);
    }

    /**
     * Orders all paths in the graph.
     */
    function orderPaths() {
    	for (var i = 0; i < workingPaths.length; i++) {
    		var path = workingPaths[i];   // Path
    		orderPath(path);
    	}
    }

    /**
     * Populates the parent paths with all the child paths that were created to represent
     * bendpoints.
     */
    function recombineChildrenPaths() {
    	// only populate those paths with children paths.
    	for (path in pathsToChildPaths) {
    		path.fullReset();

    		var childPaths = pathsToChildPaths[path];   // List
    		var childPath;

    		for (var i = 0; i < childPaths.length; i++) {
    			childPath = childPaths[i];
    			path.points.push.apply(path.points, childPath.getPoints());
    			// path will overlap
    			path.points.splice(path.points.length - 1, 1);
    			//path.grownSegments.addAll(childPath.grownSegments);
    			path.segments.push.apply(path.segments, childPath.segments);
    			path.visibleObstacles.push.apply(path.visibleObstacles, childPath.visibleObstacles);
    		}

    		// add last point.
    		path.points.push(childPath.points.getLastPoint());
    	}
    }

    /**
     * Reconnects all subpaths.
     */
    function recombineSubpaths() {
    	for (var p = 0; p < orderedPaths.length; p++) {
    		var path = orderedPaths[p];   // Path
    		path.reconnectSubPaths();
    	}

    	removeAll(orderedPaths, subPaths);
    	removeAll(workingPaths, subPaths);
    	subPaths = null;
    }

    // removes all elements of a that is in ar
    function removeAll (a, ar) {
    	for (var i in ar) {
    		var j = a.indexOf(ar[i]);
    		if (j !== -1) {
    			a.splice(j, 1);
    		}
    	}
    }

    /**
     * Removes the obstacle with the rectangle's bounds from the routing.
     *
     * @param rect the bounds of the obstacle to remove
     * @return <code>true</code> if the removal has dirtied one or more paths
     */
    function removeObstacle(rect) {
    	return internalRemoveObstacle(rect);
    }

    /**
     * Removes the given path from the routing.
     *
     * @param path the path to remove.
     * @return <code>true</code> if the removal may have affected one of the remaining paths
     */
    function removePath(path) {
    	userPaths.remove(path);
    	var children = pathsToChildPaths[path];   // List
    	if (!children)
    		workingPaths.remove(path);
    	else
    		workingPaths.removeAll(children);
    	return true;
    }

    /**
     * Resets exclude field on all obstacles
     */
    function resetObstacleExclusions() {
    	for (var i = 0; i < userObstacles.length; i++)
    		userObstacles[i].exclude = false;
    }

    /**
     * Resets all vertices found on paths and obstacles.
     */
    function resetVertices() {
    	for (var i = 0; i < userObstacles.length; i++) {
    		var obs = userObstacles[i];   // Obstacle
    		obs.reset();
    	}
    	for (var i = 0; i < workingPaths.length; i++) {
    		var path = workingPaths[i];   // Path
    		path.start.fullReset();
    		path.end.fullReset();
    	}
    }

    /**
     * Sets the default spacing between paths. The spacing is the minimum distance that path
     * should be offset from other paths or obstacles. The default value is 4. When this value
     * can not be satisfied, paths will be squeezed together uniformly.
     * @param spacing the path spacing
     * @since 3.2
     */
    function setSpacing(spacing) {
    	this.spacing = spacing;
    }

    /**
     * Updates the points in the paths in order to represent the current solution
     * with the given paths and obstacles.
     *
     * @return returns the list of paths which were updated.
     */
    function solve() {  // list
    	checkObstacles(userObstacles);
    	var numSolved = solveDirtyPaths();


    	countVertices();
    	checkVertexIntersections();
    	growObstacles();

    	subPaths = [];
    	stack = [];
    	labelPaths();
    	stack = undefined;

    	orderedPaths = [];
    	orderPaths();
    	bendPaths();

    	recombineSubpaths();
    	orderedPaths = undefined;
    	subPaths = undefined;

    	recombineChildrenPaths();
    	cleanup();

    	return userPaths;  // should be unmodifiable
    }

    /**
     * Solves paths that are dirty.
     * @return number of dirty paths
     */
    function solveDirtyPaths() {
    	var numSolved = 0;

    	for (var i = 0; i < userPaths.length; i++) {
    		var path = userPaths[i];   // Path
    		if (!path.isDirty)
    			continue;
    		var children = pathsToChildPaths[path];   // List
    		var prevCount = 1, newCount = 1;
    		if (!children)
    			children = [];
    		else
    			prevCount = children.length;

    		if (path.getBendPoints() != null)
    			newCount = path.getBendPoints().length + 1;

    		if (prevCount != newCount)
    			children = regenerateChildPaths(path, children, prevCount, newCount);

    		refreshChildrenEndpoints(path, children);
    	}

    	for (var i = 0; i < workingPaths.length; i++) {
    		var path = workingPaths[i];   // Path
    		checkObstacles(userObstacles);
    		path.refreshExcludedObstacles(userObstacles);
    		if (!path.isDirty) {
    			path.resetPartial();
    			continue;
    		}

    		numSolved++;
    		path.fullReset();

    		var pathFoundCheck = path.generateShortestPath(userObstacles);
    		if (!pathFoundCheck || path.end.cost > path.threshold) {
    			// path not found, or path found was too long
    			resetVertices();
    			path.fullReset();
    			path.threshold = 0;
    			pathFoundCheck = path.generateShortestPath(userObstacles);
    		}

    		resetVertices();
    	}

    	resetObstacleExclusions();

    	if (numSolved == 0)
    		resetVertices();

    	return numSolved;
    }

    /**
     * @since 3.0
     * @param path
     * @param children
     */
    function refreshChildrenEndpoints(path, children) {
    	var previous = path.getStartPoint();
    	var next;
    	var bendpoints = path.getBendPoints();
    	var child; // Path

    	for (var i = 0; i < children.length; i++) {
    		if (i < bendpoints.length)
    			next = bendpoints.getPoint(i);
    		else
    			next = path.getEndPoint();
    		child = children[i];
    		child.setStartPoint(previous);
    		child.setEndPoint(next);
    		previous = next;
    	}
    }

    /**
     * @since 3.0
     * @param path
     * @param children
     */
    function regenerateChildPaths(path, children, currentSize, newSize) {
    	//Path used to be simple but now is compound, children is EMPTY.
    	if (currentSize == 1) {
    		workingPaths.remove(path);
    		currentSize = 0;
    		children = [];
    		pathsToChildPaths.put(path, children);
    	} else
    	//Path is becoming simple but was compound.  children becomes empty.
    	if (newSize == 1) {
    		workingPaths.removeAll(children);
    		workingPaths.push(path);
    		pathsToChildPaths.remove(path);
    		return [];
    	}

    	//Add new working paths until the sizes are the same
    	while (currentSize < newSize) {
    		child = new Path();
    		workingPaths.push(child);
    		children.push(child);
    		currentSize++;
    	}

    	while (currentSize > newSize) {
    		var child = children.remove(children.length - 1);   // Path
    		workingPaths.remove(child); // check
    		currentSize--;
    	}

    	return children;
    }

    /**
     * Tests a segment that has been offset for new intersections
     * @param segment the segment
     * @param index the index of the segment along the path
     * @param path the path
     * @return 1 if new segments have been inserted
     */
    function testOffsetSegmentForIntersections(segment, index, path) {
    	for (var i = 0; i < userObstacles.length; i++) {
    		var obs =  userObstacles[i];   // Obstacle

    		if (segment.end.obs == obs || segment.start.obs == obs || obs.exclude)
    			continue;
    		vertex = undefined;

    		var offset = getSpacing();  // int
    		if (segment.getSlope() < 0) {
    			if (segment.intersects4(obs.topLeft().x - offset,
    					obs.topLeft().y - offset,
    					obs.bottomRight().x + offset,
    					obs.bottomRight().y + offset))
    				vertex = getNearestVertex(obs.topLeft(), obs.bottomRight(), segment);
    			else if (segment.intersects4(obs.bottomLeft().x - offset,
    					obs.bottomLeft().y + offset,
    					obs.topRight().x + offset,
    					obs.topRight().y - offset))
    				vertex = getNearestVertex(obs.bottomLeft(), obs.topRight(), segment);
    		} else {
    			if (segment.intersects4(obs.bottomLeft().x - offset,
    					obs.bottomLeft().y + offset,
    					obs.topRight().x + offset,
    					obs.topRight().y - offset))
    				vertex = getNearestVertex(obs.bottomLeft(), obs.topRight(), segment);
    			else if (segment.intersects4(obs.topLeft().x - offset,
    					obs.topLeft().y - offset,
    					obs.bottomRight().x + offset,
    					obs.bottomRight().y + offset))
    				vertex = getNearestVertex(obs.topLeft(), obs.bottomRight(), segment);
    		}

    		if (vertex != null) {
    			vRect = vertex.getDeformedRectangle(offset);
    			if (segment.end.obs) {
    				endRect = segment.end.getDeformedRectangle(offset);
    				if (vRect.intersects(endRect))
    					continue;
    			}
    			if (segment.start.obs != null) {
    				startRect = segment.start.getDeformedRectangle(offset);
    				if (vRect.intersects(startRect))
    					continue;
    			}

    			newSegmentStart = new Segment(segment.start, vertex);
    			newSegmentEnd = new Segment(vertex, segment.end);

    			vertex.totalCount++;
    			vertex.nearestObstacleChecked = false;

    			vertex.shrink();
    			checkVertexForIntersections(vertex);
    			vertex.grow();

    			if (vertex.nearestObstacle != 0)
    				vertex.updateOffset();

    			growPassChangedObstacles = true;

    			if (index != -1) {
    				path.grownSegments.remove(segment);
    				path.grownSegments.push(index, newSegmentStart);
    				path.grownSegments.push(index + 1, newSegmentEnd);
    			} else {
    				path.grownSegments.push(newSegmentStart);
    				path.grownSegments.push(newSegmentEnd);
    			}
    			return 1;
    		}
    	}
    	if (index == -1)
    		path.grownSegments.push(segment);
    	return 0;
    }

    /**
     * Tests all paths against the given obstacle
     * @param obs the obstacle
     */
    function testAndDirtyPaths(obs) {
    	var result = false;
    	for (var i = 0; i < workingPaths.length; i++) {
    		var path = workingPaths[i];   // Path
    		result |= path.testAndSet(obs); // check
    	}
    	return result;
    }

    /**
     * Updates the position of an existing obstacle.
     * @param oldBounds the old bounds(used to find the obstacle)
     * @param newBounds the new bounds
     * @return <code>true</code> if the change the current results to become stale
     */
    function updateObstacle(oldBounds, newBounds) {
    	var result = internalRemoveObstacle(oldBounds);
    	result |= addObstacle(newBounds);  // check
    	return result;
    }

    return {
    	Path: Path,
		addObstacle: addObstacle,
		removeObstacle: removeObstacle,
		addPath: addPath,
		removePath: removePath,
		setSpacing: setSpacing,
		getSpacing: getSpacing,
		solve: solve
    }

}
