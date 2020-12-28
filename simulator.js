"use strict";

import * as THREE from './three.module.js';
import Stats from './stats.module.js';
import { STLLoader } from './STLLoader.js';
import { OrbitControls } from "./OrbitControls.js";
import { GUI } from './dat.gui.module.js';
import { Water } from './Water.js';
import { Sky } from './Sky.js';
import * as Wind from "./Wind.js";
import SailShape from './SailShape.js';

function getURLParameter(sParam) {
    let sPageURL = window.location.search.substring(1);
    //console.log("pageurl: " + sPageURL);
    let sURLVariables = sPageURL.split('&');
    for (var i = 0; i < sURLVariables.length; i++) {
        var sParameterName = sURLVariables[i].split('=');
        if (sParameterName[0] == sParam) {
            //console.log("param: " + sParam + "=" + sParameterName[1]);
            return sParameterName[1];
        }
    }
    return null;
}

const sailShape = new SailShape();

let showWater = true;
let debugHelperAxes = false;

let container, stats;

let camera, controls, cameraTarget, scene, renderer;
let water, sun, mesh;

let boat, mast, sailtop, sailfoot, mainsheet;

let windfield = [];

let apparentwindfield = [];

let loadingComplete = false;

const boatLimits = {
    maxSpeed: 35, 
    minHeading: -180, // [grad]
    maxHeading: 180   // [grad]
}

const windLimits = {
    maxSpeed: 30,
}


const boatParams = {
    mastrotation: 0.0, // [grad]
    heading: 0.0, // [grad]
    speed: 5.0, // [kts]
    details: true, 
    vmg: 0.0
}

const windConditions = { unstable: 0.06, neutral: 0.10, stable: 0.27 };    
const windParams = {
    speed: 5.0, // [kts]
    hellman: 0.27
}

const sailParams = {
    mastArea: 0,
    sailArea: 0
}

const cameraDefaults = {
    height: 10, // [m]
    aside: 8, // [m]
    along: 8 // [m]
}

const cameraParams = {
    height: cameraDefaults.height, // [m]
    aside: cameraDefaults.aside, // [m]
    along: cameraDefaults.along // [m]
}

const cameraLimits = {
    height: { min: 0, max: 100},
    aside: { min: -100, max: 100 },
    along: { min: -100, max: 100 }
}


function getUrlParameters() {
    let boatSpeed = parseFloat(getURLParameter("boat.speed"));
    if (boatSpeed >= 0 && boatSpeed <= boatLimits.maxSpeed)
    {
        boatParams.speed = boatSpeed; 
    }
    let boatHeading = parseFloat(getURLParameter("boat.heading"));
    if (boatHeading >= boatLimits.minHeading && boatSpeed <= boatLimits.maxHeading)
    {
        boatParams.heading = boatHeading; 
    }
    let windSpeed = parseFloat(getURLParameter("wind.speed"));
    if (windSpeed > 0 && windSpeed <= windLimits.maxSpeed)
    {
        windParams.speed = windSpeed; 
    }   

    let cameraHeight = parseFloat(getURLParameter("camera.height"));
    if (cameraHeight >= cameraLimits.height.min && cameraHeight <= cameraLimits.height.max)
    {
        cameraParams.height = cameraHeight; 
    }

    let cameraAside = parseFloat(getURLParameter("camera.aside"));
    if (cameraAside >= cameraLimits.aside.min && cameraAside <= cameraLimits.aside.max)
    {
        cameraParams.aside = cameraAside; 
    }

    let cameraAlong = parseFloat(getURLParameter("camera.along"));
    if (cameraAlong >= cameraLimits.along.min && cameraAlong <= cameraLimits.along.max)
    {
        cameraParams.along = cameraAlong; 
    }

    let windHellman = parseFloat(getURLParameter("wind.hellman"));
    if (windHellman >= windConditions.unstable && windHellman <= windConditions.stable)
    {
        windParams.hellman = windHellman; 
    }

}
getUrlParameters();






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

    camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 1, 20000);
    camera.position.set(cameraParams.along, cameraParams.height, cameraParams.aside);
    const cameraHelper = new THREE.CameraHelper(camera);

    scene = new THREE.Scene();
    //scene.fog = new THREE.Fog(0x72645b, 5, 1000);

    if (debugHelperAxes) {
        scene.add(cameraHelper);
    }

    // renderer
    controls = new OrbitControls(camera, renderer.domElement);
    controls.maxPolarAngle = Math.PI * 0.495;
    controls.target.set(0, 5, 0);
    controls.minDistance = 1.0;
    controls.maxDistance = 1000.0;
    controls.enableKeys = false;
    controls.update();

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

    sun = new THREE.Vector3();
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


    // Stats
    stats = new Stats();
    container.appendChild(stats.dom);

    // Controls GUI
    const gui = new GUI();

    const folderSky = gui.addFolder('Sky');
    folderSky.add(parameters, 'inclination', 0, 0.5, 0.0001).onChange(updateSun);
    folderSky.add(parameters, 'azimuth', 0, 1, 0.0001).onChange(updateSun);
    //folderSky.open();
    if (!debugHelperAxes) {
        folderSky.hide();
    }

    const waterUniforms = water.material.uniforms;

    const folderWater = gui.addFolder('Water');
    folderWater.add(waterUniforms.distortionScale, 'value', 0, 8, 0.1).name('distortionScale');
    folderWater.add(waterUniforms.size, 'value', 0.1, 10, 0.1).name('size');
    folderWater.add(waterUniforms.alpha, 'value', 0.9, 1, .001).name('alpha');
    //folderWater.open();
    if (!debugHelperAxes) {
        folderWater.hide();
    }

    
    function buildStateUrl() {
        return "?boat.heading=" + boatParams.heading + "&boat.speed=" + boatParams.speed + "&wind.speed=" + windParams.speed + "&wind.hellman=" + windParams.hellman
            + "&camera.height=" + camera.position.y.toFixed(1) + "&camera.aside=" + camera.position.z.toFixed(1) + "&camera.along=" + camera.position.x.toFixed(1);
    }

    const folderBoat = gui.addFolder('Boat');
    //folderBoat.add(boatParams, 'mastrotation', -90, 90, 1).name('mastrotation').listen(); // add .listen() to receive updates!!
    folderBoat.add(boatParams, 'heading', -180, 180, 1).name('heading').onChange(recalc).listen();
    folderBoat.add(boatParams, 'speed', 0, 30, 1).name('speed').onChange(recalc).listen();
    folderBoat.add(boatParams, 'details').name("details"); 
    folderBoat.open();

    const folderWind = gui.addFolder('Wind');
    folderWind.add(windParams, 'speed', 0, 30, 1).name('speed').onChange(recalc).listen();
    folderWind.add(windParams, 'hellman', windConditions).name('condition').onChange(recalc);
    folderWind.open();

    function shareSimulatorView() {
        window.history.pushState({}, "Attwerwind simulator position URL", buildStateUrl());    
    }
    document.getElementById("shareLink").onclick = shareSimulatorView;
    let fActionShare = { share:function(){ 
                            shareSimulatorView();
                        }};
    const folderActions = gui.addFolder("Actions");
    folderActions.add(fActionShare,'share').name('share view');

    const folderPresets = gui.addFolder("Presets");
    let fActionDownwindFoiling = { downfoil:function(){ boatParams.heading = 135; boatParams.speed = 22; windParams.speed = 15 }};
    folderPresets.add(fActionDownwindFoiling,'downfoil').name('downwind foiling');
    let fActionUpwindFoiling = { upfoil:function(){ boatParams.heading = 50; boatParams.speed = 17; windParams.speed = 15 }};
    folderPresets.add(fActionUpwindFoiling,'upfoil').name('upwind foiling');
    let fActionUpwindFlying = { upfly:function(){ boatParams.heading = 47; boatParams.speed = 9; windParams.speed = 10 }};
    folderPresets.add(fActionUpwindFlying,'upfly').name('upwind');
    let fActionDownwindLight = { downlight:function(){ boatParams.heading = 135; boatParams.speed = 5; windParams.speed = 5 }};
    folderPresets.add(fActionDownwindLight,'downlight').name('downwind light');
    let fActionUpwindLight = { uplight:function(){ boatParams.heading = 48; boatParams.speed = 3; windParams.speed = 5 }};
    folderPresets.add(fActionUpwindLight,'uplight').name('upwind light');
    let fActionCameraReset = { camera:function(){ 
        cameraParams.height = cameraDefaults.height; cameraParams.along = cameraDefaults.along; cameraParams.aside = cameraDefaults.aside;     
        camera.position.set(cameraParams.along, cameraParams.height, cameraParams.aside);
        controls.update();
        // TODO NOT PERFECT YET
    }};
    folderPresets.add(fActionCameraReset,'camera').name('reset camera');




    //--- Wind ----------------------------------------------------------------------------------------------------------

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

    windGroup.position.set(7.5, 0, 0);
    scene.add(windGroup);


    //--- 3D Models ----------------------------------------------------------------------------------------------------------

    THREE.DefaultLoadingManager.onStart = function (url, itemsLoaded, itemsTotal) {
        //console.log('Started loading file: ' + url + '.\nLoaded ' + itemsLoaded + ' of ' + itemsTotal + ' files.');
    };

    THREE.DefaultLoadingManager.onLoad = function () {
        loadingComplete = true;
        document.getElementById("loading").style.display = "none";
    };

    THREE.DefaultLoadingManager.onProgress = function (url, itemsLoaded, itemsTotal) {
        //console.log('Loading file: ' + url + '.\nLoaded ' + itemsLoaded + ' of ' + itemsTotal + ' files.');
    };

    THREE.DefaultLoadingManager.onError = function (url) {
        //console.log('There was an error loading ' + url);
    };


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

        if (debugHelperAxes) {
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
            mast.rotation.set(- grad2rad(90), 0, - grad2rad(4));
            mast.castShadow = true;
            mast.receiveShadow = true;

            if (debugHelperAxes) {
                const axes = new THREE.AxesHelper();
                axes.material.depthTest = false;
                axes.renderOrder = 1;
                axes.scale.set(1000, 1000, 1000);
                mast.add(axes);
            }

            mast.add(rigSail());
            boat.add(mast);

            const mainSheetMaterial = new THREE.LineBasicMaterial({ color: 0x8f0f0f });
            const points = [];
            points.push(new THREE.Vector3(0, 0, 0));
            points.push(new THREE.Vector3(-2450, 30, 290));

            mainSheetGeometry = new THREE.Geometry().setFromPoints(points);
            mainSheet = new THREE.Line(mainSheetGeometry, mainSheetMaterial);
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
const sailVerticesPerLevel = Math.floor(1000 / sailLevelHeight);
const sailLevels = Math.ceil(sailHeight / sailLevelHeight);
const sailTackHeight = 900; // mm
const sailTackMastDistance = 2125; // mm
const sailMastWidth = 140; // mm
let sail, sailGeometry, sailClipWidthPerLevel;
let mainSheet, mainSheetGeometry;
let travellerVector = new THREE.Vector3();

function rigSail() {
    const tackMastDistance = sailTackMastDistance;
    const decksweeper = 900;
    const topMastDistance = 400; // mm
    const leechCurvature = 200; //mm

    let luffAxis = new THREE.Vector3(0, 0, 1);


    sail = new THREE.Group();
    sailGeometry = new THREE.Geometry();
    sailClipWidthPerLevel = [];


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
            sailWidth += Math.sin((height - sailTackHeight) / (sailHeight - sailTackHeight) * Math.PI) * leechCurvature;
            clipOffWidth = sailWidth;
        }

        // add horizontal vertices 
        let lastvector;
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
            } else {
                vector = new THREE.Vector3(0, segwidth, 0);
                vector.add(lastvector);
            }
            lastvector = vector;
            sailGeometry.vertices.push(vector);

        }

        sailClipWidthPerLevel.push(clipOffWidth == sailWidth ? null : clipOffWidth);


    }

    //let v0 = sailgeometry.vertices[0].clone();
    //let vrot = v0.sub(sailgeometry.vertices[2]).normalize();
    //sailgeometry.vertices[1].applyAxisAngle(luffAxis, Math.PI / 4);

    for (let level = 0; level < sailLevels; level++) {
        //for (let level = 0; level <= 2; level++) {
        for (let v = 1; v < sailVerticesPerLevel; v++) {
            let i = level * sailVerticesPerLevel + v;
            let f1 = new THREE.Face3(i - 1, i, i + sailVerticesPerLevel - 1);
            let f2 = new THREE.Face3(i, i + sailVerticesPerLevel, i + sailVerticesPerLevel - 1);
            if (level % 10) {
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
    sailParams.mastArea = (sailMastWidth * sailHeight) / 1000000; // m2
    sailParams.sailArea = calcGeometryArea(sailGeometry) / 1000000; // m2

    //let sailmaterial = new THREE.MeshStandardMaterial({ vertexColors: THREE.FaceColors, color: 0xFFE0E0, opacity: 0.7, transparent: true, side: THREE.DoubleSide });
    let sailmaterial = new THREE.MeshBasicMaterial({ vertexColors: THREE.FaceColors, side: THREE.DoubleSide, opacity: 0.7, transparent: true });
    let sailmesh = new THREE.Mesh(sailGeometry, sailmaterial);
    sail.rotation.set(Math.PI / 2, 0, Math.PI / 2);
    sail.position.set(-130, 9040, 0)
    sail.add(sailmesh);
    //mast.add(sail);
    return sail;


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
    return rad * 180 / Math.PI;
}

function grad2rad(grad) {
    return grad * Math.PI / 180;
}


let lastWindSpeed, lastBoatSpeed, lastBoatHeading, lastHellman, lastMainSheetLength, lastMastrotation = 0;
let flatSailgeometry = null;
function render() {

    //const timer = Date.now() * 0.0005;

    const time = performance.now() * 0.0025;

    //camera.position.x = Math.cos(timer) * 3;
    //camera.position.z = Math.sin(timer) * 3;


    if (loadingComplete && boat) {
        let boatHeadingRad = grad2rad(boatParams.heading);

        if (false) {
            boat.rotation.x = - Math.PI / 2 + Math.sin(time) * 0.01;
            boat.rotation.y = Math.cos(time) * 0.034;
            boat.rotation.z = Math.cos(time) * 0.01 - Math.sin(time) * 0.02 - boatHeadingRad;
        } else {
            boat.rotation.z = - boatHeadingRad;
        }

        let mainSheetLength = Math.round(recalcMainSheet());


        //mast.rotation.y = boatParams.mastrotation * Math.PI / 180.0;
        //if (boatParams.mastrotation != lastMastrotation) {
        // TODO : leverage update() functions to set a "dirty" flag instead of this list of comparisons
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
            let mastFootOverWaterHeight = (boat.position.y + 0.2) * 1000;

            if (!flatSailgeometry) {
                flatSailgeometry = sailGeometry.clone();
            }

            //#####################################################################
            // TODO: the higher the apparent wind speed, the flatter the sail!!! 
            // TODO: create functions for mast-rotation in dependence on heading and (wind)speed
            // TODO: create line for mainsheet and display length of it --- implies traveller!!!!
            // mast and luff rotation

            let dirfact = boatHeadingRad < 0 ? 1.0 : -1.0; // direction factor 
            sailShape.calcShape(sailTackMastDistance, sailMastWidth); //############################# ## # ## # #TODOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOO************************### consants!!!

            let aw = Wind.apparentWind(boatParams.speed, boatHeadingRad, windParams.speed, 0);
            //let mr = calcMastRotation(aw)

            let chordAngleOfAttackRad = grad2rad(20); // optimal angle of attack for 10% camber; http://www.onemetre.net/design/Entry/entry.htm
            const maxMastRotationRad = Math.PI / 2;
            const maxChordRotationPerSailLevelRad = Math.PI/2 / sailLevels;

            let absAwaRad = Math.abs(aw.awa);
            let mastEntryAngleRad = sailShape.getMastAngle(sailMastWidth);
            if (absAwaRad < 0.01) {  //TODO################
                 chordAngleOfAttackRad = 0;
                mastEntryAngleRad = 0;
            } 
            //console.log("absawa: " + absAwa + " mastangleofattack: " + mastEntryAngle);

            let mastRotationRad = Math.min(absAwaRad + chordAngleOfAttackRad - mastEntryAngleRad, maxMastRotationRad); // add 10 degrees angle of attack to aparrent wind // TODO depends on wind-speed????

            // adjust sailshape
            let luffAxis = new THREE.Vector3(0, 0, 1);
            let power = 0.0;
            let lastChordRotationRad = null;
            for (let level = 0; level <= sailLevels; level++) {
                let overWaterHeight = level * sailLevelHeight + mastFootOverWaterHeight;
                let tws = Wind.windSheer(windParams.speed, overWaterHeight / 1000.0, windParams.hellman);
                let aw = Wind.apparentWind(boatParams.speed, boatHeadingRad, tws, 0);
                let levelAbsAwaRad = Math.abs(aw.awa);


                let chordAngleRad = levelAbsAwaRad - chordAngleOfAttackRad;
                if (chordAngleRad < 0) {
                    chordAngleRad = 0;
                } else if (chordAngleRad > Math.PI/2) {
                    chordAngleRad = Math.PI/2;
                }
    
                let chordRotationRad = chordAngleRad - mastRotationRad;
                if (lastChordRotationRad && ((chordRotationRad - lastChordRotationRad) > maxChordRotationPerSailLevelRad)) {
                    chordRotationRad = lastChordRotationRad + maxChordRotationPerSailLevelRad;
                }
                lastChordRotationRad = chordRotationRad;

                if (aw.aws > 25) {
                    power += aw.aws; // sum up all wind speeds
                }

                let clipWidth = sailClipWidthPerLevel[level];
                /*if (clipWidth) {
                    console.log("zero vertice level: " + level + " clipWidth: " + clipWidth.toFixed(2));
                }*/
                let verticeAnglesRad = sailShape.getVerticesAngles(sailVerticesPerLevel, sailMastWidth, clipWidth);

                // apply rotation to the sail-points according to the parabolic sailshape
                let lastrot = 0;
                for (let v = 1; v < sailVerticesPerLevel; v++) {
                    let i = level * sailVerticesPerLevel + v;
                    sailGeometry.vertices[i].copy(flatSailgeometry.vertices[i]);
                    sailGeometry.vertices[i].applyAxisAngle(luffAxis, -(chordRotationRad + verticeAnglesRad[v]) * dirfact);
                }



            }
            power /= sailLevels;
            sailGeometry.verticesNeedUpdate = true;

            recalcWindField(windParams.speed, windParams.hellman);
            recalcApparentWindField(windParams.speed, boatParams.speed, boatHeadingRad, windParams.hellman);

            boatParams.vmg = Math.abs(boatParams.speed * Math.cos(boatHeadingRad));
            boatParams.mastrotation = rad2grad(mastRotationRad)*dirfact;

            mast.rotateY(grad2rad(boatParams.mastrotation - lastMastrotation));
            //mast.rotation.y = grad2rad(boatParams.mastrotation);

            dataDiv.innerHTML = "Mast rotation: " + Math.round(boatParams.mastrotation) +
                "° <br> Mast angle of attack: " + rad2grad(mastEntryAngleRad).toFixed(1) + "°" +
                "<br>Apparent wind speed: " + Math.round(aw.aws) + "kts" +
                "<br>Apparent wind angle: " + Math.round(rad2grad(absAwaRad)) + "°" +
                "<br>Sail area: " + (sailParams.mastArea + sailParams.sailArea).toFixed(2) + "m² (mast: " + sailParams.mastArea.toFixed(2) + "m², sail: " + sailParams.sailArea.toFixed(2) + "m²)" + //&sup2;
                "<br>Mast foot over water: " + (mastFootOverWaterHeight / 1000).toFixed(1) + "m" +
                "<br>Mainsheet give: " + Math.round(mainSheetLength / 10 - 83) + "cm" +
                "<br>VMG: " + boatParams.vmg.toFixed(1) + "kts" +
                "<br>Apparent wind power: " + power.toFixed(1) + "kts average over sail" +
                "<br>lastrot: "  +
                "<br>deltarot: " ;

            lastMastrotation = boatParams.mastrotation;
            lastBoatHeading = boatParams.heading;
            lastBoatSpeed = boatParams.speed;
            lastHellman = windParams.hellman;
            lastWindSpeed = windParams.speed;
            lastMainSheetLength = mainSheetLength;

        }



    }

    water.material.uniforms['time'].value += 1.0 / 60.0;

    renderer.render(scene, camera);

}

// returns mainsheet length in mm
function recalcMainSheet() {
    mainSheetGeometry.verticesNeedUpdate = true;
    let sailTackVerticeIndex = Math.ceil(sailTackHeight / sailLevelHeight + 1) * sailVerticesPerLevel - 1;
    let tackWorldVector = sail.localToWorld(sailGeometry.vertices[sailTackVerticeIndex].clone());
    let tackVector = mainSheet.worldToLocal(tackWorldVector);
    mainSheetGeometry.vertices[0].copy(tackVector);
    return mainSheetGeometry.vertices[1].distanceTo(tackVector);
}


/* 
    function recalcSailShape(windspeed, sog, cog) {
    let tws = Wind.windSheer(windspeed, height);
    let aw = Wind.apparentWind(sog, cog, tws, 0);
} */

function recalcApparentWindField(windspeed, sog, cog, hellman) {
    for (let height = 0; height < 11; height += 0.5) {
        let tws = Wind.windSheer(windspeed, height, hellman);
        let aw = Wind.apparentWind(sog, cog, tws, 0);
        let cone = apparentwindfield[height * 2];
        cone.scale.set(aw.aws * 0.1, aw.aws, aw.aws * 0.1)
        cone.rotation.set(0, - aw.awd, Math.PI / 2);
    }
}

function recalcWindField(windspeed, hellman) {

    let pos, height;
    for (height = 1; height < 11; height++) {
        let windspeedfactor = Wind.windSheer(windspeed, height, hellman);
        for (pos = 0; pos <= 10; pos++) {
            windfield[height][pos].scale.set(windspeedfactor * 0.1, windspeedfactor, windspeedfactor * 0.1);
        }
    }
}


// ============ keyboard handling =====================

setupKeyControls();

function setupKeyControls() {
    //let snowman = scene.getObjectByName('snowman');
    document.addEventListener("keydown", (event) => {
        //console.log(`key=${event.key},code=${event.code}`);
        switch(event.code) {
            case "ArrowUp" : 
                if (boatParams.speed < 30) {
                    boatParams.speed += 1;
                }
                break;
            case "ArrowDown" : 
                if (boatParams.speed > 0) {
                    boatParams.speed -= 1;
                }
                break;
            case "ArrowLeft" : 
                if (boatParams.heading > -180) {
                    boatParams.heading -= 1;
                } else {
                    boatParams.heading = 180;
                }
                break;
            case "ArrowRight" : 
                if (boatParams.heading < 180) {
                    boatParams.heading += 1;
                } else {
                    boatParams.heading = -180;
                }
                break;
            }
    });
};


