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

let showWater = true;
let debugHelperAxes = false;

let container, stats;

let camera, controls, cameraTarget, scene, renderer;
let water, sun, mesh;

let boat, mast, traveller, travellerCar;

let windfield = [];

let apparentwindfield = [];

let loadingComplete = false;

const boatLimits = {
    maxSpeed: 35, // [kn]
    minHeading: -180, // [grad]
    maxHeading: 180,   // [grad]
    minFoilingSpeed: 13,  // [kn]
    foilingBoatLift: 0.52,  // [m] (approx)
    waterlineToMastFootHeight: 0.45, // [m]  (approx)
    maxTraveller: 800 //mm
}


const windLimits = {
    maxSpeed: 30,
}


const boatParams = {
    mastrotation: 0.0, // [grad]
    heading: 0.0, // [grad]
    speed: 5.0, // [kn]
    details: false, 
    vmg: 0.0
}

const travellerParams = {
    position: 0, // [m] measured as tangent along the aft traveller radius
    minPosition: -0.8, //  [m]
    maxPosition: 0.8  // [m]
}

const windConditions = { unstable: 0.06, neutral: 0.10, stable: 0.27 };    
const windParams = {
    speed: 5.0, // [kn]
    hellman: 0.27
}

const sailDefaults = {
    angleOfAttack: 20,
    cunningham: 1
}

const sailLimits = {
    minAngleOfAttack: 10,
    maxAngleOfAttack: 25,
    minCunningham: 1,
    maxCunningham: 10
}

const sailParams = {
    mastArea: 0,
    sailArea: 0,
    cunningham: 1,
    angleOfAttack: sailDefaults.angleOfAttack,
}

const cameraDefaults = {
    height: 10, // [m]
    aside: 8, // [m]
    along: 8, // [m]
    targetAlong: 0, // x
    targetHeight: 5,  // y
    targetAside: 0, // z
}

const cameraParams = {
    height: cameraDefaults.height, // [m]
    aside: cameraDefaults.aside, // [m]
    along: cameraDefaults.along, // [m]
    targetAlong: cameraDefaults.targetAlong, // x
    targetHeight: cameraDefaults.targetHeight,  // y
    targetAside: cameraDefaults.targetAside, // z
    rotationX: 0, // [grad]
    rotationY: 0, // [grad]
    rotationZ: 0, // [grad]
    syncRotation: false // synchronize boat heading with camera rotation
}

const cameraLimits = {
    height: { min: 0, max: 100},
    aside: { min: -100, max: 100 },
    along: { min: -100, max: 100 }
}


function getUrlParameters() {
    let boatSpeed = parseFloat(getURLParameter("bs"));
    if (boatSpeed >= 0 && boatSpeed <= boatLimits.maxSpeed)
    {
        boatParams.speed = boatSpeed; 
    }
    let boatHeading = parseFloat(getURLParameter("bh"));
    if (boatHeading >= boatLimits.minHeading && boatSpeed <= boatLimits.maxHeading)
    {
        boatParams.heading = boatHeading; 
    }
    let windSpeed = parseFloat(getURLParameter("ws"));
    if (windSpeed > 0 && windSpeed <= windLimits.maxSpeed)
    {
        windParams.speed = windSpeed; 
    }   

    let cameraHeight = parseFloat(getURLParameter("ch"));
    if (cameraHeight >= cameraLimits.height.min && cameraHeight <= cameraLimits.height.max)
    {
        cameraParams.height = cameraHeight; 
    }
    let cameraAside = parseFloat(getURLParameter("cs"));
    if (cameraAside >= cameraLimits.aside.min && cameraAside <= cameraLimits.aside.max)
    {
        cameraParams.aside = cameraAside; 
    }
    let cameraAlong = parseFloat(getURLParameter("cl"));
    if (cameraAlong >= cameraLimits.along.min && cameraAlong <= cameraLimits.along.max)
    {
        cameraParams.along = cameraAlong; 
    }

    let cameraRotationX = parseFloat(getURLParameter("crx"));
    if (cameraRotationX >= -360 && cameraRotationX <= 360)
    {
        cameraParams.rotationX = cameraRotationX; 
    }
    let cameraRotationY = parseFloat(getURLParameter("cry"));
    if (cameraRotationY >= -360 && cameraRotationY <= 360)
    {
        cameraParams.rotationY = cameraRotationY; 
    }
    let cameraRotationZ = parseFloat(getURLParameter("crz"));
    if (cameraRotationZ >= -360 && cameraRotationX <= 360)
    {
        cameraParams.rotationZ = cameraRotationZ; 
    }

    let windHellman = parseFloat(getURLParameter("wh"));
    if (windHellman >= windConditions.unstable && windHellman <= windConditions.stable)
    {
        windParams.hellman = windHellman; 
    }

    let cameraTargetAlong = parseFloat(getURLParameter("ctl"));
    if (cameraTargetAlong >= cameraLimits.along.min && cameraTargetAlong <= cameraLimits.along.max)
    {
        cameraParams.targetAlong = cameraTargetAlong; 
    }
    let cameraTargetAside = parseFloat(getURLParameter("cts"));
    if (cameraTargetAside >= cameraLimits.aside.min && cameraTargetAside <= cameraLimits.aside.max)
    {
        cameraParams.targetAside = cameraTargetAside; 
    }
    let cameraTargetHeight = parseFloat(getURLParameter("cth"));
    if (cameraTargetHeight >= cameraLimits.height.min && cameraTargetHeight <= cameraLimits.height.max)
    {
        cameraParams.targetHeight = cameraTargetHeight; 
    }
    let cameraSyncHeading = parseInt(getURLParameter("csh"));
    if (cameraSyncHeading == 1) {
        cameraParams.syncRotation = true;
    } else {
        cameraParams.syncRotation = false;
    }
    let viewDetails = parseInt(getURLParameter("vd"));
    if (viewDetails == 1) {
        boatParams.details = true;
    } // ignore details off
    let sailAngleOfAttack = parseFloat(getURLParameter("saa"));
    if (sailAngleOfAttack >= sailLimits.minAngleOfAttack && sailAngleOfAttack <= sailLimits.maxAngleOfAttack)
    {
        sailParams.angleOfAttack = sailAngleOfAttack;
    }
    let sailCunningham = parseFloat(getURLParameter("sc"));
    if (sailCunningham >= sailLimits.minCunningham && sailCunningham <= sailLimits.maxCunningham)
    {
        sailParams.cunningham = sailCunningham;
    }


}


let dataDiv;
getUrlParameters();
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
    camera.rotation.set(grad2rad(cameraParams.rotationX), grad2rad(cameraParams.rotationY), grad2rad(cameraParams.rotationZ));
    const cameraHelper = new THREE.CameraHelper(camera);

    scene = new THREE.Scene();
    //scene.fog = new THREE.Fog(0x72645b, 5, 1000);

    if (debugHelperAxes) {
        scene.add(cameraHelper);
    }

    // renderer
    controls = new OrbitControls(camera, renderer.domElement);
    controls.maxPolarAngle = Math.PI * 0.495;
    controls.target.set(cameraParams.targetAlong, cameraParams.targetHeight, cameraParams.targetAside);
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
        return "?bh=" + boatParams.heading 
            + "&bs=" + boatParams.speed 
            + "&ws=" + windParams.speed 
            + "&wh=" + windParams.hellman
            + "&ch=" + camera.position.y.toFixed(1) 
            + "&cs=" + camera.position.z.toFixed(1) 
            + "&cl=" + camera.position.x.toFixed(1)
            + "&cry=" + rad2grad(camera.rotation.y).toFixed(1) 
            + "&crz=" + rad2grad(camera.rotation.z).toFixed(1) 
            + "&crx=" + rad2grad(camera.rotation.x).toFixed(1)
            + "&cth=" + controls.target.y.toFixed(1) 
            + "&cts=" + controls.target.z.toFixed(1) 
            + "&ctl=" + controls.target.x.toFixed(1)
            + (cameraParams.syncRotation ? "&csh=1" : "") 
            + (sailDefaults.angleOfAttack != sailParams.angleOfAttack ? "&saa=" + Math.round(sailParams.angleOfAttack) : "")
            + (boatParams.details ? "&vd=1" : "") 
            + (sailParams.cunningham != sailDefaults.cunningham ? "&sc=" + sailParams.cunningham : "");
    }

    const folderWind = gui.addFolder('Wind');
    folderWind.add(windParams, 'speed', 0, windLimits.maxSpeed, 1).name('speed [kn]').onChange(recalcBoatConfigurationOnNextAnimationFrame).listen();
    folderWind.add(windParams, 'hellman', windConditions).name('condition').onChange(recalcBoatConfigurationOnNextAnimationFrame);
    folderWind.open();

    const folderBoat = gui.addFolder('Boat');
    folderBoat.add(boatParams, 'heading', boatLimits.minHeading, boatLimits.maxHeading, 1).name('heading [°]').onChange(recalcBoatConfigurationOnNextAnimationFrame).listen();
    folderBoat.add(boatParams, 'speed', 0, boatLimits.maxSpeed, 1).name('speed  [kn]').onChange(recalcBoatConfigurationOnNextAnimationFrame).listen();
    folderBoat.open();

    function shareSimulatorView() {
        let url = buildStateUrl();
        window.history.pushState({}, "Attwerwind simulator position URL", url);    
        let modal = document.getElementById("shareUrlPopup");
        modal.style.display = "block";
        let hostname = window.location.hostname == "localhost" ? "" : "https://simulator.atterwind.info";
        let modalBody = document.getElementById("shareUrlPopupContent");
        modalBody.innerHTML = "<a href=" + hostname + url + ">" + hostname + url + "</a>";
    }
    document.getElementById("shareLink").onclick = shareSimulatorView;
    let fViewShare = { share:function(){ 
                            shareSimulatorView();
                        }};

    const folderView = gui.addFolder("View");
    folderView.add(cameraParams, 'syncRotation').name("sync with heading").onChange(()=>{ firstTimeRotationSync = true; }); 
    //TODO rotation sync jumps a bit when using first timme
    folderView.add(boatParams, 'details').name("show trim details").onChange(recalcBoatConfigurationOnNextAnimationFrame); 
    folderView.add(fViewShare,'share').name('share current view');
    let fViewDownwindFoiling = { downfoil:function(){ boatParams.heading = 135; boatParams.speed = 22; windParams.speed = 15; recalcBoatConfigurationOnNextAnimationFrame();  }};
    folderView.add(fViewDownwindFoiling,'downfoil').name('downwind foiling');
    let fViewUpwindFoiling = { upfoil:function(){ boatParams.heading = 50; boatParams.speed = 17; windParams.speed = 15; recalcBoatConfigurationOnNextAnimationFrame();  }};
    folderView.add(fViewUpwindFoiling,'upfoil').name('upwind foiling');
    let fViewUpwindFlying = { upfly:function(){ boatParams.heading = 47; boatParams.speed = 9; windParams.speed = 10; recalcBoatConfigurationOnNextAnimationFrame();  }};
    folderView.add(fViewUpwindFlying,'upfly').name('upwind');
    let fViewDownwindLight = { downlight:function(){ boatParams.heading = 135; boatParams.speed = 5; windParams.speed = 5; recalcBoatConfigurationOnNextAnimationFrame();  }};
    folderView.add(fViewDownwindLight,'downlight').name('downwind light');
    let fViewUpwindLight = { uplight:function(){ boatParams.heading = 48; boatParams.speed = 3; windParams.speed = 5; recalcBoatConfigurationOnNextAnimationFrame(); }};
    folderView.add(fViewUpwindLight,'uplight').name('upwind light');
    let fViewCameraReset = { camera:function(){ 
        cameraParams.height = cameraDefaults.height; cameraParams.along = cameraDefaults.along; cameraParams.aside = cameraDefaults.aside;     
        camera.position.set(cameraParams.along, cameraParams.height, cameraParams.aside);
        cameraParams.rotationX = cameraParams.rotationY = cameraParams.rotationZ = 0;
        camera.rotation.set(grad2rad(cameraParams.rotationX), grad2rad(cameraParams.rotationY), grad2rad(cameraParams.rotationZ));
        cameraParams.targetAlong = cameraDefaults.targetAlong; cameraParams.targetHeight = cameraDefaults.targetHeight;
        cameraParams.targetAside = cameraDefaults.targetAside;
        controls.target.set(cameraParams.targetAlong, cameraParams.targetHeight, cameraParams.targetAside);
        controls.update();
        recalcBoatConfigurationOnNextAnimationFrame();
        // TODO NOT PERFECT YET
    }};
    folderView.add(fViewCameraReset,'camera').name('reset camera');

    const folderAdvanced = gui.addFolder("Experimental");
    folderAdvanced.add(sailParams, 'cunningham', sailLimits.minCunningham, sailLimits.maxCunningham, 1).name('cunningham').onChange(recalcBoatConfigurationOnNextAnimationFrame).listen();
    folderAdvanced.add(sailParams, 'angleOfAttack', sailLimits.minAngleOfAttack, sailLimits.maxAngleOfAttack, 1).name('angle of attack').onChange(recalcBoatConfigurationOnNextAnimationFrame).listen();



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
    loader.load('./hull.stl', function (hullGeometry) {

        let meshMaterial = boatmaterial;

        if (hullGeometry.hasColors) {
            meshMaterial = new THREE.MeshStandardMaterial({ opacity: hullGeometry.alpha, vertexColors: true });
        }

        boat = new THREE.Group();

        let hullMesh = new THREE.Mesh(hullGeometry, meshMaterial);

        // the mast-foot-pin is the 0,0,0 point of the hull geometry
        hullGeometry.rotateX(-Math.PI/2);
        hullGeometry.translate(0, 0, 0);
        boat.scale.copy(BOATSCALE);
        hullMesh.position.y = boatLimits.waterlineToMastFootHeight*1000; // mast foot 45cm above waterline

        traveller = new THREE.Group();
        let travellerGeometry = new THREE.BoxGeometry(40, 30, 20); // fore, port, up .... in mm
        let travellerMaterial = new THREE.MeshStandardMaterial({ color: 0xff3020 });        
        travellerCar = new THREE.Mesh(travellerGeometry, travellerMaterial);
        const travellerRadius = 4000; // 4m radius in CAD drawing 
        travellerCar.position.x = -travellerRadius;
        traveller.position.set(travellerRadius-2470, hullMesh.position.y-65, 0);  // traveller is approx 6cm below mast rotation pin
        traveller.add(travellerCar);


        boat.add(traveller);

        if (debugHelperAxes) {
            boat.add(new THREE.AxisHelper(1000));
            hullMesh.add(new THREE.AxisHelper(1000));
            traveller.add(new THREE.AxisHelper(1000));
        }


        boat.castShadow = true;
        boat.receiveShadow = true;

        boat.add(hullMesh);
        scene.add(boat);

        // mast height 9050mm
        loader.load('./mast.stl', function (mastGeometry) {

            let meshMaterial = boatmaterial;
            if (mastGeometry.hasColors) {
                meshMaterial = new THREE.MeshStandardMaterial({ opacity: mastGeometry.alpha, vertexColors: true });
            }

            mast = new THREE.Mesh(mastGeometry, meshMaterial);

            //mast.position.set(-600, 55, +9460); // fore, port, up ... [mm]
            //geometry.rotateX(-Math.PI/2);
            mast.rotation.set(0, 0, grad2rad(4));
            mast.position.y = boatLimits.waterlineToMastFootHeight*1000;
            mast.castShadow = true;
            mast.receiveShadow = true;

            if (debugHelperAxes) {
                mast.add(new THREE.AxesHelper(1000));
            }

            const sail = rigSail();
            sail.position.x = sailOriginInFrontOfMastRotation;
            mast.add(sail);
            boat.add(mast);

            const mainSheetMaterial = new THREE.LineBasicMaterial({ color: 0x8f0f0f });
            const points = [];
            points.push(new THREE.Vector3(0, 0, 0));
            points.push(new THREE.Vector3(0, 0, 0));
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

const sailHeight = 9065; // mm
const sailLevelHeight = 50; // mm
const sailVerticesPerLevel = Math.floor(1000 / sailLevelHeight);
const sailLevels = Math.ceil(sailHeight / sailLevelHeight);
const sailTackHeight = 900; // mm
const sailTackMastDistance = 2125; // mm
const sailMastWidth = 140; // mm
const sailDecksweeperWidth = 900; // mm distance from mast
const sailTopMastDistance = 390; // mm distance of sail leech at mast top
const sailLeechCurvature = 200; //mm how curved the leech is vs. a straight line
const sailOriginInFrontOfMastRotation = 30; //sail leech starts at the foreside of the mast (as mast is part of sail shape)
let sail, sailGeometry, sailClipWidthPerLevel;
let mainSheet, mainSheetGeometry;

function rigSail() {
    const tackMastDistance = sailTackMastDistance;

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
        if (height < sailTackHeight) {
            sailWidth = tackMastDistance;
            clipOffWidth = sailDecksweeperWidth + (tackMastDistance - sailDecksweeperWidth) * height / sailTackHeight;
            //override
        } else {
            sailWidth = tackMastDistance - (tackMastDistance - sailTopMastDistance) * (height - sailTackHeight) / (sailHeight - sailTackHeight);
            sailWidth += Math.sin((height - sailTackHeight) / (sailHeight - sailTackHeight) * Math.PI) * sailLeechCurvature;
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
                vector = new THREE.Vector3(0, height, 0);
            } else {
                vector = new THREE.Vector3(segwidth, 0, 0);
                vector.add(lastvector);
            }
            lastvector = vector;
            sailGeometry.vertices.push(vector);

        }

        sailClipWidthPerLevel.push(clipOffWidth == sailWidth ? null : clipOffWidth);


    }

    const sailStripeInterval = Math.floor(sailLevels / 10);
    const colorRedStripe = new THREE.Color(0.8, 0.2, 0.2);
    const colorDarkGrey = new THREE.Color(0.25, 0.25, 0.25);
    const colorDarkGreyLight = new THREE.Color(0.28, 0.28, 0.28);

    for (let level = 0; level < sailLevels; level++) {
        //for (let level = 0; level <= 2; level++) {
        for (let v = 1; v < sailVerticesPerLevel; v++) {
            let i = level * sailVerticesPerLevel + v;
            let f1 = new THREE.Face3(i - 1, i, i + sailVerticesPerLevel - 1);
            let f2 = new THREE.Face3(i, i + sailVerticesPerLevel, i + sailVerticesPerLevel - 1);
            if (level % sailStripeInterval) { 
                f1.color = colorDarkGrey;
                f2.color = colorDarkGreyLight;
            } else {  // red stripes
                f1.color = colorRedStripe;
                f2.color = colorRedStripe;
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
    sail.rotation.set(0, Math.PI, 0);
    sail.add(sailmesh);
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
    render();
    stats.update();
}

function recalcBoatConfigurationOnNextAnimationFrame() {
    recalcBoatConfiguration = true;
}

function rad2grad(rad) {
    return rad * 180 / Math.PI;
}

function grad2rad(grad) {
    return grad * Math.PI / 180;
}


//let lastWindSpeed, lastBoatSpeed, lastBoatHeading, lastHellman, lastMainSheetLength, 
let recalcBoatConfiguration = true;
let lastMastrotation = 0;
let lastCunningham = null;
let flatSailgeometry = null;
let sailShape = null;
let firstTimeRotationSync = true;
function render() {

    const time = performance.now() * 0.0025;

    if (loadingComplete && boat) {

        if (false) {  // boat rocking
            boat.rotation.x = - Math.PI / 2 + Math.sin(time) * 0.01;
            boat.rotation.y = Math.cos(time) * 0.034;
            boat.rotation.z = Math.cos(time) * 0.01 - Math.sin(time) * 0.02 - boatHeadingRad;
        } 
        
        if (recalcBoatConfiguration) {

            let boatHeadingRad = grad2rad(boatParams.heading);
            if (sailParams.cunningham != lastCunningham) { 
                sailShape = new SailShape(sailTackMastDistance, sailTopMastDistance, sailMastWidth, sailParams.cunningham);
                recalcBoatConfiguration = true;
            }

            if (boat.rotation.y != boatHeadingRad) {
                recalcBoatConfiguration = true;
                let deltarot = boatHeadingRad + boat.rotation.y;
                if (firstTimeRotationSync) {
                    deltarot = 0;
                    firstTimeRotationSync = false;
                }
                boat.rotation.y = -boatHeadingRad;
                if (cameraParams.syncRotation) {
                    //let cpos = camera.position.clone();
                    let cp = new THREE.Vector2(camera.position.x, camera.position.z);
                    cp.rotateAround(new THREE.Vector2(0,0), deltarot);
                    camera.position.x = cp.x;
                    camera.position.z = cp.y;
                    camera.rotateOnAxis(new THREE.Vector3(0, 1, 0), deltarot);
                    camera.lookAt(scene.position); 
                    controls.update();
                }
            }
            boat.updateWorldMatrix();
    
            if (boatParams.speed >= boatLimits.minFoilingSpeed) {
                boat.position.y = boatLimits.foilingBoatLift; // foiling height
            } else {
                boat.position.y = 0.00; 
            }
            let mastFootOverWaterHeight = (boat.position.y + boatLimits.waterlineToMastFootHeight) * 1000;

            if (!flatSailgeometry) {
                flatSailgeometry = sailGeometry.clone();
            }

            //#####################################################################
            // TODO: the higher the apparent wind speed, the flatter the sail!!! --> outhaul parameter??
            // mast and luff rotation

            let dirfact = boatHeadingRad < 0 ? 1.0 : -1.0; // direction factor 
            //sailShape.calcShape(sailTackMastDistance, sailMastWidth); //############################# ## # ## # #TODOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOO************************### consants!!!
            let aw = Wind.apparentWind(boatParams.speed, boatHeadingRad, windParams.speed, 0);
            //let mr = calcMastRotation(aw)

            let chordAngleOfAttackRad = grad2rad(sailParams.angleOfAttack); // optimal angle of attack for 10% camber; http://www.onemetre.net/design/Entry/entry.htm
            const maxMastRotationRad = Math.PI / 2;
            const maxChordRotationPerSailLevelRad = Math.PI/3*2 / sailLevels; // empirical limit

            let absAwaRad = Math.abs(aw.awa);
            let mastEntryAngleRad = sailShape.mastAngleRad; 
            if (absAwaRad < 0.01) {  
                chordAngleOfAttackRad = 0;
            } 
            //console.log("absawa: " + rad2grad(absAwaRad).toFixed(2) + " mastangleofattack: " + rad2grad(mastEntryAngleRad).toFixed(2));

            let mastRotationRad = Math.min(absAwaRad - chordAngleOfAttackRad + mastEntryAngleRad, maxMastRotationRad); 
            //console.log("mastRotationRad: " + rad2grad(mastRotationRad).toFixed(2));

            // adjust sailshape
            let luffAxis = new THREE.Vector3(0, 1, 0);
            let power = 0.0;
            let lastChordRotationRad = null;
            let tackChordRotationRad = null;
            let topChordRotationRad = null;
            let sailTwist = null;
            let sailTackLevel = Math.round(sailTackHeight / sailLevelHeight) + 1;
            //console.log("calced tacklevel: " + sailTackLevel);
            for (let level = 0; level <= sailLevels; level++) {
                let overWaterHeight = level * sailLevelHeight + mastFootOverWaterHeight;
                let tws = Wind.windSheer(windParams.speed, overWaterHeight / 1000.0, windParams.hellman);
                let aw = Wind.apparentWind(boatParams.speed, boatHeadingRad, tws, 0);
                let levelAbsAwaRad = Math.abs(aw.awa);


                let chordAngleRad = levelAbsAwaRad - chordAngleOfAttackRad;
                if (chordAngleRad < 0) { // apparent wind below the tack comes very direct from front and would cause the sail to turn beyond the mid-line
                    chordAngleRad = 0;
                    // TODO: counting these lines might indicate reduced lift or even drag.
                    // console.log("Sail shape too much windwards: " + level + " " + rad2grad(levelAbsAwaRad).toFixed(2) + " " + rad2grad(chordAngleOfAttackRad).toFixed(2));
                } else if (chordAngleRad > Math.PI/2) {
                    chordAngleRad = Math.PI/2;
                }
    
                let chordRotationRad = chordAngleRad - mastRotationRad;
                if (lastChordRotationRad && ((chordRotationRad - lastChordRotationRad) > maxChordRotationPerSailLevelRad)) {
                    chordRotationRad = lastChordRotationRad + maxChordRotationPerSailLevelRad;
                }
                lastChordRotationRad = chordRotationRad;

                if (aw.aws > 25) { // TODO =================== lift calculation
                    power += aw.aws; // sum up all wind speeds
                }

                let clipWidth = sailClipWidthPerLevel[level]; // null, if level is at or above tack
                let verticeAnglesRad = sailShape.getVerticesAngles(sailVerticesPerLevel, sailMastWidth, clipWidth);

                // apply rotation to the sail-points according to the parabolic sailshape
                for (let v = 1; v < sailVerticesPerLevel; v++) {
                    let i = level * sailVerticesPerLevel + v;
                    sailGeometry.vertices[i].copy(flatSailgeometry.vertices[i]);
                    sailGeometry.vertices[i].applyAxisAngle(luffAxis, -(chordRotationRad + verticeAnglesRad[v]) * dirfact);
                }

                if (level == sailTackLevel) {
                    // get chord angle at tack level
                    tackChordRotationRad = chordRotationRad;
                } else if (level == sailLevels) {
                    topChordRotationRad = chordRotationRad;
                    sailTwist = topChordRotationRad - tackChordRotationRad;                    
                }

            }

            power /= sailLevels;
            sailGeometry.verticesNeedUpdate = true;

            recalcWindField(windParams.speed, windParams.hellman);
            recalcApparentWindField(windParams.speed, boatParams.speed, boatHeadingRad, windParams.hellman);
            boatParams.vmg = Math.abs(boatParams.speed * Math.cos(boatHeadingRad));
            boatParams.mastrotation = rad2grad(mastRotationRad)*dirfact;

            mast.rotateY(grad2rad(lastMastrotation - boatParams.mastrotation));
            //mast.rotation.y = mastRotationRad;

            scene.updateMatrixWorld();
            //boat.updateWorldMatrix(true, true);

            // project the leech down to the traveller and calculate the distance aside 
            let pTackWorld = sail.localToWorld(sailGeometry.vertices[sailVerticesPerLevel*sailTackLevel-1].clone());
            let pAboveTackWorld = sail.localToWorld(sailGeometry.vertices[sailVerticesPerLevel*(sailTackLevel+1)-1].clone());
            let pTackBoat = boat.worldToLocal(pTackWorld.clone());
            let pAboveTackBoat = boat.worldToLocal(pAboveTackWorld.clone());
            let tackPositionTwistCompensationAside = (pTackBoat.z-pAboveTackBoat.z)*sailLevels/sailTackLevel; // x, y, z = fore , port , height
            let tackPositionAside = pTackBoat.z; 
            //console.log("tackPositionAside: " + tackPositionAside.toFixed(2));
            travellerParams.position = recalcTravellerPosition(tackPositionAside, tackPositionTwistCompensationAside, dirfact);
            boat.updateWorldMatrix(false, true);
            let mainSheetLength = Math.round(recalcMainSheet(pTackWorld));

            let actualAngleOfAttack = rad2grad(absAwaRad - topChordRotationRad - mastRotationRad); // use this to calculate forces
            //console.log("topchordangle: " + rad2grad(topChordRotationRad).toFixed(2) + " mastrotation: " + rad2grad(mastRotationRad).toFixed(2) + "absawa:" + rad2grad(absAwaRad).toFixed(2))

            scene.updateMatrixWorld();
            //boat.updateWorldMatrix(true, true);

            let infoStandardHtml = 
                "Sail Twist: " + rad2grad(sailTwist).toFixed(2) + "° (top to tack chord angle difference)" +
                "<br>Apparent wind speed: " + Math.round(aw.aws) + "kn (at mast-top)" +
                "<br>Apparent wind angle: " + Math.round(rad2grad(absAwaRad)) + "° (at mast-top)" +
                "<br>Mast rotation: " + Math.round(Math.abs(boatParams.mastrotation)) + "°" +
                "<br>Traveller: " + Math.round(travellerParams.position / 10) + "cm" +
                "<br>Mainsheet give: " + Math.round(mainSheetLength / 10 - 86) + "cm (before purchase ratio)" +   // TODO 86cm <--- somehow calculate the mainsheet fully tight length
                "<br>VMG: " + boatParams.vmg.toFixed(1) + "kn (approximate, ignores sideways drift)";

            let infoDetailHtml = "";
            if (boatParams.details) {
                infoDetailHtml = 
                    "<br>Chord angle of attack: <span " + (Math.round(actualAngleOfAttack) < sailParams.angleOfAttack ? "style='color:red'>" : ">") + Math.round(actualAngleOfAttack) + "</span>° (apparent wind vs. chord at mast top)" +
                    "<br>Mast angle of attack: -" + Math.round(sailParams.angleOfAttack - rad2grad(mastEntryAngleRad)) + "° (vs. apparent wind)" +
                    "<br>Sail area: " + (sailParams.mastArea + sailParams.sailArea).toFixed(2) + "m² (mast: " + sailParams.mastArea.toFixed(2) + "m², sail: " + sailParams.sailArea.toFixed(2) + "m²)" + //&sup2;
                    "<br>Mast foot over water: " + (mastFootOverWaterHeight / 1000).toFixed(1) + "m" +
                    "<br>Apparent wind power: " + power.toFixed(1) + "kn average over sail" +
                    "<br>Girth: " + Math.round(sailShape.girth) + "mm" +
                    "<br>Camber: " + Math.round(sailShape.draftPositionRatio * 100) + "%" + 
                    "<br>Draft: " + Math.round(sailShape.draftDepthRatio * 100) + "%" + 
                    "<br>Force angle: " + rad2grad(sailShape.forceAngleRad).toFixed(1) + "°";
            }

            let infoDebugHtml = "";
            if (debugHelperAxes) {
                infoDebugHtml = 
                    "<br>Camera rotation: " + camera.rotation.x + " " + camera.rotation.y + " " + camera.rotation.z + " " +
                    "<br>Controls target: " + controls.target.x + " " + controls.target.y + " " + controls.target.z + " ";
            }
            
            dataDiv.innerHTML = infoStandardHtml + infoDetailHtml + infoDebugHtml;

            lastMastrotation = boatParams.mastrotation;
            recalcBoatConfiguration = false;
        }
    }

    water.material.uniforms['time'].value += 1.0 / 60.0;
    renderer.render(scene, camera);
}

// returns mainsheet length in mm
function recalcMainSheet(tackWorldVector) {
    mainSheetGeometry.verticesNeedUpdate = true;
    let tackVector = mainSheet.worldToLocal(tackWorldVector.clone());
    mainSheetGeometry.vertices[0].copy(tackVector);
    return mainSheetGeometry.vertices[1].distanceTo(tackVector);
}

// returns traveller position in [m] from middle
function recalcTravellerPosition(tackPositionAside, tackPositionTwistCompensationAside, dirfact) {
    mainSheetGeometry.verticesNeedUpdate = true;
    let travellerPosition = Math.abs(tackPositionAside) - Math.abs(tackPositionTwistCompensationAside);
    let travellerPositionAbs = travellerPosition < 0.0 ? 0.0 : travellerPosition;
    if (travellerPositionAbs > boatLimits.maxTraveller) {
        travellerPositionAbs = boatLimits.maxTraveller;
    }
    let travellerRotationAbs = Math.asin(travellerPositionAbs/4000.0);
    //console.log("TravellerPosition: " + travellerPositionAbs.toFixed(2));
    //console.log("TravellerRotation: " + travellerRotationAbs.toFixed(2));
    //console.log("TravellerCompensation: " + tackPositionTwistCompensationAside.toFixed(2));
   
    //const maxTravellerRotationAbs = grad2rad(10);
    //travellerRotationAbs = travellerRotationAbs > maxTravellerRotationAbs ? maxTravellerRotationAbs : travellerRotationAbs;
    traveller.rotation.y = - travellerRotationAbs * dirfact;
    boat.updateWorldMatrix(false, true);
    let travellerWorldVector =  traveller.localToWorld(travellerCar.position.clone());
    let travellerVector = mainSheet.worldToLocal(travellerWorldVector.clone());
    mainSheetGeometry.vertices[1].copy(travellerVector);
    return travellerPositionAbs;
}

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
                recalcBoatConfigurationOnNextAnimationFrame();
                break;
            case "ArrowDown" : 
                if (boatParams.speed > 0) {
                    boatParams.speed -= 1;
                }
                recalcBoatConfigurationOnNextAnimationFrame();
                break;
            case "ArrowLeft" : 
                if (boatParams.heading > -180) {
                    boatParams.heading -= 1;
                } else {
                    boatParams.heading = 180;
                }
                recalcBoatConfigurationOnNextAnimationFrame();
                break;
            case "ArrowRight" : 
                if (boatParams.heading < 180) {
                    boatParams.heading += 1;
                } else {
                    boatParams.heading = -180;
                }
                recalcBoatConfigurationOnNextAnimationFrame();
                break;
            }
    });
};


