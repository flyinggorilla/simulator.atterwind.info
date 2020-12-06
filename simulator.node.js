const https = require('https');
const zlib = require('zlib');
const express = require('express')

const mode = process.env.NODE_ENV; // set to "production" when in prod
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;
var listenPort = 3001;
var isProduction = (mode == 'production');
if (isProduction)
    listenPort = process.env.PORT;

console.log(mode)
console.log("port: " + listenPort)

const app = express();

if (mode != 'production') {
   var path = require('path');

    app.get('/', function(rootreq, rootres) {
        rootres.set("Access-Control-Allow-Origin", "*");
        rootres.sendFile(path.join(__dirname + '/simulator.html'));
    });

    app.get('/favicon.png', function(rootreq, rootres) {
        rootres.sendFile(path.join(__dirname + '/favicon.png'));
    });

    app.get('/three.min.js', function(rootreq, rootres) {
        rootres.sendFile(path.join(__dirname + '/three.min.js'));
    });
    app.get('/STLLoader.js', function(rootreq, rootres) {
        rootres.sendFile(path.join(__dirname + '/STLLoader.js'));
    });
    app.get('/hull.stl', function(rootreq, rootres) {
        rootres.sendFile(path.join(__dirname + '/hull.stl'));
    });
    app.get('/stats.module.js', function(rootreq, rootres) {
        rootres.sendFile(path.join(__dirname + '/stats.module.js'));
    });
    app.get('/three.module.js', function(rootreq, rootres) {
        rootres.sendFile(path.join(__dirname + '/three.module.js'));
    });
    app.get('/dat.gui.module.js', function(rootreq, rootres) {
        rootres.sendFile(path.join(__dirname + '/dat.gui.module.js'));
    });
    app.get('/Water.js', function(rootreq, rootres) {
        rootres.sendFile(path.join(__dirname + '/Water.js'));
    });
    app.get('/Sky.js', function(rootreq, rootres) {
        rootres.sendFile(path.join(__dirname + '/Sky.js'));
    });
    app.get('/OrbitControls.js', function(rootreq, rootres) {
        rootres.sendFile(path.join(__dirname + '/OrbitControls.js'));
    });
    app.get('/simulator.css', function(rootreq, rootres) {
        rootres.sendFile(path.join(__dirname + '/simulator.css'));
    });
    app.get('/simulator.js', function(rootreq, rootres) {
        rootres.sendFile(path.join(__dirname + '/simulator.js'));
    });
    app.get('/simulator.mjs', function(rootreq, rootres) {
        rootres.sendFile(path.join(__dirname + '/simulator.mjs'));
    });
    app.get('/mast.stl', function(rootreq, rootres) {
        rootres.sendFile(path.join(__dirname + '/mast.stl'));
    });
    app.get('/waternormals.jpg', function(rootreq, rootres) {
        rootres.sendFile(path.join(__dirname + '/waternormals.jpg'));
    });

}

app.listen(listenPort, () => console.log(`Simulator app listening on port ${listenPort}!`))

