require(['db'], function (db) {
 
  var width = 1000;
  var height = 1000;
  var svg = d3.select("svg")
    .style("width", width)
    .style("height", height),
  defs = svg.selectAll('defs').data([1]).enter().append('defs');
  
  defs
    .append('marker')
      .attr('id', 'end-arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 6)
      .attr('markerWidth', 3)
      .attr('markerHeight', 3)
      .attr('orient', 'auto')
      .append('svg:path')
        .style("opacity", 0.9)
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', '#AAAAAA'); //TODO move to CSS

  defs
    .append('marker')
      .attr('id', 'start-arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 4)
      .attr('markerWidth', 3)
      .attr('markerHeight', 3)
      .attr('orient', 'auto')
      .append('svg:path')
        .style("opacity", 0.9)
        .attr('d', 'M10,-5L0,0L10,5')
        .attr('fill', '#AAAAAA'); //TODO move to css


  var link, node, uLinks = {}, dLinks = {},
    links = svg.append("g")
      .attr("class", "links"),
    nodes = svg.append("g")
      .attr("class", "nodes")
    

  function ticked() {

    link.attr('d', function(d) {

      var deltaX, deltaY,
        rB1 = d.source.r,
        rB2 = d.target.r,
        rA1 = rB1,
        rA2 = rB2;

      if(d.source.x == d.target.x) {
        deltaX = d.source.r + 2;
        deltaY = d.source.r + 2;         
      }else{ 
        deltaX = d.target.x - d.source.x;
        deltaY = d.target.y - d.source.y;       
      }
       var alfa = Math.atan( deltaX / deltaY ),          
        dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY),
        normX = deltaX / dist,
        normY = deltaY / dist,s
        r1 = 1 / Math.sqrt( Math.pow( Math.sin( alfa) / rB1, 2) + Math.pow( Math.cos( alfa) / rA1, 2) ),        
        r2 = 1 / Math.sqrt( Math.pow( Math.sin( alfa) / rB2, 2) + Math.pow( Math.cos( alfa) / rA2, 2) ),                
        sourcePadding = r1 + 1,
        targetPadding = r2 + 5 - (d.value  < 2 ? 2 - d.value : 0),
          
        sourceX = d.source.x + (sourcePadding * normX),
        sourceY = d.source.y + (sourcePadding * normY),
        targetX = d.target.x - (targetPadding * normX),
        targetY = d.target.y - (targetPadding * normY);
        if(d.source.x == d.target.x) {
          return `M ${sourceX} ${sourceY} 	
            Q ${sourceX + 25} ${sourceY + 25} ${sourceX + 30} ${sourceY-3}
            Q ${sourceX +30} ${sourceY - 50} ${sourceX } ${targetY}`;
        }  

        if(uLinks[ d.target.id + '-' + d.source.id]) { // if there is another link in reverse direction             
            var side = d.source.id < d.target.id ? 1: -1, // link side shift (left/right)
                center = { x: (d.source.x + d.target.x)/2 , y: (d.source.y + d.target.y)/2 },
                angle =   side*alfa, //pos*Math.atan2(d.source.x - d.target.x,d.source.y - d.target.y),
                shiftValue = {x: side*Math.cos(angle), y:  Math.sin(angle)};

            return `M ${sourceX } ${sourceY } 	
                Q ${center.x + 40*shiftValue.x} ${center.y - 40*shiftValue.y} ${targetX + 4*shiftValue.x } ${targetY - 4*shiftValue.y}`;
        } 

        return 'M' + sourceX + ',' + sourceY + 'L' + targetX + ',' + targetY;
          
    });

      node.attr("transform", d => "translate(" + d.x + "," + d.y + ")");    
  }

  var simulation = d3.forceSimulation()
    .force("link",
      d3.forceLink()
        .id(function (d) { return d.id; })
        .strength(0.01)
        .distance(function (d) {
          return 300/(1+d.value);
        })
        //.strength(function (d) { return d.intra == 1 ?  1 : 0.1 })
        //.distance(function (d) { return d.intra == 1 ? 0.01 : 300/1+d.value })
    )
    .force("charge", d3.forceManyBody().strength(-140)
//      .distanceMax(80)
      .distanceMin(10)
    )
   // .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collide",d3.forceCollide( d => d.r +20).strength(0.01).iterations(100))
    .force("y", d3.forceY().y( height/2 ).strength(0.04))
    .force("x", d3.forceX().x( width/2 ).strength(0.04))
   

  function findLink(links, source, target) {
    var i;
    for (i = 0; i < links.length; i++) {
      if (links[i].source == source && links[i].target == target) {
        return links[i];
      }
    }
    return null;
  };

  d3.json("https://raw.githubusercontent.com/allenday/force-layout-from-csv/master/empty.json", function (error, graph) {
    if (error) throw error;
    // add nodes collection
    graph.nodes = [];
    var uNodes = {};
    

    db.collection("demo3").doc('latest').collection('volume')
      .onSnapshot(querySnapshot => {
        querySnapshot.docChanges().forEach(change => {
          var link, node, key;
          var data = change.doc.data();
       
          var amount = data["amount"] / 10e18;

          var source = data.from;
          var target = data.to;
          var source_exchange = data.from.replace("_hw", "").replace("_uw", "");
          var source_type = data.from.match(/_(.+)|(unknown)/)[1];
          var target_exchange = data.to.replace("_hw", "").replace("_uw", "");
          var target_type = data.to.match(/_(.+)|(unknown)/)[1];

          var value = 0.001 + amount;
          var intra = 0;
          if (source_exchange == target_exchange) {
            value = 1;
            intra = 1;
          }

          if (source != target) { //&& source != 'unknown' && target != 'unknown') {
          
            if (!uNodes[source_exchange]) {
              uNodes[source_exchange] = { id: source_exchange, group: 1, values : { hw :0, uw :0} };
            }              
            uNodes[source_exchange].values[source_type] -= amount;
              
            if (!uNodes[target_exchange]) {
              uNodes[target_exchange] = { id: target_exchange, group: 1, values : { hw :0, uw :0} };
            }              
            uNodes[target_exchange].values[target_type] += amount;

          // create or update links
            key = source_exchange + '-' + target_exchange;
            var displayValue = 1/value; //value >= 1 ? 1/value : 999;
            if (!uLinks[key]) {
//console.log(key + " = " + value + " * " + displayValue);
              link = { id: source_exchange + '-' + target_exchange, source: source_exchange, target: target_exchange, intra: intra, value: displayValue };
              uLinks[key] = link;
            } else {
              uLinks[key].value = displayValue;
            }
          }
        });

        dLinks = {};
        var dVals = [];
        for (var k in uLinks) { dVals.push(uLinks[k]['value']); }
        dVals.sort(function(a, b) {return a - b});
        var dMax = dVals[100];
        for (var k in uLinks) {
          if (uLinks[k]['value'] <= dMax) {
            dLinks[k] = uLinks[k];
          }
        }
        graph.links = d3.values(dLinks)
        //graph.links = d3.values(dLinks).filter(d => d.value <= 1)
        graph.nodes = d3.values(uNodes)

        // Update simulation
        // Apply the general update pattern to the nodes.
        node = nodes.selectAll('.node').data(graph.nodes, d => d.id);
        node.exit().remove();
        node = node.enter()
          .append('g')
          .classed('node', true)
      
          .each(function(d) {
              var el = d3.select(this);

                d.x = width/2, d.y = height/2; // node initial positions for simulation
                
                el.append('title')
                  
                el.append("circle").classed('uw',true).attr('r',0)
                el.append("circle").classed('hw',true).attr('r',0)                  

                el.append('text').attr('y', 3).text(d.id);

          })
          .call(d3.drag()
              .on("start", dragstarted)
              .on("drag", dragged)
              .on("end", dragended)
            )
          .merge(node)
          .each(function(d) {

            var el = d3.select(this);
            
            // calc node radius(es)
            if(d.values.uw <=0 ) d.values.uw = 0.01;
            if(d.values.hw <=0 ) d.values.hw = 0.01;

            d.r_uw =  5 + 10 * Math.sqrt(d.values.uw/3.14) ;
            d.r_hw =  5 + 10 * Math.sqrt(d.values.hw/3.14) ;
            
            d.r = Math.max(d.r_uw,d.r_hw);  // this is used later to calc node connections arrows ends positions

            el.select('.uw').transition().duration(300).attr("r", d.r_uw);
            el.select('.hw').transition().duration(300).attr("r", d.r_hw);
            el.select('text').transition().duration(300).attr("x",d.r  + 2);
            el.select('title').text(d.id + ' ( hw: ' + d.values.hw + ', uw: ' + d.values.uw + ' )');

          }) 

         
            
        // Apply the general update pattern to the links.
        link = links.selectAll('.link').data(graph.links, d => d.id);
        link.exit().remove();
        link = link.enter()
          .append("path")
            .classed('link',true)
            .attr('id', d => d.id)
            .style('marker-end', 'url(#end-arrow)')
          .merge(link)
            .attr("stroke-width", d => 2 * d.value)

        simulation
          .on("tick", ticked)
          .nodes(graph.nodes)
          .force("link")
            .links(graph.links)

        simulation.alpha(1).restart();
      });
  });

  function dragstarted(d) {
    if (!d3.event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }

  function dragged(d) {
    d.fx = d3.event.x;
    d.fy = d3.event.y;
  }

  function dragended(d) {
    if (!d3.event.active) simulation.alphaTarget(0);
    d.fx = d.x; // null
    d.fy = d.y; // null
  }
});
