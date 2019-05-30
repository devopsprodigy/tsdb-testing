const { ClickHouse } = require('clickhouse');
const clickhouse = new ClickHouse({
    url: 'http://se.rv.er.ip',
    port: 8123,
    debug: false,
    basicAuth: {
        username: 'default',
        password: 'pass',
    },
    isUseGzip: false,
    config: {
        session_timeout                         : 60,
        output_format_json_quote_64bit_integers : 0,
        enable_http_compression                 : 0
    }
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

    if(from_time && to_time && cuids) {
        clickhouse.query("select * from mon.stats_dist WHERE timestamp >= '"
                +from_time+"' and timestamp<='"+to_time
                +"' and counter_uid IN ("+cuids.join(',')+");").exec(function (err, rows) {
            l = rows.length;
            var t2 = new Date();
            t = t2 - t1;
            response.end("Got " + l + " rows via " + t + " ms");
        });
    }else{
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

