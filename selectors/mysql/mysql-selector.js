var mysql = require('mysql');

var connection = mysql.createConnection({
    host     : 'se.rv.er.ip',
    user     : 'tester',
    password : 'tester4pass',
    database : 'dbase'
});

connection.connect();

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

    // console.log(request);
    var from_time = queryAsObject.from_time;
    var to_time = queryAsObject.to_time;
    var cuid = queryAsObject.counter_uid;
    var cuids;
    // console.log('qry', queryAsObject);
    if (cuid) {
        cuids = [cuid];
    } else if (queryAsObject.counter_uids){
        cuids = queryAsObject.counter_uids.split(',');
    } else {
	console.log('incorrect query', queryAsObject);
	return;
    }

    // console.log(cuids);
    if(from_time && to_time && cuids && cuids.length) {
            cuids_s = cuids.join(",");
            connection.query("select * from statistics2 WHERE timestamp >= unix_timestamp('"+from_time+"') and timestamp<=unix_timestamp('"+to_time+"') and counter_uid IN (" + cuids_s + ");", function (error, rows, fields) {
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

