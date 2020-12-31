## https://simulator.atterwind.info
# Apparent wind simulator for sailtwist analysis
This simulation visualizes wind sheer and how it influences apparent wind at various boat headings. Understanding apparent wind directions at top, mid and lower parts of sail is helpful learning sail-trim.

![simulator](simulator-screenshot-1.jpg "sdf")

## Wind Sheer
TODO: explain wind-sheer with example pics

## Sail Twist
TODO: explain sail-twist


## The (Non-)Science 

* reality constraints
    * impossible settings are possible (e.g. you can go straight downwind faster than the wind )
    * mast rotation max 90????
    * WANTED: polar data for foiling A-Cat
* wind sheer based on wikipedia
    * windsheer impact is strongest in stable conditions; 
    * show 3 pics of wind-sheer in the various conditions -- incl. hellman constants stable/ 
    * all calculations based on constant (set) windspeed --- rocking of boat is ignored (i.e. apparent wind direction can change a lot in the mast-top, hence you sail with more twist to be more tolerant of apparent wind direction changes)
    http://localhost:3001/?boat.heading=135&boat.speed=30&wind.speed=30&wind.hellman=0.27&camera.height=6.0&camera.aside=-8.7&camera.along=-0.3

* sail
    * assumed ideal angle of attack of sail-chord to apparent wind of 20degrees for maximum sail lift.
    * parabolic sail shape - defaults to 45% chord position and 10% camber [todo picture cord, camber, apparent wind, ...]
    * calculations based on [[3]](http://www.onemetre.net/design/Parab/Parab.htm)

* cunningham
    * changes parabolic sail shape --- looks good, but "angle of force" results may be totally wrong/unrealistic (angle of force moves way too much fore)
* metrics
    * top of sail: 8.35m
    * mid of sail: 5m
    * lower third: 1.65m
    * note when boat is foiling, what happens at 13kts+ (or also flying?) boat lifts by .52m, thus sail is higher above water! (what has an impact on twist in lower sail areas) 

* battens:
    * Dynaflex battens https://dynaflexsailbattens.com/technology/ 
    * Fiberfoam battens: "designed and made with their position of maximum camber at between 38% and 45%." https://www.fiberfoam.net/products/technical-tips/ 

* mast rotation:
    * angles: ![mast rotation angles on a DNA F1x](mastrotationanglesdnaf1x.jpg)
        * 1: 20 
        * 2: 30
        * 3: 50
        * 4: 70

* tuning guide comparision 
    * TODO presets & screenshots
    * TODO some real pictures?? would be nice to compare (my chasecam pic?)
	Upwind				Downwind			
	0-6kts	7-11kts	12-15kts	16kts+	0-7kts	7-9kts	10-16	17kts+
Mast rotation	3	2	1.5	1	4	2 (3)	2.5 (3)	3 (3)
Cunningham	mid	light	mid	pull	mid	loose	mid	pull
Traveller	0	0	0	0.5 to 1	max	1	2	3

## URL parameters

        return "?bh=" + boatParams.heading + "&bs=" + boatParams.speed + "&ws=" + windParams.speed + "&wh=" + windParams.hellman
            + "&ch=" + camera.position.y.toFixed(1) + "&cs=" + camera.position.z.toFixed(1) + "&cl=" + camera.position.x.toFixed(1)
            + "&cry=" + rad2grad(camera.rotation.y).toFixed(1) + "&crz=" + rad2grad(camera.rotation.z).toFixed(1) + "&crx=" + rad2grad(camera.rotation.x).toFixed(1)
            + "&cth=" + controls.target.y.toFixed(1) + "&cts=" + controls.target.z.toFixed(1) + "&ctl=" + controls.target.x.toFixed(1)
            + "&csh=" + cameraParams.syncRotation ? "1" : "0";

## Todo List
DONE:
* improve wind indicator position by using treejs GROUPS to set pivot points at the cone tip
* allow adjusting wind-sheer to stable or gusty wind-conditions
* quicksettings: "downwind foiling", "downwind light winds", "upwind foiling", "upwind max height", "reaching"
TODO:
* add "info" button and create a windsheer and twist explainer page
* vizualize sail, and add "angle of attack" 
* add water spray & boat speed visualization (simple lines or particle engine)
https://stemkoski.github.io/Three.js/Particle-Engine.html 
* add WebXR (VR) capability -- update threejs for that

### Further references:
* [1] wind sheer: https://en.wikipedia.org/wiki/Wind_gradient
* [2] apparent wind: https://en.wikipedia.org/wiki/Apparent_wind 
* [3] sail shape: http://www.onemetre.net/design/Parab/Parab.htm 

### Credits go to great sources used in this project:
* threejs: https://threejs.org/ 3D WebGL library
* water animation: https://github.com/mrdoob/three.js/blob/master/examples/webgl_shaders_ocean.html 
* a-cat: the A-Cat model is derived from https://grabcad.com/library/class-a-catamaran-1 and changed to DNA F1x hull shape, and mast moved forward to allow for proper 13.94m2 sail area.
