

//=========== setup speed conversions

export function ms2kts(ms) {
    return ms * 1.9438444924574;
}

export function kts2ms(kts) {
    return kts / 1.9438444924574;
}

// windspeed at 10m
// returns wind speed at target height
export function windSheer(windspeed, height, hellman) {
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
// cog ... course over ground (boat direction in rad)
// tws ... true wind speed in kts
// twd ... true wind direction (rad)
// returns {
//    apparent wind speed, 
//    apparent wind-angle relative to boat (rad), 
//    apparent winddirection (rad)}
export function apparentWind(sog, cog, tws, twd) {
    let twa = twd - cog;
    if (twa < 0) {
        twa = Math.PI*2 + twa;
    }
    let cosTWA = Math.cos(twa);
    let aws = Math.sqrt(tws ** 2 + sog ** 2 + (2 * tws * sog * cosTWA));
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

    let awa = twa <= 0 || twa > Math.PI ? - apparentWindAngle : apparentWindAngle;
    let awd = cog + awa;
    return { aws: aws, awa: awa, awd: awd };
}

