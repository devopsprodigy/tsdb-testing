package main

import (
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/gocql/gocql"
)

type cassSaver struct {
	nodes      []string
	db         string
	table      string
	auth       *AuthT
	cluster    *gocql.ClusterConfig
	session    *gocql.Session
	insertStmt string
	qry        *gocql.Query
}

func (s *cassSaver) init() error {
	println("nodes:", strings.Join(s.nodes, " | "))
	s.cluster = gocql.NewCluster(s.nodes...)
	s.cluster.Keyspace = s.db

	s.insertStmt = fmt.Sprintf("INSERT INTO %s (counter_uid, ts, day, value) VALUES (?, ?, ?, ?)", s.table)
	var err error
	if s.session, err = s.cluster.CreateSession(); err != nil {
		return err
	}

	s.qry = s.session.Query(s.insertStmt)
	return nil
}

func (s *cassSaver) store(bunch *packetBunch) {
	stats.batchStart()

	t := time.Now()
	pks := bunch.slice
	var wg sync.WaitGroup
	wg.Add(bunch.count)
	for i := range pks[:bunch.count] {
		go func(i int) {
			ts := time.Unix(int64(pks[i].ts), 0)
			day := time.Unix(int64(pks[i].ts), 0).Format("2006-01-02")
			stmt := s.qry.Bind(pks[i].cuid, ts, day, pks[i].value)
			stmt.GetRoutingKey()
			err := stmt.Exec()
			if err != nil {
				logError("error writing to Cassandra:", err)
			}
		}(i)
	}
	wg.Wait()
	took := time.Since(t)
	if displayLiveStats {
		fmt.Printf("Stored %d\ttook %f s\n", bunch.count, took.Seconds())
	}
	stats.batchFinish(uint64(bunch.count), took)
	bunchPool.Put(bunch)
}
