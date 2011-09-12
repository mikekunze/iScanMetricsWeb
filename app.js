var fs      = require('fs');
var sys     = require('sys');
var async   = require('async');
var url     = require('url');
var express = require('express');

var path    = '/mnt/iScanLogs';

var beadChip = require('./beadChip.js');

var metricsFiles = [];
var beadChips    = [];

var populateMetrics = function() {
  metricsFiles = [];

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

var scanMetrics = function() {
  beadChips = [];

  var singleScan = function(file, callback) {
    beadChips.push(new beadChip(file));
    callback();
  };

  async.forEach(metricsFiles, singleScan, function(err) {
    console.log(beadChips.length + ' beadchips initialized\n************************'); 
  });
};

populateMetrics();


var app = module.exports = express.createServer();

var io  = require('socket.io').listen(app);
// Configuration

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

app.get('/', function(req, res){
  res.render('index', {
    title: 'iScan Metrics'
  });
});

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

app.listen(80);
console.log("extstack server listening on port %d in %s mode", app.address().port, app.settings.env);
