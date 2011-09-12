var async = require('async');
var fs    = require('fs');

var beadChip = function(file) {
  this.rows     = [];
  this.sections = [];
  this.pass     = [];
  this.fail     = [];

  this.init(file);
};

beadChip.prototype.buildBeadChip = function(rows, sections, pass, fail) {

  var parseSection = function(section, callback) {

    var sectionArray = section.split('\t');
    if(sectionArray.length < 2) {
      return; 
    } 

    if(sectionArray[0] != "Date") {
      
      sectionObject = {
        date:     sectionArray[0],
        beadChip: sectionArray[1],
        section:  sectionArray[2],
        focusGrn: Number(sectionArray[3]),
        regGrn:   Number(sectionArray[4]),
        p05Grn:   Number(sectionArray[5]),
        p95Grn:   Number(sectionArray[6]),
        focusRed: Number(sectionArray[7]),
        regRed:   Number(sectionArray[8]),
        p05Red:   Number(sectionArray[9]), 
        p95Red:   Number(sectionArray[10])
      };

      // Conditions for bad section
      if(sectionObject.focusGrn < 0.5 || sectionObject.focusRed < 0.5 || 
        sectionObject.p95Red < 10000 || sectionObject.p95Grn < 10000) {
        fail.push(sectionObject);
      } else {
        pass.push(sectionObject);
      }

      sections.push(sectionObject);
      callback();
    }

    callback();
  };

  async.forEach(rows, parseSection, function(err) {
    if(err) console.log(err);
  });
};

beadChip.prototype.init = function(file) {

  // Localize beadChip members
  var build    = this.buildBeadChip; 
  var rows     = this.rows;
  var sections = this.sections;
  var pass     = this.pass;
  var fail     = this.fail;

  var metricStream = fs.createReadStream(file, {
    flags: 'r',
    encoding: 'utf8',
    mode: 0666
  });

  // Open file and stream data out
  var allData = ""; 
  metricStream.on('open', function(fd) {

    metricStream.on('data', function(data) {
      allData += data;
    });

    metricStream.on('error', function(err) { 
      console.log(err);
    });

    // When EOF, split string on newline
    metricStream.on('end', function() { 

      var eachRow = function(row, callback) {
        rows.push(row);
        callback();
      };

      async.forEach(allData.split('\n'), eachRow, function(err) {
        if(err) console.log(err);

        build(rows, sections, pass, fail); 
      });
    });
  });
};

beadChip.prototype.readRows = function(callback) {

  var sections = this.sections;

  console.log(sections);
  console.log(sections.length + ' rows');
  callback();
};

module.exports = beadChip;
