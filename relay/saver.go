package main

import (
	"bufio"
	"bytes"
	"context"
	"fmt"
	"net"
	"os"
	"sync"
	"time"
)

const (
	tickTime = time.Second * 5
)

var (
	batchSize = 3000
)

type UID uint64
type timeStamp uint32
type dataPacket struct {
	cuid  UID
	ts    timeStamp
	value float64
}

type packetBunch struct {
	slice []dataPacket
	count int
	touch bool
	mu    sync.RWMutex
}

var (
	abLock      sync.Mutex
	activeBunch *packetBunch
	debugMode   bool
)

var stats = StatsT{
	batchWriteTimes: make([]time.Duration, 0, 10),
}

var errLog = os.Stderr

type commonSaver interface {
	init() error
	store(bunch *packetBunch)
}

func runTicker() *time.Ticker {
	ticker := time.NewTicker(tickTime)
	go func() {
		for range ticker.C {
			if activeBunch.count > 0 && !activeBunch.touch {
				abLock.Lock()
				switchBunch()
				abLock.Unlock()
			}
			activeBunch.touch = false
		}
	}()
	return ticker
}

var bunchPool = sync.Pool{
	New: func() interface{} {
		t := &packetBunch{
			slice: make([]dataPacket, batchSize),
		}
		return t
	},
}

func newBunch() *packetBunch {
	b := bunchPool.Get().(*packetBunch)
	b.count = 0
	b.touch = false
	return b
}

func (bunch *packetBunch) store(saver commonSaver) {
	saver.store(bunch)
}

func (bunch *packetBunch) addPacketLk(packet dataPacket) bool {
	// should be run in locked context
	if bunch.count < len(bunch.slice) {
		bunch.slice[bunch.count] = packet
	} else {
		bunch.slice = append(bunch.slice, packet)
	}
	bunch.count++
	return bunch.count >= batchSize
}

func logError(format string, args ...interface{}) {
	fmt.Fprintf(errLog, format, args...)
	fmt.Fprintln(errLog)
}

var toSaver chan<- *packetBunch
var prevAllocAt = time.Now()

// switchBunch Switches the active bunch
// This should be done within when the mutex is locked
const displayLiveStats = false

var logInserts = false

func switchBunch() {
	if displayLiveStats {
		fmt.Printf("T fill = %f\t", time.Since(prevAllocAt).Seconds())
	}

	toSaver <- activeBunch
	activeBunch = newBunch()
	prevAllocAt = time.Now()
}

const maxLineSize = 50

// buffer pool to reduce GC
var buffers = sync.Pool{
	New: func() interface{} {
		return make([]byte, 0, maxLineSize)
	},
}

// getByteSlice fetches a buffer from the pool
func getByteSlice() []byte {
	return buffers.Get().([]byte)
}

// releaseByteSlice returns a buffer to the pool
func releaseByteSlice(buf []byte) {
	buffers.Put(buf[:0])
}

func handleRequest(ctx context.Context, conn net.Conn, ch chan dataPacket) {
	defer func() {
		//fmt.Println("Closing connection")
		conn.Close()
	}()

	scanner := bufio.NewScanner(conn)

	buf := getByteSlice()
	scanner.Buffer(buf, maxLineSize)
	if debugMode {
		fmt.Printf("going to scan with buffer %p\n", buf)
	}

	for scanner.Scan() {
		var packet dataPacket
		buf = scanner.Bytes()

		rd := bytes.NewReader(buf)

		if debugMode {
			fmt.Printf("(%d)", len(buf))
		}
		n, err := fmt.Fscan(rd, &packet.cuid, &packet.ts, &packet.value)
		if n == 3 && err == nil {
			stats.onMetricRcv()
			ch <- packet
		}
	}
	if err := scanner.Err(); err != nil {
		fmt.Fprintln(errLog, "error while scanner.Scan():", err)
	}
	if debugMode {
		fmt.Printf("releasing %p len=%d cap=%d\n", buf, len(buf), cap(buf))
	}
	releaseByteSlice(buf)
}

func runSaver(ctx context.Context, wg *sync.WaitGroup, saver commonSaver) chan<- *packetBunch {
	ch := make(chan *packetBunch)
	wg.Add(1)
	go func() {
		defer wg.Done()

		var lwg sync.WaitGroup
		defer lwg.Wait()

		workers := make(chan struct{}, 100)
		for {
			select {
			case <-ctx.Done():
				return
			case bunch, ok := <-ch:
				if !ok {
					return
				}
				workers <- struct{}{}
				lwg.Add(1)
				go func() {
					defer lwg.Done()
					saver.store(bunch)
					<-workers
				}()
			}
		}
	}()
	return ch
}
