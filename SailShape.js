
// Sail shape based on parabolic curve
// http://www.onemetre.net/design/Parab/Parab.htm
import {
	Vector2
} from "./three.module.js";

export default class SailShape {
    // properties are available after calling 
    draftDepth; // camber/sail depth in [mm]
    draftDepthRatio; // Max draft as ratio vs. chord [1/1]
    draftPosition; // Numerically calculated position of max draft vs chord [mm]
    draftPositionRatio; // how forward the draft is positioned [1/1] - where 0.5 is middle, 0.0 beginning 1.0 end of shape
    forceAngleRad; // Forward inclination of sail lift force [rad]
    girth; // length of sail following the parabolic shape [mm]
    mastAngleRad; // mast angle as part of the sail-shape [rad]
    sag; // sag (estimated outhaul movement) [mm]

    // private
    shapeRotated = []; // array of rotated sail shape points
    shapeScaled = []; // array of rotated and scaled sail shape points

    // cunningham is a number 1 .. 10
    constructor(chord, mastWidth, cunningham = 1) {

        // parabolic function fx(t): x=at^2, fy(t): y=2at
        const parabola = (t, a = 1) => new Vector2(a * t ** 2, 2 * a * t);
    
        const tStart = 0.001;
        const tEndDefault = 1.001; //increase this value to move draft/camber forward
                    // TODO: cunningham moves draft forward ---> but this requires correction to the fullness, otherwise is girth wrong in length
                    // tend   = 1,002 ## increase this value to move draft/camber forward ---> 45% camber, 10% draft (depth), girth 354mm
                    // tend   = 1,500 ## increase this value to move draft/camber forward ---> 41% camber, 12% draft (depth), girth 358mm
                    // tend   = 2,000 ## increase this value to move draft/camber forward ---> 37.5% camber, 12.5% draft (depth), girth 360mm
        const tEnd = tEndDefault + 0.95 * (cunningham-1) / 10 ;  // tEnd from 1.001 to 1.92 based on cunningham 1 .. 10 <-- vague estimation!!
        const fullness = 1 - 0.25 * (cunningham-1) / 10;   // 0.1 --> 0.12 --> 0.125  //TODO this formula is really vague, but doesnt 
        const tInc = (tEnd - tStart) / 1000; // increment

    
        let p1 = parabola(tStart);
        let p2 = parabola(tEnd);
        const phi = p2.sub(p1).angle(); //phi = math.atan((y2-y1)/(x2-x1)) // calculated angle to rotate parabola "flat"
        //this.cosPhi = Math.cos(phi)
        //this.sinPhi = Math.sin(phi)
        //console.log("phi: " + (this.phi*180/Math.PI).toFixed(2));

        let p0 = new Vector2(0, 0);
        for (let t = tStart; t <= tEnd; t += tInc) {
            let p = parabola(t);
            // move to 0
            p.sub(p1);

            // rotate around phi # https://en.wikipedia.org/wiki/Rotation_(mathematics)  # switch +/- for rotating clockwise
            //xrot =  x * cosPhi + y * sinPhi
            //yrot =  y * cosPhi - x * sinPhi
            p.rotateAround(p0, -phi); // rotate clockwise
            this.shapeRotated.push(p);
        }

        this.calcShape(chord, mastWidth, fullness);
    }


    // public:
    // calculate the shape for this chord length in [mm]
    // chord length = boom length - outhaul (straight leech to luff distance)
    // fullness: simple depth scaling factor to flatten the sail without recalculating the parabola
    calcShape(chord, mastWidth, fullness = 1) {
        this.shapeScaled = [];
        let scale = chord / (this.shapeRotated[this.shapeRotated.length - 1].x - this.shapeRotated[0].x);
        //console.log("scale: " + scale.toFixed(2));

        // clone and scale 
        for (let p in this.shapeRotated) {
            this.shapeScaled.push(this.shapeRotated[p].clone().multiplyScalar(scale));
        }

        // flatten the sail if needed (without changing the parabolic shape)
        if (fullness != 1) {
            for (let p of this.shapeScaled) {
                p.y *= fullness;
            }
        }

        // find max position
        let pmax = new Vector2(0, 0);
        for (const p of this.shapeScaled) {
            if (p.y > pmax.y) {
                pmax = p;
            }
        }

        this.draftDepth = pmax.y;
        this.draftPosition = pmax.x;

        //console.log("draftDepth: " + this.draftDepth.toFixed(2));

        // calculate girth (flat sail length)
        this.girth = 0.0;
        let p1 = null;

        for (const p2 of this.shapeScaled) {
            if (p1) {
                this.girth += p2.distanceTo(p1); //girth += math.sqrt((x2-x1)**2 + (y2-y1)**2)
            }
            p1 = p2;
        }

        //console.log("girth: " + this.girth.toFixed(2));

        // sag (estimated outhaul movement)
        this.sag = chord - this.girth;

        // entry & exit angle in [rad]
        this.entryAngleRad = this.shapeScaled[1].clone().sub(this.shapeScaled[0]).angle(); //entryAngle = 180*math.atan((y2-y1)/(x2-x1))/math.pi
        this.exitAngleRad = this.shapeScaled[this.shapeScaled.length - 1].clone().sub(this.shapeScaled[this.shapeScaled.length - 2]).angle() - Math.PI * 2;
        this.mastAngleRad = this.getMastAngle(mastWidth);

        // force angle Forward inclination of sail lift force
        this.forceAngleRad = (this.entryAngleRad + this.exitAngleRad) / 2;

        // max depth as draft vs. chord %
        this.draftDepthRatio = this.draftDepth / chord; // depth as draft vs. chord ;

        // max depth as draft vs. chord %
        this.draftPositionRatio = this.draftPosition / chord; // depth as draft vs. chord ;
    }

    // calculate sail-shape angle at with of mast and provide resulting mast-rotation, because mast is part of sail-shape
    getMastAngle(mastWidth) {
        let girth = 0;
        let angles = [];
        let p1 = null;
        for (const p2 of this.shapeScaled) {
            if (p1) {
                girth += p2.distanceTo(p1); //girth += math.sqrt((x2-x1)**2 + (y2-y1)**2)
                /*if (girth >= (mastWidth / 2)) {
                    return p2.clone().sub(p1).angle();

                }*/
                if (girth >= (mastWidth)) {
                    return p2.angle();
                }
            }
            p1 = p2;
        }
        return NaN; // can only happen if the mast width is wider than the sail shape
    }



    // number of vertices along the sail shape
    // in case of clipping, provie a width of clipped girth length 
    // substract mast width
    // return array of angles in [rad] -- 
    getVerticesAngles(numberOfPoints, mastWidth, clipOffWidth = null) {
        const segmentLength = (this.girth - mastWidth) / (numberOfPoints - 1);
        let point = 0;
        let girth = 0;
        let angles = [];
        let p1 = null;
        for (const p2 of this.shapeScaled) {
            if (p1) {
                girth += p2.distanceTo(p1); //girth += math.sqrt((x2-x1)**2 + (y2-y1)**2)
                if ((girth >= point * segmentLength + mastWidth) || (clipOffWidth && (girth > clipOffWidth))) {
                    point+= 1;
                    angles.push(p2.angle());
                } 
                if (point >= numberOfPoints) {
                    break;
                }
            }
            p1 = p2;
        }
        if (numberOfPoints != angles.length) {
            console.log("Number of points mismatch! Rounding error?? " + numberOfPoints + " actual: " + angles.length);
        }
        return angles;
    }

    // get point at girth distance
    // returns a 2D Vector with coordinates
    // TODO PERFORMANCE OPTIMIZATION BY NOT ITERATING EVERY TIME OVER POINTS!!!
    pointAtGirthDistance(distance) {
        let girth = 0.0;
        let p1 = null;
        for (const p2 of this.shapeScaled) {
            if (p1) {
                girth += p2.distanceTo(p1);
            }
            p1 = p2;
            if (girth >= distance) {
                return p1.clone();
            }
        }

    }

}

