export const simplifyPath = function (points, tolerance) {

    // helper classes
    const Vector = function (x, y) {
        this.x = x;
        this.y = y;

    };
    const Line = function (p1, p2) {
        this.p1 = new Vector(p1[0], p1[1]);
        this.p2 = new Vector(p2[0], p2[1]);

        this.distanceToPoint = function (point) {
            // slope
            var m = (this.p2.y - this.p1.y) / (this.p2.x - this.p1.x),
                // y offset
                b = this.p1.y - (m * this.p1.x),
                d = [];
            // distance to the linear equation
            d.push(Math.abs(point.y - (m * point.x) - b) / Math.sqrt(Math.pow(m, 2) + 1));
            // distance to p1
            d.push(Math.sqrt(Math.pow((point.x - this.p1.x), 2) + Math.pow((point.y - this.p1.y), 2)));
            // distance to p2
            d.push(Math.sqrt(Math.pow((point.x - this.p2.x), 2) + Math.pow((point.y - this.p2.y), 2)));
            // return the smallest distance
            return d.sort(function (a, b) {
                return (a - b); //causes an array to be sorted numerically and ascending
            })[0];
        };
    };

    const douglasPeucker = function (points, tolerance) {
        if (points.length <= 2) {
            return [points[0]];
        }
        var returnPoints = [],
            // make line from start to end
            line = new Line(points[0], points[points.length - 1]),
            // find the largest distance from intermediate poitns to this line
            maxDistance = 0,
            maxDistanceIndex = 0,
            p;
        for (var i = 1; i <= points.length - 2; i++) {
            var distance = line.distanceToPoint(points[i]);
            if (distance > maxDistance) {
                maxDistance = distance;
                maxDistanceIndex = i;
            }
        }
        // check if the max distance is greater than our tollerance allows
        if (maxDistance >= tolerance) {
            p = points[maxDistanceIndex];
            line.distanceToPoint(p, true);
            // include this point in the output
            returnPoints = returnPoints.concat(douglasPeucker(points.slice(0, maxDistanceIndex + 1), tolerance));
            // returnPoints.push( points[maxDistanceIndex] );
            returnPoints = returnPoints.concat(douglasPeucker(points.slice(maxDistanceIndex, points.length), tolerance));
        } else {
            // ditching this point
            p = points[maxDistanceIndex];
            line.distanceToPoint(p, true);
            returnPoints = [points[0]];
        }
        return returnPoints;
    };
    const arr = douglasPeucker(points, tolerance);
    // always have to push the very last point on so it doesn't get left off
    arr.push(points[points.length - 1]);
    return arr;
};


/**
 * Calculate the perpendicular distance between a point and a line segment.
 * Reference: https://stackoverflow.com/a/6853926/15786030
 *
 * @param {Array}    point A point '[x, y].'
 * @param {2D Array} line  A line segment '[[x1, y1], [x2. y2]].'
 *
 * @return {Number}
 */
function getPerpDist(point, line) {
    var dot = (point[0] - line[0][0]) * (line[1][0] - line[0][0]) + (point[1] - line[0][1]) * (line[1][1] - line[0][1]);
    var len_sq = (line[1][0] - line[0][0]) * (line[1][0] - line[0][0]) + (line[1][1] - line[0][1]) * (line[1][1] - line[0][1]);
    var param = -1;

    if (len_sq !== 0) { // In case of line length 0.
        param = dot / len_sq;
    }

    if (param < 0) {
        return Math.sqrt((point[0] - line[0][0]) * (point[0] - line[0][0]) + (point[1] - line[0][1]) * (point[1] - line[0][1]));
    } else if (param > 1) {
        return Math.sqrt((point[0] - line[1][0]) * (point[0] - line[1][0]) + (point[1] - line[1][1]) * (point[1] - line[1][1]));
    }

    return Math.sqrt((point[0] - (line[0][0] + param * (line[1][0] - line[0][0]))) * (point[0] - (line[0][0] + param * (line[1][0] - line[0][0]))) + (point[1] - (line[0][1] + param * (line[1][1] - line[0][1]))) * (point[1] - (line[0][1] + param * (line[1][1] - line[0][1]))));
}

/**
 * Decimate a curve of line segment connected points to a similarly shaped curve with fewer points.
 * Reference: https://en.wikipedia.org/wiki/Ramer%E2%80%93Douglas%E2%80%93Peucker_algorithm
 *
 * @param {2D Array} points           An array of '[x, y]' points.
 * @param {Number}   epsilonTolerance The tolerance at which a point is removed from the line segment.
 *
 * @return {2D Array}
 */
export function rdp(points, epsilonTolerance) {
    let maxDist = 0;
    let index = 0;

    for (let i = 1; i < (points.length - 1); i++) {
        let dist = getPerpDist(points[i], [points[1], points[points.length - 1]]);

        if (dist > maxDist) {
            index = i;
            maxDist = dist;
        }
    }

    if (maxDist > epsilonTolerance) {
        return [...rdp(points.slice(0, index), epsilonTolerance), ...rdp(points.slice(index, points.length), epsilonTolerance)];
    }

    return [points[0], points[points.length - 1]];
}

