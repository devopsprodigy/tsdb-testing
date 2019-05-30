package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"strconv"

	"github.com/gorilla/websocket"
)

func panelHandler(w http.ResponseWriter, r *http.Request) {
	content, err := ioutil.ReadFile("html/index.html")
	if err != nil {
		fmt.Println("Could not open file.", err)
	}
	fmt.Fprintf(w, "%s", content)
}

func resetHandler(w http.ResponseWriter, r *http.Request) {
	enableCors(&w)
	stats.reset()
	cons.input <- "[stats reset]"
	fmt.Fprintf(w, "{\"ok\": true}")
}

type httpResp struct {
	Ok    bool   `json:"ok"`
	Error string `json:"string,omitempty"`
}

func resp(err string) []byte {
	var buf []byte
	if err == "" {
		buf, _ = json.Marshal(httpResp{
			Ok: true,
		})
	} else {
		buf, _ = json.Marshal(httpResp{
			Ok:    true,
			Error: err,
		})
	}

	return buf
}

func enableCors(w *http.ResponseWriter) {
	(*w).Header().Set("Access-Control-Allow-Origin", "*")
}

func batchHandler(w http.ResponseWriter, r *http.Request) {
	enableCors(&w)
	if r.Method == http.MethodPost {
		if err := r.ParseForm(); err != nil {
			w.Write(resp("error parsing form: " + err.Error()))
			return
		}
		ss := r.Form["size"][0]
		sz, err := strconv.ParseInt(ss, 10, 32)
		if err != nil {
			msg := fmt.Sprintf("size param error: '%s'", ss)
			w.Write(resp(msg))
			return
		}
		abLock.Lock()
		oldSize := batchSize
		batchSize = int(sz)
		abLock.Unlock()
		cons.input <- fmt.Sprintf("[batch size change] %d -> %d", oldSize, sz)
		w.Write(resp(""))
	} else if r.Method == http.MethodGet {
		fmt.Fprintf(w, "{\"batch_size\": %d}", batchSize)
	} else {
		w.Write(resp("Use POST method"))
	}
}

func wsHandler(ctx context.Context) func(http.ResponseWriter, *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		upgrader := websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
			CheckOrigin:     func(r *http.Request) bool { return true },
		}
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			http.Error(w, "Could not open websocket connection", http.StatusBadRequest)
		}

		go retranslate(ctx, conn)
	}
}

func retranslate(ctx context.Context, conn *websocket.Conn) {
	defer conn.Close()
	ch := make(chan string)
	done := cons.add(ch)
	defer close(done)

	for {
		select {
		case <-ctx.Done():
			return
		case line, ok := <-ch:
			if !ok {
				return
			}
			if err := conn.WriteMessage(1, []byte(line)); err != nil {
				fmt.Println("error while writing to ws conn", err)
				return
			}
		}
	}
}
