
// Sail shape based on parabolic curve
// http://www.onemetre.net/design/Parab/Parab.htm
import {
	Vector2
} from "./three.module.js";

export default class SailShape {
    tStart = 0.001;
    tEnd = 1.001; //increase this value to move draft/camber forward
    tInc = (this.tEnd - this.tStart) / 1000; // increment

    shapeRotated = []; // array of rotated sail shape points
    phi; // calculated angle to rotate parabola "flat"
    cosPhi; // precalc rotation factors
    sinPhi; // precalc rotation factors

    shapeScaled = [];

    draftDepth;
    draftPosition;
    girth;
    mastAngle;

    // private: 
    // parabolic function fx(t): x=at^2, fy(t): y=2at
    parabola(t, a = 1) {
        return new Vector2(a * t ** 2, 2 * a * t);
    }

    constructor() {
        let p1 = this.parabola(this.tStart);
        let p2 = this.parabola(this.tEnd);
        this.phi = p2.sub(p1).angle(); //phi = math.atan((y2-y1)/(x2-x1))
        //this.cosPhi = Math.cos(phi)
        //this.sinPhi = Math.sin(phi)
        //console.log("phi: " + (this.phi*180/Math.PI).toFixed(2));

        let p0 = new Vector2(0, 0);
        for (let t = this.tStart; t <= this.tEnd; t += this.tInc) {
            let p = this.parabola(t);
            // move to 0
            p.sub(p1);

            // rotate around phi # https://en.wikipedia.org/wiki/Rotation_(mathematics)  # switch +/- for rotating clockwise
            //xrot =  x * cosPhi + y * sinPhi
            //yrot =  y * cosPhi - x * sinPhi
            p.rotateAround(p0, -this.phi); // rotate clockwise
            this.shapeRotated.push(p);
        }
    }


    // public:
    // calculate the shape for this chord length in [mm]
    // chord length = boom length - outhaul (straight leech to luff distance)
    // fullness: simple depth scaling factor to flatten the sail without recalculating the parabola
    calcShape(chord, mastWidth, fullness = 1) {
        this.shapeScaled = [];
        this.mastWidth = mastWidth;
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
        this.entryAngle = this.shapeScaled[1].clone().sub(this.shapeScaled[0]).angle(); //entryAngle = 180*math.atan((y2-y1)/(x2-x1))/math.pi
        this.exitAngle = this.shapeScaled[this.shapeScaled.length - 1].clone().sub(this.shapeScaled[this.shapeScaled.length - 2]).angle() - Math.PI * 2;
        //console.log("entry: " + this.entryAngle.toFixed(2) + " exit: " + this.exitAngle.toFixed(2));
        this.mastAngle = this.getMastAngle(mastWidth);

        // force angle Forward inclination of sail lift force
        this.forceAngle = (this.entryAngle + this.exitAngle) / 2;
        //console.log("forceangle: " + this.forceAngle.toFixed(2));



    }

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

    /*   // calculated length of flattened sail-shape
       get girth() {
           return this.girth;
       }
    
       // entry angle of sail shape
       get entryAngle() {
           return this.entryAngle;
       }
       
       // exit angle of sail shape
       get exitAngle() {
           return this.exitAngle;
       }
    
       set entryAngle(a) {
           this.entryAngle = a;
       }*/

    // depth as draft vs. chord %
    get draftRatio() {
        return this.draftDepth / chord; // depth as draft vs. chord %;
    }

    // calculate angle of sail at position of masttrack which is actuall luff of sail
    mastTrackAngle(mastwidth) {

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

