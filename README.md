## https://simulator.atterwind.info
# Apparent Wind Sail-Trim Simulator 
This simulator trims an [A-Class catamaran](https://www.a-cat.org/) towards apparent wind. While this is an idealization, it comes close enough to get a better understanding of sail-trim. Basic sail-twist concepts apply to all other catamarans like [Nacra 15](https://nacrasailing.com/our-boats/daggerboard-boats/nacra-15/) or [Nacra 17](https://nacra17.org/) as well as dinghys such as [Laser](http://www.laserinternational.org/) or [RS Aero](https://en.wikipedia.org/wiki/RS_Aero) too, just ignore lack of jib of the former and mast rotation, traveller on the latter. 
* learn and understand true-wind vs. __apparent wind__ and it's impact to __sail-twist__ and trim
* improve __sail-trim__ on the water with better understanding of how much sail-twist, mast-rotation and traveler move is needed in certain situations
* __share simulator views__ as URL hyperlinks with others, as baseline to discuss real-world trim improvements

![simulator](screenshots/simulator.jpg "simulator.atterwind.info")

How to use this simulator:
1. __adjust true-wind speed__ in knots. it's direction is irrelevant for the simulation.
1. __adjust wind condition__, stable thermal winds have higher wind gradient impact than gusty unstable winds
1. __adjust boat heading__ in degrees relative to true-wind direction - e.g. 50 degrees for upwind, and 135 for downwind. 
1. __adjust boat speed__ in knots that you estimate to fit to wind and heading. The simulated foiling A-Cat will fly at 13+ knots. Because it's a simulator, have also fun sailing practically impossible configurations.
1. __share view__ as HTTP URL with others

## Wind Speed Gradient 
Surface friction causes the wind speed to be close to zero at the surface, meaning that the air molecules are slowed down by the water surface. Slow air molecules also slow down the air above them and so forth. This causes a gradient of wind speeds, also called wind shear. This simulation calculates the wind gradient based on this [wind turbine research][1].
 The biggest impact to sailors is at the height .5 to 3m

[stable]: https://simulator.atterwind.info/?bh=103&bs=0&ws=25&wh=0.27&ch=5.5&cs=-21.7&cl=10.2&cry=13.7&crz=179.4&crx=-177.6&cth=4.5&cts=2.8&ctl=4.3&csh=0 (view in simulator)

[neutral]: https://simulator.atterwind.info/?bh=103&bs=0&ws=25&wh=0.1&ch=5.5&cs=-21.7&cl=10.2&cry=13.7&crz=179.4&crx=-177.6&cth=4.5&cts=2.8&ctl=4.3&csh=0 (view in simulator)

[unstable]: https://simulator.atterwind.info/?bh=103&bs=0&ws=25&wh=0.06&ch=5.5&cs=-21.7&cl=10.2&cry=13.7&crz=179.4&crx=-177.6&cth=4.5&cts=2.8&ctl=4.3&csh=0 (view in simulator)

| [stable][stable] | [neutral][neutral] | [unstable][unstable] |
|:---:|:---:|:---:|
| [![Stable wind condition](screenshots/windSheer25ktsStable.jpg)][stable] | ![Neutral wind condition](screenshots/windSheer25ktsNeutral.jpg) | ![Unstable wind condition](screenshots/windSheer25ktsUnstable.jpg) |
|a=0.27|a=0.1|a=0.06|


## Sail Twist
TODO: explain sail-twist
A-Cat mast is about 10%

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
    * bending the mast with the cunningham flattens the sail (TODO)
 * changes parabolic sail shape --- looks good, but "angle of force" results may be totally wrong/unrealistic (angle of force moves way too much fore)
    * TODO: rescale parabolic shape based on % camber/draft/depth so to ; problem is that parabolic shape changes  the girth length what is obviously a constant (unless you change the sail)
    
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
* Add  "angle of attack" setting (experimental?)
* Add outhaul??
* Add force moments and simulate a body sitting, hiking or trapezing 
* NEED a polar to provide max speed info (vs. wishful speeds of) to enable "constraints" 
* add water spray & boat speed visualization (simple lines or particle engine)
https://stemkoski.github.io/Three.js/Particle-Engine.html 
* add WebXR (VR) capability -- update threejs for that

### Further references:
[1]: https://en.wikipedia.org/wiki/Wind_gradient (wind speed gradient)
[[1]] wind gradient: https://en.wikipedia.org/wiki/Wind_gradient
[2]: https://en.wikipedia.org/wiki/Apparent_wind (apparent wind)
[[2]]: https://en.wikipedia.org/wiki/Apparent_wind (apparent wind)
[3]: http://www.onemetre.net/design/Parab/Parab.htm (parabolic sail shape)
[[3]]: http://www.onemetre.net/design/Parab/Parab.htm (parabolic sail shape)

### Credits go to great sources used in this project:
* threejs: https://threejs.org/ 3D WebGL library
* water animation: https://github.com/mrdoob/three.js/blob/master/examples/webgl_shaders_ocean.html 
* a-cat: the A-Cat model is derived from https://grabcad.com/library/class-a-catamaran-1 and changed to DNA F1x hull shape, and mast moved forward to allow for proper 13.94m2 sail area.


<img src="simulator-screenshot-1.jpg" width="30%">
<img src="simulator-screenshot-1.jpg" width="30%">
<img src="simulator-screenshot-1.jpg" width="30%">
