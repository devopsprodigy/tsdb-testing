package main

import (
	"os"
	"sync"
	"time"

	"github.com/shirou/gopsutil/process"
)

type StatsT struct {
	mu sync.RWMutex

	metricsReceived uint64
	metricsWritten  uint64

	batchesWritten uint64
	batchesQueued  uint64

	batchWriteTimes []time.Duration
	cpuUsage        float64
}

func cpuMonitor() {
	const interval = 10
	pid := int32(os.Getpid())
	ps, _ := process.NewProcess(pid)
	times, _ := ps.Times()
	for {
		time.Sleep(interval * time.Second)
		t2, _ := ps.Times()
		stats.mu.Lock()
		stats.cpuUsage = (t2.Total() - times.Total()) * 100 / interval
		stats.mu.Unlock()
		times = t2
	}
}

func (st *StatsT) batchFinish(count uint64, dur time.Duration) {
	st.mu.Lock()
	defer st.mu.Unlock()

	st.metricsWritten += count
	st.batchesWritten++
	st.batchWriteTimes = append(st.batchWriteTimes, dur)
}

func (st *StatsT) onMetricRcv() {
	st.mu.Lock()
	defer st.mu.Unlock()
	st.metricsReceived++
}
func (st *StatsT) batchStart() {
	st.mu.Lock()
	defer st.mu.Unlock()
	st.batchesQueued++
}

func (st *StatsT) reset() {
	st.mu.Lock()
	defer st.mu.Unlock()

	st.metricsReceived = 0
	st.metricsWritten = 0
	st.batchesWritten = 0
	st.batchesQueued = 0
	st.batchWriteTimes = make([]time.Duration, len(stats.batchWriteTimes))
}
