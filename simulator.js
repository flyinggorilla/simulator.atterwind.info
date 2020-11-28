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

let boat, mast, sailtop, sailfoot;
let lastMastrotation = 0;

let windfield = [];
let lastWindSpeed = 0;

let apparentwindfield = [];

let loadingComplete = false;

const boatParams = {
    mastrotation: 0.0,
    heading: 0.0,
    speed: 5.0
}

const windParams = {
    speed: 5.0
}


init();
animate();

function init() {

    container = document.createElement('div');
    document.body.appendChild(container);


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

    scene.add(cameraHelper);

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
        new THREE.MeshPhongMaterial({ color: COLOR_WATER, specular: 0x101010, opacity: 0.1 })
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
    folderBoat.add(boatParams, 'mastrotation', -90, 90, 1).name('mastrotation');
    folderBoat.add(boatParams, 'heading', -180, 180, 1).name('heading');
    folderBoat.add(boatParams, 'speed', 0, 30, 1).name('speed');
    folderBoat.open();

    const folderWind = gui.addFolder('Wind');
    folderWind.add(windParams, 'speed', 0, 30, 1).name('speed');
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
    let windgeometry = new THREE.ConeGeometry(0.1, 0.2, 12);
    let windmaterial = new THREE.MeshPhongMaterial({ color: 0x0000FF, opacity: 0.5, transparent: true });
    let windcone;
    windcone = new THREE.Mesh(windgeometry, windmaterial);
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
    recalcWindField(windParams.speed);

    for (let height = 0; height < 11; height += 0.5) {
        let clone = windcone.clone();
        clone.position.set(0, height, -0.5);
        apparentwindfield[height * 2] = clone;
        scene.add(clone);
    }

    //windGroup.rotateOnAxis();
    windGroup.position.set(7.5, 0, 0);
    scene.add(windGroup);





    THREE.DefaultLoadingManager.onStart = function (url, itemsLoaded, itemsTotal) {

        console.log('Started loading file: ' + url + '.\nLoaded ' + itemsLoaded + ' of ' + itemsTotal + ' files.');

    };

    THREE.DefaultLoadingManager.onLoad = function () {

        console.log('Loading Complete!');
        loadingComplete = true;
        document.getElementById("loading").style.display = "none";

    };


    THREE.DefaultLoadingManager.onProgress = function (url, itemsLoaded, itemsTotal) {

        console.log('Loading file: ' + url + '.\nLoaded ' + itemsLoaded + ' of ' + itemsTotal + ' files.');

    };

    THREE.DefaultLoadingManager.onError = function (url) {

        console.log('There was an error loading ' + url);

    };

    const boxgeometry = new THREE.BoxBufferGeometry(30, 30, 30);
    const boxmaterial = new THREE.MeshStandardMaterial({ roughness: 0 });

    let boxmesh = new THREE.Mesh(boxgeometry, boxmaterial);
    //scene.add( boxmesh );

    // Boat
    const boatmaterial = new THREE.MeshPhongMaterial({ color: 0xAAAAAA, specular: 0x111111, shininess: 200 });
    const loader = new STLLoader();
    const BOATSCALE = new THREE.Vector3(0.001, 0.001, 0.001);

    // Colored binary STL
    loader.load('./hull.stl', function (geometry) {

        let meshMaterial = boatmaterial;

        if (geometry.hasColors) {

            meshMaterial = new THREE.MeshPhongMaterial({ opacity: geometry.alpha, vertexColors: true });

        }

        boat = new THREE.Mesh(geometry, meshMaterial);

        boat.position.set(0, 0.5, 0);
        boat.rotation.set(- Math.PI / 2, 0, 0);
        boat.scale.copy(BOATSCALE);
        //mesh.scale.set(0.0001, 0.0001, 0.0001);

        if (showDetails) {
            const axes = new THREE.AxesHelper();
            axes.material.depthTest = false;
            axes.renderOrder = 1;
            axes.scale.set(1000, 1000, 1000);
            boat.add(axes);
        }


        boat.castShadow = true;
        boat.receiveShadow = true;

        scene.add(boat);

        // mast height 9050mm
        loader.load('./mast.stl', function (geometry) {

            let meshMaterial = boatmaterial;

            if (geometry.hasColors) {

                meshMaterial = new THREE.MeshPhongMaterial({ opacity: geometry.alpha, vertexColors: true });

            }

            mast = new THREE.Mesh(geometry, meshMaterial);

            mast.position.set(-1100, 35, +9270);
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

            boat.add(mast);

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

// obj - your object (THREE.Object3D or derived)
// point - the point of rotation (THREE.Vector3)
// axis - the axis of rotation (normalized THREE.Vector3)
// theta - radian value of rotation
// pointIsWorld - boolean indicating the point is in world coordinates (default = false)
function rotateAboutPoint(obj, point, axis, theta, pointIsWorld) {
    pointIsWorld = (pointIsWorld === undefined) ? false : pointIsWorld;

    if (pointIsWorld) {
        obj.parent.localToWorld(obj.position); // compensate for world coordinate
    }

    obj.position.sub(point); // remove the offset
    obj.position.applyAxisAngle(axis, theta); // rotate the POSITION
    obj.position.add(point); // re-add the offset

    if (pointIsWorld) {
        obj.parent.worldToLocal(obj.position); // undo world coordinates compensation
    }

    obj.rotateOnAxis(axis, theta); // rotate the OBJECT
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


function render() {

    //const timer = Date.now() * 0.0005;

    const time = performance.now() * 0.0025;

    //camera.position.x = Math.cos(timer) * 3;
    //camera.position.z = Math.sin(timer) * 3;

    if (loadingComplete && boat) {
        //boat.position.y = Math.sin( time ) * 20 + 5;
        boat.rotation.x = - Math.PI / 2 + Math.sin(time) * 0.01;
        boat.rotation.y = Math.cos(time) * 0.034;
        boat.rotation.z = Math.cos(time) * 0.01 - Math.sin(time) * 0.02 - boatParams.heading * Math.PI / 180;
        if (boatParams.speed >= 13) {
            boat.position.set(0, 0.6, 0); // foiling height
        } else {
            boat.position.set(0, 0.15, 0); // non-foiling
        }

        //mast.rotation.y = boatParams.mastrotation * Math.PI / 180.0;
        mast.rotateY((boatParams.mastrotation - lastMastrotation) * Math.PI / 180.0);
        lastMastrotation = boatParams.mastrotation;
        //mast.rotation.y = Math.PI / 4;
        //console.log("mast rotation: " + boatParams.mastrotation);

        recalcWindField(windParams.speed);
        recalcApparentWindField(windParams.speed, boatParams.speed, boatParams.heading);
    }

    water.material.uniforms['time'].value += 1.0 / 60.0;

    //camera.lookAt(cameraTarget);

    renderer.render(scene, camera);

}

function recalcApparentWindField(windspeed, sog, cog) {
    for (let height = 0; height < 11; height += 0.5) {
        let tws = windSheer(windspeed, height);
        let aw = apparentWind(sog, cog, tws, 0);
        let cone = apparentwindfield[height * 2];
        cone.scale.set(aw.aws * 0.1, aw.aws, aw.aws * 0.1)
        cone.rotation.set(0, - aw.awd * Math.PI / 180, Math.PI / 2);
    }
}

function recalcWindField(windspeed) {
    if (lastWindSpeed == windspeed)
        return;

    let pos, height;
    for (height = 1; height < 11; height++) {
        let windspeedfactor = windSheer(windspeed, height);
        for (pos = 0; pos <= 10; pos++) {
            windfield[height][pos].scale.set(windspeedfactor * 0.1, windspeedfactor, windspeedfactor * 0.1);
        }
    }

    lastWindSpeed = windspeed;
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
function windSheer(windspeed, height) {
    // https://en.wikipedia.org/wiki/Wind_gradient
    let v10 = kts2ms(windspeed);
    let height10 = 10;
    let hellman = 0.27; // alpha
    let v = v10 * (Math.pow((height / height10), hellman));
    //console.log(v);
    return (ms2kts(v));

    // location	α
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
//    apparent wind-angle relative to boat, 
//    apparent winddirection}
function apparentWind(sog, cog, tws, twd) {
    let twa = twd - cog;
    if (twa < 0) {
        twa = 360 + twa;
    }
    let A = Math.cos((twa * Math.PI / 180));
    let aws = Math.sqrt((tws * tws) + (sog * sog) + (2 * tws * sog * A));
    let B = Math.cos(twa * Math.PI / 180);
    let C = (((tws * B) + sog) / aws);
    let D = Math.acos(C);
    let awa = twa <= 0 || twa > 180 ? - D * 180 / Math.PI : D * 180 / Math.PI;
    let awd = cog + awa;
    return { aws: aws, awa: awa, awd: awd };
}
