package main

import (
	"fmt"
	"io"
	"net/http"
	"time"
)

type chSaver struct {
	apiPoint string
	uri      string
	db       string
	table    string
	auth     *AuthT
}

func (s *chSaver) init() error {
	s.uri = fmt.Sprintf("http://%s/?", s.apiPoint)
	if s.auth != nil {
		s.uri += fmt.Sprintf("user=%s&password=%s", s.auth.user, s.auth.password)
	}
	runTicker()
	return nil
}

func (s *chSaver) store(bunch *packetBunch) {
	if bunch.count == 0 {
		bunchPool.Put(bunch)
		return
	}

	if displayLiveStats {
		fmt.Printf("Storing bunch of %d\n", bunch.count)
	}
	pr, pw := io.Pipe()
	counts := make(chan uint64, 1)
	go func() {
		defer pw.Close()
		fmt.Fprintf(pw, "INSERT INTO %s.%s FORMAT TabSeparated\n", s.db, s.table)
		if logInserts {
			fmt.Printf("INSERT INTO %s.%s FORMAT TabSeparated\n", s.db, s.table)
		}
		pks := bunch.slice
		for i := range pks[:bunch.count] {
			date := time.Unix(int64(pks[i].ts), 0).Format("2006-01-02")
			if logInserts {
				fmt.Printf("%d\t%d\t%s\t%f\n", pks[i].cuid, pks[i].ts, date, pks[i].value)
			}
			if _, err := fmt.Fprintf(pw, "%d\t%d\t%s\t%f\n", pks[i].cuid, pks[i].ts, date, pks[i].value); err != nil {
				msg := fmt.Sprintf("error writing to ClickHouse: %s", err)
				logError(msg)
				cons.input <- "[error] " + msg
			}
		}
		counts <- uint64(bunch.count)
		close(counts)
		bunchPool.Put(bunch)
	}()

	stats.batchStart()

	t := time.Now()
	resp, err := http.Post(s.uri, "text/plain", pr)

	took := time.Since(t)
	if displayLiveStats {
		fmt.Printf("took %f s\n", took.Seconds())
	}

	go func() {
		stats.batchFinish(<-counts, took)
	}()

	if err != nil {
		logError("Error while sending INSERT: '%s'", err.Error())
	}

	if resp == nil || resp.Body == nil {
		return
	}
	if err := resp.Body.Close(); err != nil {
		logError("error closing resp.Body from ClickHouse: '%s'", err.Error())
	}
}
