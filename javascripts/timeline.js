(function($, d3, t) {
    var viewHeight = 400;

    function drawXAxis(svg, datex, data) {

        var grid = svg.select("g.datex.grid");
        if( grid.empty() ) {
            grid = svg.append("g")
                .attr("class", "datex grid")
                .attr("transform", "translate(0," + viewHeight + ")");
        }

        grid.call(d3.svg.axis().scale(datex).tickSubdivide(1).tickSize(-1 *viewHeight));

        var axis = svg.select("g.datex.axis");
        if(axis.empty()) {
            axis = svg.append("g")
                .attr("class", "datex axis")
                .attr("transform", "translate(0," + viewHeight + ")");
        }
        axis.call(d3.svg.axis().scale(datex));
    }

    function updateEventRects(rects, datex) {
        rects.attr("x", function(d) { return datex(t.events.startAt(d)); })
            .attr("y", function(d) { return 5 + d.slotIndex * 20; })
            .attr("height", 10)
            .attr("width", function(d) { return t.events.duration(d, datex);})
            .attr('fill', function(d) { return t.events.color(d); })
            .attr("stroke-width", '2')
            .attr('title', JSON.stringify);
    }

    function drawEvents(svg, datex, data) {
        drawXAxis(svg, datex, data);

        var rects = svg.selectAll("rect.event")
            .data(data, t.events.id);

        rects.call(updateEventRects, datex);

        rects.enter().append("rect")
            .attr('class', 'event')
            .call(updateEventRects, datex);

        rects.exit().remove();
    }

    function updateIndicatorLine(lines, datex) {
        lines.attr('x1', function(d) { return datex(t.events.at(d)); })
            .attr('y1', 0)
            .attr('x2', function(d) { return datex(t.events.at(d)); })
            .attr('y2', viewHeight)
            .attr('title', function(d ) { return t.events.description(d); });
    }

    function drawIndicator(svg, datex, data) {
        var lines = svg.selectAll("line.indicator")
            .data(data, t.events.id);

        lines.call(updateIndicatorLine, datex);

        lines.enter().append("line")
            .attr('class', 'indicator')
            .call(updateIndicatorLine, datex);

        lines.exit().remove();

    }

    $.fn.timeline = function() {

        var outerwidth = this.outerWidth();
        var dataurl = $(this).data("timeline-data-url");
        var m = [30, 10, 30, 10],
        w = outerwidth - m[1] - m[3],
        h = 500 - m[0] - m[2];
        var datex = d3.time.scale().range([0, w]);


        var svg = d3.select(this[0]).append("svg")
            .attr("width", w + m[1] + m[3])
            .attr("height", h + m[0] + m[2])
            .attr("pointer-events", "all")
            .append("g")
            .attr("transform", "translate(" + (m[3] + 3)  + "," + m[0] + ")");

        svg.append("rect")
            .attr("class", 'overlay')
            .attr("width", w)
            .attr("height", h);

        var dragpan = svg.select("rect.dragpan");
        if(dragpan.empty()) {
            dragpan = svg.append("svg:rect")
                .attr("class", "dragpan")
                .attr("fill", "transparent");
        }

        d3.json(dataurl, function(data) {
            var durevents = data.filter(t.events.isDuration);
            var tranevents = data.filter(t.events.isTransient);
            t.event_slots.assign(durevents);

            var axisStart = t.events.startAt(d3.first(durevents));
            var axisEnd = new Date(axisStart.getTime() + 60 * 60 * 1000);
            var scaleDomain = [ axisStart, axisEnd ];
            datex.domain(t.utils.extendDateRange(scaleDomain, 0.01));

            function redraw() {
                drawEvents(svg, datex, durevents);
                drawIndicator(svg, datex, tranevents);
            }

            var zoom = d3.behavior.zoom()
                .x(datex)
                .on("zoom", redraw);

            dragpan.attr("x", 0)
                .attr("y", 0)
                .attr("width", w)
                .attr("height", h + m[2])
                .call(zoom);

            redraw();

        });
    };
}(jQuery, d3, timeline));
