const cassandra = require('cassandra-driver');
const client = new cassandra.Client({
    contactPoints: [
        'se.rv.er.ip'
    ],
    localDataCenter: 'dc1',
    keyspace: 'mon'
});

const http = require('http');
const port = 3001;

var url = require("url");

function getDay(from_time,to_time){
    var from_date = from_time.split(' ')[0];
    var to_date = to_time.split(' ')[0];

    var arr_from = from_date.split('-');
    var y_from = parseInt(arr_from[0]);
    var m_from = parseInt(arr_from[1]);
    var d_from = parseInt(arr_from[2]);

    var arr_to = to_date.split('-');
    var y_to = parseInt(arr_to[0]);
    var m_to = parseInt(arr_to[1]);
    var d_to = parseInt(arr_to[2])+1;

    var cd = d_from;
    var d = '';
    while(cd<=d_to){
        if(d!='')d+=',';
        d+="'"+y_from+"-";
        if(m_from<10)d+='0';
        d+=m_from+"-";
        if(cd<10)d+='0';
        d+=cd+"'";

        cd++;
    }
    return d;
}

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

        var day = getDay(from_time,to_time);
        console.log('day:', day);

        /*
        //client.execute("select * from metrics_raw WHERE counter_uid="+cuid+" and day in("+day+") and ts >= '"+from_time+"' and ts <= '"+to_time+"';")
        client.execute("select * from metrics_raw WHERE counter_uid="+cuid+" and day in("+day+") limit 1000000000;")
            .then(result => {
                l = result.rows.length;
                var t2 = new Date();
                t = t2 - t1;
                response.end("Got " + l + " rows via " + t + " ms");
            });*/
        var q;
        client.eachRow(q = "select * from metrics_raw WHERE counter_uid IN (" + cuids.join(',') + ") and day in("+day+");", [], { autoPage: true }, function (n, row) {
            //console.log(n,row);
            l++;
        }, function(){
            //l = result.rows.length;
            var t2 = new Date();
            t = t2 - t1;
            response.end("Got " + l + " rows via " + t + " ms");
        });
        console.log(q);
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

