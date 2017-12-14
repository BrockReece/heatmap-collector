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
});

http.listen(3000, function(){
  console.log('listening on *:3000');
});