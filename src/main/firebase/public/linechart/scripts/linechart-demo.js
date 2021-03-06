require(['db', 'linechart'], function(db, linechart) {
  var lineArr = [];
    var MAX_LENGTH = 100;
    var duration = 500;
    var chart = linechart();

    function updateData(doc) {
      var lineData = {
        time: doc.timestamp,
        min: doc.stats.min,
        max: doc.stats.max,
        mean: Math.round(doc.stats.mean * 100) / 100
      };
      lineArr.push(lineData);

      if (lineArr.length > 30) {
        lineArr.shift();
      }
      d3.select("#chart").datum(lineArr).call(chart);
    }

    function resize() {
      if (d3.select("#chart svg").empty()) {
        return;
      }
      chart.width(+d3.select("#chart").style("width").replace(/(px)/g, ""));
      d3.select("#chart").call(chart);
    }

    db.collection("demo_gas_price").orderBy("timestamp", "desc").limit(30)
        .onSnapshot(function(querySnapshot) {
            lineArr = []
            querySnapshot.forEach(function(doc) {
                updateData(doc.data());
            });
    });


    d3.select(window).on('resize', resize);
});
