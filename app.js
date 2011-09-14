var fs      = require('fs');
var sys     = require('sys');
var async   = require('async');
var url     = require('url');
var express = require('express');

var path    = '/mnt/iScanLogs';

var beadChip = require('./beadChip.js');

var metricsFiles = [];
var beadChips    = [];

// scanMetrics populates the global beadChips array,
// which stores all parsed beadChip Metrics.txt in path
var scanMetrics = function() {

  var singleScan = function(file, callback) {
  
    var path      = file;
    var fileArray = file.split('/');
    
    var name = fileArray[fileArray.length - 1];
    var bead = fileArray[fileArray.length - 2];
    
    fs.stat('archive/' + bead + '_' + name, function(err, stats) {
      if(err) {
  
        // READ UP SOURCE FILE AND WRITE TO ARCHIVE DESTINATION
        var metricStream = fs.createReadStream(path, {
          flags: 'r',
          encoding: 'utf8',
          mode: 0666
        });

        var archiveStream = fs.createWriteStream('archive/' + bead + '_' + name, {
          flags: 'w',
          encoding: 'utf8',
          mode: 0775
        });

        // Open file and stream data out
        metricStream.on('open', function(fd) {

          metricStream.on('data', function(data) {
            archiveStream.write(data, 'utf8');
          });

          metricStream.on('error', function(err) { 
            console.log(err);
          });

          // When EOF, split string on newline
          metricStream.on('end', function() { 
            beadChips.push(new beadChip('archive/' + bead + '_' + name));
            callback();
          });
        });
      } else {
        beadChips.push(new beadChip('archive/' + bead + '_' + name));
        callback();
      }
    });
  };

  async.forEach(metricsFiles, singleScan, function(err) {
    if(err) console.log(err);
    
    console.log(beadChips.length + ' beadchips initialized from archive'); 
  });
};


// archiveMetrics will scan path for any new files to save into the archive
var archiveMetrics = function() {
  
  var processFile = function(file, callback) {
    fs.stat(path + '/' + file, function(err, stats) {
      if(stats.isDirectory()) {
        fs.stat(path + '/' + file + '/Metrics.txt', function(err, stats) {
          if(err) {
            callback();
          } else {
            metricsFiles.push(path + '/' + file + '/Metrics.txt');
            callback();
          }
        })
      } else callback();
    });    
  };

  fs.readdir(path, function(err, files) {
    if(err) console.log(err);
    
    async.forEach(files, processFile, function(err) {
      if(err) console.log(err);      
      scanMetrics();
    });
  });
};

// stat('archive'), Create the archive folder if it doesnt already exist,
// else run archiveMetrics
fs.stat('archive', function(err, stats) {
  if(err) {
    fs.mkdir('archive', 0755, function() {
      archiveMetrics();
    });
  } else {
    archiveMetrics();
  }
});

// populateMetrics populates the global metricsFiles array,
// which the scanMetrics function will consume
/*
var populateMetrics = function() {
  var addMetric = function(file, callback) {
      fs.stat(path + '/' + file, function(err, stats) {
        if(stats.isDirectory()) {
          fs.stat(path + '/' + file + '/Metrics.txt', function(err, stats) {
            if(err) {
              callback();
            } else {
              metricsFiles.push(path + '/' + file + '/Metrics.txt');
              callback();
            }
          })
        } else callback();
      });    
  };

  fs.readdir(path, function(err, files) {
    if(err) console.log(err);

    async.forEach(files, addMetric, function(err) {
      if(err) console.log(err);
      console.log('************************\n' + metricsFiles.length + ' metric files found');
      scanMetrics();
    });
  });
};
*/







// Begin parsing the logs.  populateMetrics automatically calls scanMetrics
// block for now.     populateMetrics();


// Here begins the web server, our front end interface
var app = module.exports = express.createServer();

var io  = require('socket.io').listen(app);

// Configuration for app webserver
app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use('/extjs', express.static(__dirname + '/extjs'));
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});

app.configure('production', function(){
  app.use(express.errorHandler()); 
});

// Routes
// ******
// GET '/'
app.get('/', function(req, res){
  res.render('index', {
    title: 'iScan Metrics'
  });
});

// GET '/beadchips.read'
app.get('/beadchips.read', function(req, res) {

  var docs = [];
 
  var eachDoc = function(item, callback) {
    doc = {
      date:     item.sections[0].date, 
      beadChip: item.sections[0].beadChip,
      sections: item.sections.length,
      pass:     item.pass.length,
      fail:     item.fail.length
    };

    docs.push(doc);
    callback();
  };
  
  async.forEach(beadChips, eachDoc, function() {
    var results = {
      success: true,
      results: docs.length,
      items: docs
    };

    res.send(results);
  });
});

// GET '/sections.read'
app.get('/sections.read', function(req, res) {
  var query = url.parse(req.url, true).query;

  var beadChip_id = query.beadChip;

  beadChips.forEach(function(beadChip) {
    if(beadChip.sections[0].beadChip == beadChip_id) {
      var results = {
        success: true,
        results: beadChip.sections.length,
        items: beadChip.sections
      };
 
      res.send(results);

      return;
    } 
  });
});

// GET '/failedSections.read'
app.get('/failedSections.read', function(req, res) {
  var query = url.parse(req.url, true).query;

  var beadChip_id = query.beadChip;

  beadChips.forEach(function(beadChip) {
    if(beadChip.sections[0].beadChip == beadChip_id) {
      var results = {
        success: true,
        results: beadChip.fail.length,
        items: beadChip.fail
      };
 
      res.send(results);

      return;
    } 
  });
});

// GET '/passedSections.read'
app.get('/passedSections.read', function(req, res) {
  var query = url.parse(req.url, true).query;

  var beadChip_id = query.beadChip;

  beadChips.forEach(function(beadChip) {
    if(beadChip.sections[0].beadChip == beadChip_id) {
      var results = {
        success: true,
        results: beadChip.pass.length,
        items: beadChip.pass
      };
 
      res.send(results);

      return;
    } 
  });
});

// Socket.io stuff
io.sockets.on('connection', function(socket) {
  console.log('socket_id: '  + socket.id + ' has connected');
  
  socket.emit('connection received', {
    timestamp: Date.now(),
    socket_id: socket.id
  });
});

//  Start httpd process
app.listen(3000);
console.log("extstack server listening on port %d in %s mode", app.address().port, app.settings.env);
