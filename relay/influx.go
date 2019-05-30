package main

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"time"
)

type influxSaver struct {
	apiPoint string
	confDb   string
	infTable string
	infUri   string
}

func (s *influxSaver) init() error {
	s.infUri = fmt.Sprintf("http://%s/write?db=%s&precision=s", s.apiPoint, s.confDb)
	runTicker()
	return nil
}

func (s *influxSaver) store(bunch *packetBunch) {
	if bunch.count == 0 {
		bunchPool.Put(bunch)
		return
	}

	pr, pw := io.Pipe()

	counts := make(chan uint64, 1)
	go func() {
		defer pw.Close()
		pks := bunch.slice
		for i := range pks[:bunch.count] {
			if _, err := fmt.Fprintf(pw, "%s,cuid=%d value=%f %d\n", s.infTable, pks[i].cuid, pks[i].value, pks[i].ts); err != nil {
				logError("error writing to InfluxDB:", err)
			}
		}
		counts <- uint64(bunch.count)
		close(counts)
		bunchPool.Put(bunch)
	}()

	stats.batchStart()

	t := time.Now()
	resp, err := http.Post(s.infUri, "text/plain", pr)

	took := time.Since(t)
	if displayLiveStats {
		fmt.Printf("Stored %d\ttook %f s\n", bunch.count, took.Seconds())
	}

	go func() {
		stats.batchFinish(<-counts, took)
	}()

	if err != nil {
		log.Printf("Error while sending INSERT: '%s'\n", err.Error())

	}

	if resp == nil || resp.Body == nil {
		return
	}
	if err := resp.Body.Close(); err != nil {
		logError("error closing resp.Body from InfluxDB: '%s'", err.Error())
	}
}
