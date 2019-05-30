package dop.tsdbt;

import com.datastax.driver.core.*;
import com.datastax.driver.core.policies.LoadBalancingPolicy;
import com.datastax.driver.core.policies.RoundRobinPolicy;
import com.datastax.driver.core.BatchStatement;
import com.datastax.driver.core.policies.TokenAwarePolicy;

import java.sql.Timestamp;
import java.time.format.DateTimeFormatter;
import java.util.Random;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;


class cassandraLoadTest {

    cassandraLoadTest() {
    }

    //TODO: move configuration to configurable thingie
    private Session getCassandraSession() {
        PoolingOptions poolOpts = new PoolingOptions();
        LoadBalancingPolicy loadBalancingPolicy = new TokenAwarePolicy(new RoundRobinPolicy());
        poolOpts.setConnectionsPerHost(HostDistance.LOCAL, 20, 50)
                .setConnectionsPerHost(HostDistance.REMOTE, 20, 50)
                .setHeartbeatIntervalSeconds(10)
                .setMaxQueueSize(8192)
        ;
        Cluster cluster = Cluster.builder()
                // 172.31.46.202
                // 172.31.45.144
                // 172.31.37.206
                // -db mon -table metrics_raw -batch 1
                .addContactPoints("172.31.46.202", "172.31.45.144", "172.31.37.206")
                .withPoolingOptions(poolOpts)
                .withLoadBalancingPolicy(loadBalancingPolicy)
                .build();

        Session session = cluster.connect();

        ScheduledExecutorService scheduled = Executors.newScheduledThreadPool(1);
        scheduled.scheduleAtFixedRate(() -> {
            // Print stats each 5s
            Session.State state = session.getState();
            for (Host host : state.getConnectedHosts()) {
                HostDistance distance = loadBalancingPolicy.distance(host);
                int connections = state.getOpenConnections(host);
                int inFlightQueries = state.getInFlightQueries(host);
                System.out.printf("%s connections=%d, current load=%d, maxload=%d%n",
                        host, connections, inFlightQueries,
                        connections *
                                poolOpts.getMaxRequestsPerConnection(distance));
            }
        }, 5, 5, TimeUnit.SECONDS);
        return session;
    }

    void rtLoad(long counters, int interval, int batchSize, boolean async) {
        long next, ts = System.currentTimeMillis();
        Random random = new Random();

        final int minutes = 5;
        final String
                keyspace = "mon",
                table="metrics_raw";
        Session session = this.getCassandraSession();
        BatchStatement[] batches = new BatchStatement[(int) Math.ceil(counters / batchSize) + 1];
        ResultSetFuture[] futures = new ResultSetFuture[batches.length];

        System.out.println(String.format("started with batch size %d", batchSize));
        long till = ts + minutes * 60 * 1000;
        while (true) {
            BatchStatement batch; //  = new BatchStatement(); // loadT.getBatchStatementForIteration(ts, counters, "mon", "metrics_raw");
            Timestamp time = new Timestamp(ts);
            DateTimeFormatter dtf = DateTimeFormatter.ofPattern("yyyy-MM-dd");
            String day = dtf.format(time.toLocalDateTime());

            int pct, cnt = 0, bi = 0;
            batches[bi++] = batch = new BatchStatement();
            for (long cuid = 1; cuid <= counters; cuid++, cnt++) {
                if (cnt >= batchSize) {
                    pct = cnt;
                    cnt = 0;
                    try {
                        batches[bi++] = batch = new BatchStatement();
                    } catch (java.lang.ArrayIndexOutOfBoundsException e) {
                        System.out.println(String.format(
                                "bi = %d, cuid = %d, cnt was %d; len = %d, counters= %d", bi, cuid, pct, batches.length, counters
                        ));
                    }
                }

                String q = String.format("INSERT INTO %s.%s (counter_uid,ts,day,value) VALUES (%d,'%s','%s',%f)",
                        keyspace, table, cuid, time.toString(), day, random.nextFloat());
                batch.add(new SimpleStatement(q));
            }

            long started = System.currentTimeMillis();

            for (int i = 0; i < bi; i ++) {
                if (async) {
                    futures[i] = session.executeAsync(batches[i]);
                }
                else {
                    session.execute(batches[i]);
                }
            }

            if (async) {
                for (int i = 0; i < bi; i ++) {
                    try {
                        ResultSet rs = futures[i].get(10, TimeUnit.SECONDS);
                        // ExecutionInfo info = rs.getExecutionInfo();
                        if (!rs.wasApplied()) {
                            System.out.println("not applied");
                        }
//                        System.out.println("Execution info: " + (rs.wasApplied() ? "applied" : "not applied"));
//                        System.out.println(info.toString());
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                }
            }

            long now = System.currentTimeMillis();

            {
                long took = now - started;
                String prefix = async ? "async" : "sync";
                System.out.println(String.format("[%s] inserted %d records in %d batches (by %d), took %d ms, %f ms/batch",
                        prefix, counters, bi, batchSize, took, (double) took / (double) bi));
            }

            next = ts + interval * 1000;
            if (now < next) {
                try {
                    Thread.sleep(next - now);
                } catch (InterruptedException ex) {
                    Thread.currentThread().interrupt();
                }
            }
            if (next > till) {
                System.out.println("Finishing");
                break;
            } else {
                System.out.println("left " + Math.round((till - next) / 1000) + "s");
            }
            ts = next;
        }

        try {
            Thread.sleep(10 * 1000);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
        }
    }

}
