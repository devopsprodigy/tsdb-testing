const DbRelay = require('./db-relay');

class Loader {
    constructor(targetHost, pargetPort) {
        this.targetHost = targetHost;
        this.pargetPort = pargetPort || 4323;
        this.relay = new DbRelay(this.targetHost, this.pargetPort, 20000);
        this.relay.debugMode = true;
        // this.relay.debugCmdMode = true;
        this.relay.connect();
        this.running = false;
        this.stopFlag = false;
    }

    send(cuid, ts) {
        const self = this;
        setImmediate(function () {
            self.relay.send(cuid, ts, Math.random()*2147483648);
            // console.log(j+1, ts)
        });
    }

    modify(cuidFrom, cuidTo, interval) {
        this.unscheduleNext();
        this.cuidFrom = cuidFrom;
        this.cuidTo = cuidTo;
        this.interval = interval;

        const nextIterN = this.ts.length - 1;
        this.scheduleNext(nextIterN);
    }

    unscheduleNext() {
        if (this.nextIter) {
            clearTimeout(this.nextIter);
            this.nextIter = false;
        }
    }

    cleanup() {
        this.ts = [];
        this.nextIter = false;
        this.stopFlag = true;
        this.running = false;
    }
    iterate(iter, last) {
        if (this.stopFlag) {
            return;
        }
        const ts = this.ts[iter];
        console.log(`== start sending iterate ${iter} ts ${ts} ==`);

        for (let cuid = this.cuidFrom; cuid <= this.cuidTo; cuid++) {
            if (this.stopFlag) {
                return;
            }
            this.send(cuid, ts)
        }
        console.log(`== end sending iterate ${iter} ==`);
        if (last) {
            console.log('reached last iteration, cleaning up');
            this.cleanup();
        }
    }

    scheduleNext(iter) {
        const nextTs = this.ts[iter-1] + this.interval;
        if (nextTs >= this.till) {
            console.log("scheduleNext() won't schedule since", `${nextTs} >= ${this.till}`);
            this.nextIter = false;
            return false;
        }
        this.ts[iter] = nextTs;
        const self = this;
        this.nextIter = setTimeout(function () {
            const last = !self.scheduleNext(iter + 1);
            self.iterate(iter, last);
        }, this.interval * 1000);
        return true;
    };

    start(cuidFrom, cuidTo, interval, startTs, minutes) {
        console.log(`sending to ${this.targetHost}:${this.pargetPort} counters ${cuidFrom}-${cuidTo} for ${minutes} minutes with interval ${interval} `);

        this.cuidFrom = cuidFrom;
        this.cuidTo = cuidTo;
        this.interval = interval;
        this.ts = [startTs];
        this.till = startTs + minutes * 60;

        this.running = true;

        // const iterate = function (self, iter) {
        //     if (self.stopFlag) {
        //         return;
        //     }
        //     const ts = self.ts[iter];
        //     console.log(`== start sending iterate ${iter} ts ${ts} ==`);
        //
        //     for (let cuid = self.cuidFrom; cuid <= self.cuidTo; cuid++) {
        //         if (self.stopFlag) {
        //             return;
        //         }
        //         self.send(cuid, ts)
        //     }
        //     console.log(`== end sending iterate ${iter} ==`);
        // };

        // const scheduleNext = function (iter) {
        //     const nextTs = self.ts[iter-1] + self.interval;
        //     if (nextTs > self.till) {
        //         console.log('scheduleNext returned false because', `${nextTs} > ${self.till}`);
        //         return false;
        //     }
        //     self.ts[iter] = nextTs;
        //     return setTimeout(function () {
        //         self.nextIter = scheduleNext(iter + 1);
        //         self.iterate(iter);
        //     }, self.interval * 1000);
        // };

        this.scheduleNext(1);

        const self = this;
        setTimeout(function () {
            self.iterate(0);
        }, 0);

        // for (let i = 0; i < steps; i++) {
        //     (function(i) {
        //         setTimeout(function () {
        //             iterate(self, i);
        //         }, i * interval * 1000);
        //     })(i);
        // }
    }

    stop() {
        this.unscheduleNext();
        this.ts = [];
        this.nextIter = false;
        this.stopFlag = true;
        this.running = false;
    }
}

module.exports = Loader;

