const express = require('express'),
    app = express(),
    port = 80,
    cors = require('cors');

function getInstances() {
    // change these
    return {
        "clickhouse1": "52.58.193.86",
        "influxdb": "18.197.156.139",
        "percona": "3.121.126.247",
        "cassandra2": "35.158.161.203",
        "cassandra3": "35.158.99.247",
        "cassandra1": "3.122.52.0",
        "prometheus": "18.184.147.168"
    };
}

app.use(express.static('public'));

app.use(cors({
    origin: '*',
    allowedHeaders: ['Content-Type', 'Authorization', 'Content-Length', 'X-Requested-With', 'Accept'],
    methods: ['GET', 'PUT', 'POST', 'DELETE', 'OPTIONS'],
    optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
}));

app.get('/instances', async (req, res) => {
    res.set({'Access-Control-Allow-Origin': '*'});
    res.set('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    try {
        const inst = getInstances();
        res.send(JSON.stringify(inst));
    }
    catch (e) {
        res.send("error: " + e);
    }
});

app.listen(port, () => console.log(`Simple dashboard listening on port ${port}!`));
