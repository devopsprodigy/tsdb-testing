package dop.tsdbt;

public class stressTest {

    public static void main(String[] args) {
        int servers = 100;
        int interval = 15;

        if (args.length < 2) {
            System.err.println("Usage: cmd <servers> <interval> <batch> [sync]");
            System.exit(1);
        }

        int batchSize = 3000;

        try {
            servers = Integer.parseInt(args[0]);
            interval = Integer.parseInt(args[1]);
            if (args.length >= 3) {
                batchSize = Integer.parseInt(args[2]);
            }
        } catch (NumberFormatException e) {
            System.err.println("Arguments must be integer");
            System.exit(1);
        }

        boolean async = true;

        if (args.length >= 4) {
            if (args[3].equals("sync")) {
                async = false;
            }
        }

        long counters = servers * 125;

        cassandraLoadTest test = new cassandraLoadTest();
        test.rtLoad(counters, interval, batchSize, async);
    }
}



