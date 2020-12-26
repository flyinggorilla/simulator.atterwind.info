"use strict";

import * as THREE from './three.module.js';
import Stats from './stats.module.js';
import { STLLoader } from './STLLoader.js';
import { OrbitControls } from "./OrbitControls.js";
import { GUI } from './dat.gui.module.js';
import { Water } from './Water.js';
import { Sky } from './Sky.js';


let showWater = true;
let showDetails = false;

let container, stats;

let camera, controls, cameraTarget, scene, renderer;
let water, sun, mesh;

let boat, mast, sailtop, sailfoot, mainsheet;

let windfield = [];

let apparentwindfield = [];

let loadingComplete = false;

const boatParams = {
    mastrotation: 0.0,
    heading: 0.0,
    speed: 5.0,
    testcheckbox: false, //############# TEST
    vmg: 0.0
}

const windParams = {
    speed: 5.0,
    hellman: 0.27
}

const sailParams = {
    mastArea: 0,
    sailArea: 0
}

// Sail shape based on parabolic curve
// http://www.onemetre.net/design/Parab/Parab.htm
class SailShape {
    tStart = 0.001;
    tEnd   = 1.001; //increase this value to move draft/camber forward
    tInc   = (this.tEnd-this.tStart)/1000; // increment

    shapeRotated = []; // array of rotated sail shape points
    phi; // calculated angle to rotate parabola "flat"
    cosPhi; // precalc rotation factors
    sinPhi; // precalc rotation factors

    shapeScaled = [];

    draftDepth;
    draftPosition;
    girth;

    // private: 
    // parabolic function fx(t): x=at^2, fy(t): y=2at
    parabola(t, a = 1){
        return new THREE.Vector2(a * t**2, 2*a*t);
    } 
    
    constructor() {
        let p1 = this.parabola(this.tStart);
        let p2 = this.parabola(this.tEnd);
        this.phi = p2.sub(p1).angle(); //phi = math.atan((y2-y1)/(x2-x1))
        //this.cosPhi = Math.cos(phi)
        //this.sinPhi = Math.sin(phi)
        //console.log("phi: " + (this.phi*180/Math.PI).toFixed(2));

        let p0 = new THREE.Vector2(0, 0);
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
    calcShape(chord, fullness = 1) {
        this.shapeScaled = [];
        let scale = chord / (this.shapeRotated[this.shapeRotated.length-1].x - this.shapeRotated[0].x);
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
        let pmax = new THREE.Vector2(0, 0);
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
        this.exitAngle = this.shapeScaled[this.shapeScaled.length-1].clone().sub(this.shapeScaled[this.shapeScaled.length-2]).angle() - Math.PI*2;
        //console.log("entry: " + this.entryAngle.toFixed(2) + " exit: " + this.exitAngle.toFixed(2));

        
        // force angle Forward inclination of sail lift force
        this.forceAngle = (this.entryAngle + this.exitAngle)/2;
        //console.log("forceangle: " + this.forceAngle.toFixed(2));
        
                
        
    }

    // return array of angles in [rad] -- 
    getVerticesAngles(numberOfPoints) {
        const segmentLength = this.girth / (numberOfPoints -1);
        let point = -1;
        let girth = 0;
        let angles = [];
        let p1 = null;
        for (const p2 of this.shapeScaled) {
            if (p1) {
                girth += p2.distanceTo(p1); //girth += math.sqrt((x2-x1)**2 + (y2-y1)**2)
                let points = Math.floor(girth / segmentLength);
                if (points > point) {
                    point = points;
                    //let angle = p2.clone().sub(p1).angle();
                    //angles.push(angle < Math.PI ? angle : - Math.PI*2 + angle );
                    angles.push(p2.angle());
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






let sailShape = new SailShape();
sailShape.calcShape(345);


let dataDiv;


init();
animate();

function init() {

    container = document.createElement('div');
    document.body.appendChild(container);

    dataDiv = document.getElementById("data");


    //renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer = new THREE.WebGLRenderer();
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    //renderer.outputEncoding = THREE.sRGBEncoding;

    renderer.shadowMap.enabled = true;

    container.appendChild(renderer.domElement);


    const fov = 75;
    const near = 0.1;
    const far = 100;
    //camera = new THREE.PerspectiveCamera(fov, window.innerWidth / window.innerHeight, near, far);
    //camera.position.set(2, 0, 3);

    camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 1, 20000);
    camera.position.set(8, 8, 10);

    const cameraHelper = new THREE.CameraHelper(camera);


    //cameraTarget = new THREE.Vector3(0, 0, 0);

    const COLOR_WATER = 0x0077be;

    scene = new THREE.Scene();
    //scene.background = new THREE.Color(0x72645b);
    //scene.fog = new THREE.Fog(0x72645b, 2, 15);

    if (showDetails) {
        scene.add(cameraHelper);
    }

    // renderer


    controls = new OrbitControls(camera, renderer.domElement);
    controls.maxPolarAngle = Math.PI * 0.495;
    controls.target.set(0, 5, 0);
    controls.minDistance = 1.0;
    controls.maxDistance = 10000.0;
    controls.update();
    //camera.position.set( 0, 20, 100 );
    //camera.position.copy(cameraTarget);



    // Ground
    /*const plane = new THREE.Mesh(
        new THREE.PlaneBufferGeometry(40000, 40000),
        new THREE.MeshStandardMaterial({ color: COLOR_WATER, specular: 0x101010, opacity: 0.1 })
    );
    plane.rotation.x = - Math.PI / 2;
    plane.position.y = 0;
    scene.add(plane);

    plane.receiveShadow = true;*/


    //

    sun = new THREE.Vector3();

    // Water

    const waterGeometry = new THREE.PlaneBufferGeometry(10000, 10000);

    water = new Water(
        waterGeometry,
        {
            textureWidth: 512,
            textureHeight: 512,
            waterNormals: new THREE.TextureLoader().load('./waternormals.jpg', function (texture) {

                texture.wrapS = texture.wrapT = THREE.RepeatWrapping;

            }),
            alpha: 1.0,
            sunDirection: new THREE.Vector3(),
            sunColor: 0xffffff,
            //waterColor: 0x001e0f,
            waterColor: 0x004e2f,
            distortionScale: 3.7,
            fog: scene.fog !== undefined
        }
    );

    water.rotation.x = - Math.PI / 2;

    if (showWater) {
        scene.add(water);
    }

    // Skybox

    const sky = new Sky();
    sky.scale.setScalar(10000);
    scene.add(sky);

    const skyUniforms = sky.material.uniforms;

    skyUniforms['turbidity'].value = 10;
    skyUniforms['rayleigh'].value = 2;
    skyUniforms['mieCoefficient'].value = 0.005;
    skyUniforms['mieDirectionalG'].value = 0.8;

    const parameters = {
        inclination: 0.28,
        azimuth: 0.379
    };

    const pmremGenerator = new THREE.PMREMGenerator(renderer);

    function updateSun() {

        const theta = Math.PI * (parameters.inclination - 0.5);
        const phi = 2 * Math.PI * (parameters.azimuth - 0.5);

        sun.x = Math.cos(phi);
        sun.y = Math.sin(phi) * Math.sin(theta);
        sun.z = Math.sin(phi) * Math.cos(theta);

        sky.material.uniforms['sunPosition'].value.copy(sun);
        water.material.uniforms['sunDirection'].value.copy(sun).normalize();

        scene.environment = pmremGenerator.fromScene(sky).texture;

    }

    updateSun();

    //

    /*const geometry = new THREE.BoxBufferGeometry(30, 30, 30);
    const material = new THREE.MeshStandardMaterial({ roughness: 0 });

    mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
*/
    //


    //

    stats = new Stats();
    container.appendChild(stats.dom);

    // GUI

    const gui = new GUI();


    const folderSky = gui.addFolder('Sky');
    folderSky.add(parameters, 'inclination', 0, 0.5, 0.0001).onChange(updateSun);
    folderSky.add(parameters, 'azimuth', 0, 1, 0.0001).onChange(updateSun);
    //folderSky.open();
    if (!showDetails) {
        folderSky.hide();
    }

    const waterUniforms = water.material.uniforms;

    const folderWater = gui.addFolder('Water');
    folderWater.add(waterUniforms.distortionScale, 'value', 0, 8, 0.1).name('distortionScale');
    folderWater.add(waterUniforms.size, 'value', 0.1, 10, 0.1).name('size');
    folderWater.add(waterUniforms.alpha, 'value', 0.9, 1, .001).name('alpha');
    //folderWater.open();
    if (!showDetails) {
        folderWater.hide();
    }


    const folderBoat = gui.addFolder('Boat');
    //folderBoat.add(boatParams, 'mastrotation', -90, 90, 1).name('mastrotation').listen(); // add .listen() to receive updates!!
    folderBoat.add(boatParams, 'heading', -180, 180, 1).name('heading').onChange(recalc);
    folderBoat.add(boatParams, 'speed', 0, 30, 1).name('speed').onChange(recalc);
    //folderBoat.add(boatParams, 'testcheckbox').name("testcheckbox"); //############# TEST
    folderBoat.open();

    const folderWind = gui.addFolder('Wind');
    folderWind.add(windParams, 'speed', 0, 30, 1).name('speed').onChange(recalc);
    folderWind.add(windParams, 'hellman', { unstable: 0.06, neutral: 0.10, stable: 0.27}).name('condition').onChange(recalc); 
    folderWind.open();

    // Wind

    const windGroup = new THREE.Group();

    // radius — Radius of the cone at the base. Default is 1.
    // height — Height of the cone. Default is 1.
    // radialSegments — Number of segmented faces around the circumference of the cone. Default is 8
    // heightSegments — Number of rows of faces along the height of the cone. Default is 1.
    // openEnded — A Boolean indicating whether the base of the cone is open or capped. Default is false, meaning capped.
    // thetaStart — Start angle for first segment, default = 0 (three o'clock position).
    // thetaLength — The central angle, often called theta, of the circular sector. The default is 2*Pi, which makes for a complete cone.
    let windcone = new THREE.Group();
    let windgeometry = new THREE.ConeGeometry(0.1, 0.2, 12);
    let windmaterial = new THREE.MeshStandardMaterial({ color: 0x0000FF, opacity: 0.5, transparent: true });
    let windconemesh = new THREE.Mesh(windgeometry, windmaterial);
    windconemesh.position.set(0, -0.1, 0)
    windcone.add(windconemesh);
    windcone.position.set(0, 10, 0)
    windcone.rotation.set(Math.PI / 2, 0, Math.PI / 2);

    let pos, height;
    for (height = 1; height < 11; height++) {
        windfield[height] = [];
        for (pos = 0; pos <= 10; pos++) {
            let clone = windcone.clone();
            clone.position.set(0, height, pos - 5);
            windfield[height][pos] = clone;
            windGroup.add(clone);
        }
    }
    recalcWindField(windParams.speed, windParams.hellman);

    for (let height = 0; height < 11; height += 0.5) {
        let clone = windcone.clone();
        clone.position.set(0, height, 0);
        apparentwindfield[height * 2] = clone;
        scene.add(clone);
    }

    //windGroup.rotateOnAxis();
    windGroup.position.set(7.5, 0, 0);
    scene.add(windGroup);





    THREE.DefaultLoadingManager.onStart = function (url, itemsLoaded, itemsTotal) {

        //console.log('Started loading file: ' + url + '.\nLoaded ' + itemsLoaded + ' of ' + itemsTotal + ' files.');

    };

    THREE.DefaultLoadingManager.onLoad = function () {

        //console.log('Loading Complete!');
        loadingComplete = true;
        document.getElementById("loading").style.display = "none";

    };


    THREE.DefaultLoadingManager.onProgress = function (url, itemsLoaded, itemsTotal) {

        //console.log('Loading file: ' + url + '.\nLoaded ' + itemsLoaded + ' of ' + itemsTotal + ' files.');

    };

    THREE.DefaultLoadingManager.onError = function (url) {

        //console.log('There was an error loading ' + url);

    };

    const boxgeometry = new THREE.BoxBufferGeometry(30, 30, 30);
    const boxmaterial = new THREE.MeshStandardMaterial({ roughness: 0 });

    let boxmesh = new THREE.Mesh(boxgeometry, boxmaterial);
    //scene.add( boxmesh );

    // Boat
    const boatmaterial = new THREE.MeshStandardMaterial({ color: 0xAAAAAA, specular: 0x111111, shininess: 200 });
    const loader = new STLLoader();
    const BOATSCALE = new THREE.Vector3(0.001, 0.001, 0.001);

    // Colored binary STL
    loader.load('./hull.stl', function (geometry) {

        let meshMaterial = boatmaterial;

        if (geometry.hasColors) {

            meshMaterial = new THREE.MeshStandardMaterial({ opacity: geometry.alpha, vertexColors: true });

        }

        boat = new THREE.Group();
        
        let boatMesh = new THREE.Mesh(geometry, meshMaterial);

        boat.scale.copy(BOATSCALE);
        //mesh.scale.set(0.0001, 0.0001, 0.0001);
        boatMesh.position.set(50, -1000, 0); // fore, port, up .... in mm
        boat.rotation.set(- Math.PI / 2, 0, 0);
        boat.position.set(0, 0.5, 0);

        if (showDetails) {
            const axes = new THREE.AxesHelper();
            axes.material.depthTest = false;
            axes.renderOrder = 1;
            axes.scale.set(1000, 1000, 1000);
            boat.add(axes);
        }


        boat.castShadow = true;
        boat.receiveShadow = true;

        boat.add(boatMesh);
        scene.add(boat);

        // mast height 9050mm
        loader.load('./mast.stl', function (geometry) {

            let meshMaterial = boatmaterial;

            if (geometry.hasColors) {

                meshMaterial = new THREE.MeshStandardMaterial({ opacity: geometry.alpha, vertexColors: true });

            }

            mast = new THREE.Mesh(geometry, meshMaterial);

            mast.position.set(-600, 35, +9380); // fore, port, up ... [mm]
            mast.rotation.set(- Math.PI / 2, 0, - 2 * Math.PI / 360 * 4);

            mast.castShadow = true;
            mast.receiveShadow = true;

            if (showDetails) {
                const axes = new THREE.AxesHelper();
                axes.material.depthTest = false;
                axes.renderOrder = 1;
                axes.scale.set(1000, 1000, 1000);
                mast.add(axes);
            }

            let tackVector = rigSail(mast);

            boat.add(mast);

            const mainSheetMaterial = new THREE.LineBasicMaterial( { color: 0x8f0f0f } );
            const points = [];
            points.push( new THREE.Vector3(0, 0, 0) );
            points.push( new THREE.Vector3( -2450, 30, 290 ) );
        
            mainSheetGeometry = new THREE.Geometry().setFromPoints( points );
            mainSheet = new THREE.Line( mainSheetGeometry, mainSheetMaterial );
            boat.add(mainSheet);
        });



    });

    // Lights

    scene.add(new THREE.HemisphereLight(0x443333, 0x111122));

    addShadowedLight(1, 1, 1, 0xffffff, 1.35);
    addShadowedLight(0.5, 1, - 1, 0xffaa00, 1);


    // stats

    stats = new Stats();
    container.appendChild(stats.dom);

    //

    window.addEventListener('resize', onWindowResize, false);

}

const sailHeight = 9040; // mm
const sailLevelHeight = 100; // mm
const sailVerticesPerLevel = Math.floor(1000/sailLevelHeight);
const sailLevels = Math.ceil(sailHeight / sailLevelHeight);
const sailTackHeight = 900;
let sail, sailGeometry;
let mainSheet, mainSheetGeometry;
let travellerVector = new THREE.Vector3();

function rigSail(mast) {
    const tackMastDistance = 2125;
    const decksweeper = 900;
    const topMastDistance = 400; // mm
    const leechCurvature = 200; //mm

    let luffAxis = new THREE.Vector3(0, 0, 1);
   

    sail = new THREE.Group();
    sailGeometry = new THREE.Geometry();


    for (let level = 0; level <= sailLevels; level++) {
        let height = level * sailLevelHeight;

        if (height > sailHeight) {
            height = sailHeight;
        }

        // function defining lech sailshape
        let sailWidth;
        let clipOffWidth;
        if (height <= sailTackHeight) {
            sailWidth = tackMastDistance;
            clipOffWidth = decksweeper + (tackMastDistance - decksweeper) * height / sailTackHeight;
            //override
        } else {
            sailWidth = tackMastDistance - (tackMastDistance - topMastDistance) * (height - sailTackHeight) / (sailHeight - sailTackHeight);
            sailWidth+= Math.sin((height - sailTackHeight) / (sailHeight - sailTackHeight) * Math.PI) * leechCurvature;
            clipOffWidth = sailWidth;
        }

        // add horizontal vertices 
        let lastrot, lastvector;
        for (let v = 0; v < sailVerticesPerLevel; v++) {
            let segwidth = sailWidth / (sailVerticesPerLevel - 1);
            let clipAway = segwidth * v - clipOffWidth
            if (clipAway > 0.1) {
                if (clipAway > segwidth) {
                    segwidth = 0;
                 } else {
                    segwidth = segwidth - clipAway;
                }
            } 

            let vector; //, rot;
            if (v == 0) {
                vector = new THREE.Vector3(0, 0, height);
                //rot = Math.PI / 4;
            } else {
                //rot = lastrot - Math.PI / 24;
                vector = new THREE.Vector3(0, segwidth, 0);
                vector.add(lastvector);
            }
            lastvector = vector;
            //lastrot = rot;
            sailGeometry.vertices.push(vector); 
    
        }

    } 

    //let v0 = sailgeometry.vertices[0].clone();
    //let vrot = v0.sub(sailgeometry.vertices[2]).normalize();
    //sailgeometry.vertices[1].applyAxisAngle(luffAxis, Math.PI / 4);

    for (let level = 0; level < sailLevels; level++) {
    //for (let level = 0; level <= 2; level++) {
        for (let v = 1; v < sailVerticesPerLevel; v++) {
            let i = level*sailVerticesPerLevel + v;
            let f1 = new THREE.Face3(i -1, i, i +  sailVerticesPerLevel - 1);
            let f2 = new THREE.Face3(i, i + sailVerticesPerLevel, i + sailVerticesPerLevel - 1);
            if (level % 10 ) {
                f1.color = new THREE.Color(0.7, 0.5, 0.5);
                f2.color = new THREE.Color(0.5, 0.5, 0.7);
            } else {
                f1.color = new THREE.Color(0.8, 0.2, 0.2);
                f2.color = new THREE.Color(0.8, 0.2, 0.2);
            }
            sailGeometry.faces.push(f1, f2);

        }
    }
    sailGeometry.computeFaceNormals();
    sailGeometry.computeVertexNormals();

    // Fiberfoam MAST: The section is tapered from approx 160×60 mm in the bottom to 130×45 mm in the top. The mast base shape is identical to the common 145×60 mm section for the ease of interchanging parts.
    sailParams.mastArea = (160 * sailHeight - 30 * sailHeight / 2) / 1000000; // m2
    // this models mast has 140mm and is not tapered
    sailParams.mastArea = (140 * sailHeight) / 1000000; // m2
    sailParams.sailArea = calcGeometryArea(sailGeometry) / 1000000; // m2

    //let sailmaterial = new THREE.MeshStandardMaterial({ vertexColors: THREE.FaceColors, color: 0xFFE0E0, opacity: 0.7, transparent: true, side: THREE.DoubleSide });
    let sailmaterial = new THREE.MeshBasicMaterial({ vertexColors: THREE.FaceColors, side: THREE.DoubleSide, opacity: 0.7, transparent: true });
    let sailmesh = new THREE.Mesh(sailGeometry, sailmaterial);
    sail.rotation.set(Math.PI / 2, 0, Math.PI / 2);
    sail.position.set(-130, 9040, 0)
    sail.add(sailmesh);
    mast.add(sail);

 
}

function calcGeometryArea(geometry) {
    let area = 0;
    for (let face of geometry.faces) {
        let triangle = new THREE.Triangle(geometry.vertices[face.a], geometry.vertices[face.b], geometry.vertices[face.c]);
        area += triangle.getArea();
    }
    return area;
}


function addShadowedLight(x, y, z, color, intensity) {

    const directionalLight = new THREE.DirectionalLight(color, intensity);
    directionalLight.position.set(x, y, z);
    scene.add(directionalLight);

    directionalLight.castShadow = true;

    const d = 1;
    directionalLight.shadow.camera.left = - d;
    directionalLight.shadow.camera.right = d;
    directionalLight.shadow.camera.top = d;
    directionalLight.shadow.camera.bottom = - d;

    directionalLight.shadow.camera.near = 1;
    directionalLight.shadow.camera.far = 4;

    directionalLight.shadow.bias = - 0.002;

}


function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);

}

function animate() {

    requestAnimationFrame(animate);

    //controls.update();
    render();
    //renderer.render(scene, camera);

    stats.update();

}

function recalc() {
    //console.log("recalc");
}

function rad2grad(rad) {
    return rad*180/Math.PI;
}

function grad2rad(grad) {
    return grad*Math.PI/180;
}


let lastWindSpeed, lastBoatSpeed, lastBoatHeading, lastHellman, lastMainSheetLength, lastMastrotation = 0;
let flatSailgeometry = null;
function render() {

    //const timer = Date.now() * 0.0005;

    const time = performance.now() * 0.0025;

    //camera.position.x = Math.cos(timer) * 3;
    //camera.position.z = Math.sin(timer) * 3;

    
    if (loadingComplete && boat) {
        //boat.position.y = Math.sin( time ) * 20 + 5;
        boat.rotation.x = - Math.PI / 2 + Math.sin(time) * 0.01;
        boat.rotation.y = Math.cos(time) * 0.034;
        boat.rotation.z = Math.cos(time) * 0.01 - Math.sin(time) * 0.02 - grad2rad(boatParams.heading);

        let mainSheetLength = Math.round(recalcMainSheet());  


        //mast.rotation.y = boatParams.mastrotation * Math.PI / 180.0;
        //if (boatParams.mastrotation != lastMastrotation) {
        if ((windParams.speed != lastWindSpeed) || (windParams.hellman != lastHellman) ||
              (boatParams.heading != lastBoatHeading) || (boatParams.speed != lastBoatSpeed) ||
             (lastMainSheetLength != mainSheetLength)) {

            if (boatParams.speed >= 13) {
                //boat.position.set(0, 0.6, 0); // foiling height
                boat.position.y = 0.6; // foiling height
            } else {
                //boat.position.set(0, 0.15, 0); // non-foiling
                boat.position.y = 0.08; // foiling height ******************* CHANGE TO  .y
            }
            let mastFootOverWaterHeight = (boat.position.y + 0.2)*1000;
    
            if (!flatSailgeometry) {
                flatSailgeometry = sailGeometry.clone();
            }
        
            //#####################################################################
            // TODO: the higher the apparent wind speed, the flatter the sail!!! 
            // TODO: create functions for mast-rotation in dependence on heading and (wind)speed
            // TODO: create line for mainsheet and display length of it --- implies traveller!!!!
            // mast and luff rotation
            let deltarot = 0;
            let angleOfAttack = 0;
            let dirfact = boatParams.heading < 0 ? 1.0 : -1.0; // direction factor 
            sailShape.calcShape(2160);

            let aw = apparentWind(boatParams.speed, boatParams.heading, windParams.speed, 0);
            let mr = calcMastRotation(aw)

            let verticeAngles = sailShape.getVerticesAngles(sailVerticesPerLevel);
            //console.log("verticeAngles: " + verticeAngles.length);
            //console.log("dirfact: " + dirfact);
            //for (let i in verticeAngles) {
            //    console.log("angle[" + i + "]: " + rad2grad(verticeAngles[i]).toFixed(2) + "°");
            //}

            boatParams.mastrotation = aw.awa;


            //deltarot = (Math.PI / 12 +  Math.PI / 12 * Math.max(50-aw.aws, 0)/50) * angleOfAttack / grad2rad(25);
    
            // adjust sailshape
            let luffAxis = new THREE.Vector3(0, 0, 1);
            let power = 0.0;
            for (let level = 0; level <= sailLevels; level++) {
                let overWaterHeight = level * sailLevelHeight + mastFootOverWaterHeight;
                let tws = windSheer(windParams.speed, overWaterHeight / 1000.0, windParams.hellman);
                let aw = apparentWind(boatParams.speed, boatParams.heading, tws, 0);
                let awa = aw.awa;
                let deltarot = grad2rad(boatParams.mastrotation - awa);
                //deltarot = 0;
                if (aw.awa > 25) {
                    power += aw.aws; // sum up all wind speeds
                }

                /*
                //if (Math.abs(baserot) > Math.PI/2) {
                //    baserot = Math.PI/2 * Math.sign(baserot);
                //}
                let lastrot = grad2rad(boatParams.mastrotation) - baserot;   
                for (let v = 1; v < sailVerticesPerLevel; v++) {
                    let i = level*sailVerticesPerLevel + v;
                    let rot = lastrot + deltarot;
                    let segment = new THREE.Vector3();
                    segment.subVectors(flatSailgeometry.vertices[i], flatSailgeometry.vertices[i-1]);
                    segment.applyAxisAngle(luffAxis, rot);
                    lastrot = rot;
                    sailGeometry.vertices[i].addVectors(sailGeometry.vertices[i-1], segment);
                } */

                for (let v = 1; v < sailVerticesPerLevel; v++) {
                    let i = level*sailVerticesPerLevel + v;
                    //let segment = new THREE.Vector3();
                    //segment.subVectors(flatSailgeometry.vertices[i], flatSailgeometry.vertices[i-1]);
                    //segment.applyAxisAngle(luffAxis, deltarot - verticeAngles[v] * dirfact);
                    //sailGeometry.vertices[i].addVectors(sailGeometry.vertices[i-1], segment);

                    sailGeometry.vertices[i].copy(flatSailgeometry.vertices[i]);
                    sailGeometry.vertices[i].applyAxisAngle(luffAxis, deltarot-verticeAngles[v]*dirfact);
                } 



            } 
            power /= sailLevels;
            sailGeometry.verticesNeedUpdate = true; 
            mast.rotateY(grad2rad(boatParams.mastrotation - lastMastrotation));
            //mast.rotation.y = grad2rad(boatParams.mastrotation);


            //mast.updateMatrix();
            recalcWindField(windParams.speed, windParams.hellman);
            recalcApparentWindField(windParams.speed, boatParams.speed, boatParams.heading, windParams.hellman);

            boatParams.vmg = Math.abs(boatParams.speed * Math.cos(grad2rad(boatParams.heading)));

            dataDiv.innerHTML = "Mast rotation: " + Math.round(mr.mastRotation) + 
                                "° <br> Mast angle of attack: " + Math.round(mr.mastAngleOfAttack) + "°" + 
                                "<br>Apparent wind speed: " + Math.round(aw.aws) + "kts" + 
                                "<br>Apparent wind angle: " + Math.round(Math.abs(aw.awa)) + "°" + 
                                "<br>Sail area: " + (sailParams.mastArea + sailParams.sailArea).toFixed(2) + "m² (mast: " + sailParams.mastArea.toFixed(2) + "m², sail: " + sailParams.sailArea.toFixed(2) + "m²)" + //&sup2;
                                "<br>Mast foot over water: " + (mastFootOverWaterHeight/1000).toFixed(1) + "m" + 
                                "<br>Mainsheet give: " + Math.round(mainSheetLength/10 - 83) + "cm" + 
                                "<br>VMG: " + boatParams.vmg.toFixed(1) + "kts" +
                                "<br>Apparent wind power: " + power.toFixed(1) + "kts average over sail" +
                                "<br>lastrot: " + rad2grad(deltarot).toFixed(1) +
                                "<br>deltarot: " + rad2grad(deltarot).toFixed(1);

            lastMastrotation = boatParams.mastrotation;
            lastBoatHeading = boatParams.heading;
            lastBoatSpeed = boatParams.speed;
            lastHellman = windParams.hellman;
            lastWindSpeed = windParams.speed;
            lastMainSheetLength = mainSheetLength;

        } 


        
        //mast.rotation.y = Math.PI / 4;
        //console.log("mast rotation: " + boatParams.mastrotation);

    }

    water.material.uniforms['time'].value += 1.0 / 60.0;

    //camera.lookAt(cameraTarget);

    renderer.render(scene, camera);

}

// returns mainsheet length in mm
function recalcMainSheet() {
    mainSheetGeometry.verticesNeedUpdate = true;
    let sailTackVerticeIndex = Math.ceil(sailTackHeight / sailLevelHeight + 1 ) * sailVerticesPerLevel - 1;
    let tackWorldVector = sail.localToWorld(sailGeometry.vertices[sailTackVerticeIndex].clone());
    let tackVector = mainSheet.worldToLocal(tackWorldVector);
    mainSheetGeometry.vertices[0].copy(tackVector);
    return mainSheetGeometry.vertices[1].distanceTo(tackVector);  
}



function calcMastRotation(apparentWind) {
    let mastAngleOfAttack = 25.0 * Math.max(50-apparentWind.aws, 0)/50;
    if (Math.abs(apparentWind.awa) < 10) {
        mastAngleOfAttack = 0;
    }
    let mastRotation = Math.min(Math.abs(apparentWind.awa) + mastAngleOfAttack, 75.0); // add 10 degrees angle of attack to aparrent wind // TODO depends on wind-speed????
    let actualMastAngleOfAttack = mastRotation - Math.abs(apparentWind.awa);
    return { mastRotation: mastRotation, mastAngleOfAttack: actualMastAngleOfAttack };
}

function recalcSailShape(windspeed, sog, cog) {
    let tws = windSheer(windspeed, height);
    let aw = apparentWind(sog, cog, tws, 0);
}

function recalcApparentWindField(windspeed, sog, cog, hellman) {
    for (let height = 0; height < 11; height += 0.5) {
        let tws = windSheer(windspeed, height, hellman);
        let aw = apparentWind(sog, cog, tws, 0);
        let cone = apparentwindfield[height * 2];
        cone.scale.set(aw.aws * 0.1, aw.aws, aw.aws * 0.1)
        cone.rotation.set(0, - aw.awd * Math.PI / 180, Math.PI / 2);
        //cone.rotation.y = - aw.awd * Math.PI / 180;
    }
}

function recalcWindField(windspeed, hellman) {

    let pos, height;
    for (height = 1; height < 11; height++) {
        let windspeedfactor = windSheer(windspeed, height, hellman);
        for (pos = 0; pos <= 10; pos++) {
            windfield[height][pos].scale.set(windspeedfactor * 0.1, windspeedfactor, windspeedfactor * 0.1);
        }
    }
}


//=========== setup speed conversions

function ms2kts(ms) {
    return ms * 1.9438444924574;
}

function kts2ms(kts) {
    return kts / 1.9438444924574;
}

// windspeed at 10m
// returns wind speed at target height
function windSheer(windspeed, height , hellman) {
    // https://en.wikipedia.org/wiki/Wind_gradient
    let v10 = kts2ms(windspeed);
    let height10 = 10;
    //let hellman = 0.27; // alpha
    let v = v10 * (Math.pow((height / height10), hellman));
    //console.log(v);
    return (ms2kts(v));

    // location	α ... hellman constant for wind condition
    // Unstable air above open water surface:	0.06
    // Neutral air above open water surface:	0.10
    // Unstable air above flat open coast:	0.11
    // Neutral air above flat open coast:	0.16
    // Stable air above open water surface:	0.27
    // Unstable air above human inhabited areas:	0.27
    // Neutral air above human inhabited areas:	0.34
    // Stable air above flat open coast:	0.40
    // Stable air above human inhabited areas:	0.60
    return
}

// https://en.wikipedia.org/wiki/Apparent_wind
// sog ... speed over ground (boat speed)
// cog ... course over ground (boat direction in grad)
// tws ... true wind speed in kts
// twd ... true wind direction (grad)
// returns {
//    apparent wind speed, 
//    apparent wind-angle relative to boat (grad), 
//    apparent winddirection (grad)}
function apparentWind(sog, cog, tws, twd) {
    let twa = twd - cog;
    if (twa < 0) {
        twa = 360 + twa;
    }
    let cosTWA = Math.cos((twa * Math.PI / 180));
    let aws = Math.sqrt(tws**2 + sog**2 + (2 * tws * sog * cosTWA));
    let apparentWindAngle = 0.0;
    if (aws > 0.0) { // tws and boatspeed can annulate each other, or wind can be 0 
        let Q = (tws * cosTWA + sog) / aws;
        if (Q > 1.0) { // fix rounding errors, C must not be greater 1.0, or the arcuscosine will fail
            Q = 1.0;
        } else if (Q < -1.0) { // fix rounding errors, C must not be greater 1.0, or the arcuscosine will fail
            Q = -1.0;
        }
        apparentWindAngle = Math.acos(Q);
        if (isNaN(apparentWindAngle)) {
            console.log("apparentWind(acosBeta=NaN Q:" + Q);
        }
    }

    let awa = twa <= 0 || twa > 180 ? - apparentWindAngle * 180 / Math.PI : apparentWindAngle * 180 / Math.PI;
    let awd = cog + awa;
    return { aws: aws, awa: awa, awd: awd };
}



