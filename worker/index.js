const Loader = require('./loader'),
    express = require('express'),
    bodyParser = require('body-parser');


const app = express();
const port = 30003;
let loader, serial = 0;


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

app.get('/status', (req, res) => {
    res.set({'Access-Control-Allow-Origin': '*'});
    let result = {};
    if (loader && loader.running) {
        result.status = "running";
    } else {
        result.status = "stopped";
    }
    res.json(result);
});
app.post('/start', (req, res) => {
    // target: 1.1.1.1:4323
    // first_cuid: 1
    // counters: 12500
    // duration: 2

    res.set({'Access-Control-Allow-Origin': '*'});

    if (loader && loader.running) {
        res.send(JSON.stringify({
            ok: false,
            error: "already started",
        }));
        return;
    }

    loader = new Loader(...req.body.target.split(":"));
    const startTs = Math.round(new Date().getTime()/ 1000);

    const startCuid = parseInt(req.body.first_cuid, 10);
    const endCuid = startCuid + parseInt(req.body.counters, 10) - 1;
    console.log(startCuid, endCuid,
        parseInt(req.body.interval, 10),
        startTs,
        parseInt(req.body.duration, 10));
    loader.start(startCuid, endCuid,
        parseInt(req.body.interval, 10),
        startTs,
        parseInt(req.body.duration, 10)
    );

    const result = {
        ok: true,
        serial: serial++
    };
    console.log(result);
    res.send(JSON.stringify(result));
});

app.post('/modify', (req, res) => {
    // first_cuid: 1
    // counters: 12500
    // interval: 15

    res.set({'Access-Control-Allow-Origin': '*'});

    if (!loader || !loader.running) {
        res.send(JSON.stringify({
            ok: false,
            error: "no loader started",
        }));
        return;
    }

    const startCuid = parseInt(req.body.first_cuid, 10),
        endCuid = startCuid + parseInt(req.body.counters, 10) - 1,
        interval = parseInt(req.body.interval, 10);
    loader.modify(startCuid, endCuid, interval);

    const result = {
        ok: true,
        serial: serial++
    };
    console.log(result);
    res.send(JSON.stringify(result));
});

app.post('/stop', (req, res) => {
    res.set({'Access-Control-Allow-Origin': '*'});
    if (loader) {
        loader.stop();
        loader = false;
        console.log("Stopped!");
        res.send(JSON.stringify({
            ok: true
        }));

    }
    else {
        res.send(JSON.stringify({
            ok: false,
            error: "not started"
        }));
    }
});

app.listen(port, () => console.log(`Example app listening on port ${port}!`))
