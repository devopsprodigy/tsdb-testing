const Influx = require('influx');
const influx = new Influx.InfluxDB({
    host: 'se.rv.er.ip',
    database: 'mon'
});

const http = require('http');
const port = 3001;

var url = require("url");

const requestHandler = (request, response) => {
    response.setHeader('Access-Control-Allow-Origin', '*');

    var l = 0;
    var t = 0;

    var t1 = new Date();

    var parsedUrl = url.parse(request.url, true); // true to get query as object
    var queryAsObject = parsedUrl.query;

    var from_time = queryAsObject.from_time;
    var to_time = queryAsObject.to_time;
    var cuid = queryAsObject.counter_uid;
    var cuids;
    if (cuid) {
        cuids = [cuid];
    } else if (queryAsObject.counter_uids) {
        cuids = queryAsObject.counter_uids.split(',');
    } else {
        return;
    }

    if(from_time && to_time && cuids && cuids.length) {
        let ors = [];
        for (let cuid of cuids) {
            ors.push(`counter_uid='${cuid}'`);
        }
        const cs = ors.join(' OR ');;
        let q;
        influx
            .query(q = "select * from \"stats\" WHERE time >= '"+from_time+"' and time<='"+to_time+"' and (" + cs + ");")
            .then(results => {
                l = results.length;
                var t2 = new Date();
                t = t2 - t1;
                response.end("Got " + l + " rows via " + t + " ms; query: " + q);
            });
    } else {
        response.end('---');
    }
};

const server = http.createServer(requestHandler)

server.listen(port, (err) => {
    if (err) {
        return console.log('something bad happened', err)
    }
    console.log(`server is listening on ${port}`)
});

