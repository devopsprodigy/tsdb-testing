package main

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

	_ "github.com/go-sql-driver/mysql"
)

type mysqlSaver struct {
	tcpSocket string
	auth      *AuthT
	db        string
	table     string
	link      *sql.DB
}

func (s *mysqlSaver) init() error {
	var err error

	s.link, err = sql.Open("mysql", fmt.Sprintf("%s:%s@tcp(%s)/%s", s.auth.user, s.auth.password, s.tcpSocket, s.db))
	fmt.Printf("connected to mysql '%s:%s@tcp(%s)/%s'\n", s.auth.user, s.auth.password, s.tcpSocket, s.db)

	if err != nil {
		return err
	}
	runTicker()
	return nil
}

func (s *mysqlSaver) store(bunch *packetBunch) {
	if bunch.count == 0 {
		bunchPool.Put(bunch)
		return
	}

	go func() {
		pks := bunch.slice

		var buf strings.Builder
		buf.WriteString(fmt.Sprintf("INSERT INTO %s (counter_uid, timestamp, value) VALUES ", s.table))

		for i := range pks[:bunch.count] {
			if i != 0 {
				fmt.Fprintf(&buf, ",")
			}
			if _, err := fmt.Fprintf(&buf, "(%d, %d, %f)", pks[i].cuid, pks[i].ts, pks[i].value); err != nil {
				logError("error writing to MySQL:", err)
			}
		}
		stats.batchStart()

		t := time.Now()
		if rows, err := s.link.Query(buf.String()); err != nil {
			logError("error while inserting into MySQL:", err)
		} else {
			rows.Close()
			took := time.Since(t)
			if displayLiveStats {
				fmt.Printf("Stored %d\ttook %f s\n", bunch.count, took.Seconds())
			}
			stats.batchFinish(uint64(bunch.count), took)
		}
		bunchPool.Put(bunch)
	}()
}
