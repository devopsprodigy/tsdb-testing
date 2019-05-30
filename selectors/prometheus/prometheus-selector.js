const http = require('http');
const port = 3001;

var url = require("url");

const requestHandler = (request, response) => {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Request-Method', '*');
    response.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET');
    response.setHeader('Access-Control-Allow-Headers', '*');

    var l = 0;
    var t = 0;

    var t1 = new Date();

    var parsedUrl = url.parse(request.url, true); // true to get query as object
    var queryAsObject = parsedUrl.query;

    var from_time = queryAsObject.from_time;
    var to_time = queryAsObject.to_time;
    var cuid = queryAsObject.counter_uid;
    var step = queryAsObject.step;

    if(from_time && to_time && cuid && step) {
        var request = require('request');

        var query;
        if(cuid.indexOf(",")==-1){
            query = 'counter'+cuid+'{job="staticfile0"}'
        }else{
            var cuids = cuid.split(",")
            query = '{__name__=~"counter'+cuids.join("|counter")+'",job="staticfile0"}'
        }

        var propertiesObject = { query:query,start:from_time,end:to_time,step:step };

        request({url:'http://127.0.0.1:9090/api/v1/query_range', qs:propertiesObject}, function(err, resp, body) {
            if(err) { console.log(err); return; }
            var j = JSON.parse(body);
            if(!j.data){
                response.end('---error: '+j.error+'---');
                return;
            }
            if(typeof j.data == undefined){
                response.end('----');
                return;
            }
            if(!j.data.result[0]){
                response.end('-----no data-----');
                return;
            }
            if(typeof j.data.result[0] == undefined) {
                response.end('------');
                return;
            }
            l=0;
            for(var k in j.data.result){
                l+=j.data.result[k].values.length
            }
            //l = j.data.result[0].values.length;
            var t2 = new Date();
            t = t2 - t1;


            var output = "Got " + l + " rows via " + t + " ms";
            output += "\n";
            output += new Date(j.data.result[0].values[0][0] * 1000);
            output += "\n";
            output += new Date(j.data.result[0].values[ j.data.result[0].values.length-1 ][0] * 1000);
            output += "\n";
            response.end(output);

        });
    }else{
        response.end('--');
    }
};

const server = http.createServer(requestHandler)

server.listen(port, (err) => {
    if (err) {
        return console.log('something bad happened', err)
    }
    console.log(`server is listening on ${port}`)
});

