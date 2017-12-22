var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var elasticsearch = require('elasticsearch');
var cors = require('cors');

app.use(cors());

var client = new elasticsearch.Client({
    host: process.env.ELASTIC_HOST || '192.168.99.100:9200',
});

app.get('/return', function(req, res) {
    client.search({
        index: 'heatmap-collector',
        type: 'mouse-activity',
        body: {
            "aggs": {
            "cordinates-x": {
                "histogram": {
                "field": "x",
                "interval": 20,
                "min_doc_count": 1
                },
                "aggs": {
                "cordinates-y": {
                    "histogram": {
                    "field": "y",
                    "interval": 20,
                    "min_doc_count": 1
                    },
                    "aggs": {
                    "total_value": {
                        "sum": {
                        "field": "value"
                        }
                    }
                    }
                }
                }
            }
            }
        }
      }).then((results) => {
          const arr = []
          results.aggregations['cordinates-x'].buckets.forEach(x => {
              x['cordinates-y'].buckets.forEach(y => {
                  arr.push({
                      x: x.key,
                      y: y.key,
                      value: y.total_value.value,
                  })
              })
          });
          res.json(arr)
      }).catch(res.json)
})

app.get('/return/scrolmap', function(req, res) {
    client.search({
        index: 'heatmap-collector',
        type: 'scroll-activity',
        body: {
            "aggs": {
                "height": {
                    "histogram": {
                        "field": "height",
                        "interval": 20,
                        "min_doc_count": 1
                    },
                    "aggs": {
                        "scrollY": {
                            "histogram": {
                                "field": "scrollY",
                                "interval": 20,
                                "min_doc_count": 1
                            }
                        }
                    }
                }
            }
        }
      }).then((results) => {
          const arr = []
          results.aggregations['height'].buckets.forEach(x => {
            const scrolly = {}
            x['scrollY'].buckets.forEach(y => scrolly[y.key] = y.doc_count)
            arr.push({
                height: x.key,
                scrolly: scrolly,
              })
          });
          res.json(arr)
      }).catch(res.json)
})

io.on('connection', function(socket){
    console.log('a user connected');
    socket.on('disconnect', function(){
        console.log('user disconnected');
    });

    socket.on('mouse event', (body) => {
        client.index({
            index: 'heatmap-collector',
            type: 'mouse-activity',
            body,
        })
    })

    socket.on('scroll event', (body) => {
        client.index({
            index: 'heatmap-collector',
            type: 'scroll-activity',
            body,
        })
    })
});

http.listen(process.env.NODE_PORT || 3000, function(){
    console.log('listening on *:' + process.env.NODE_PORT || 3000);
});
