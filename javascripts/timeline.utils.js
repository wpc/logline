if (typeof(timeline) === 'undefined') { timeline = function() {}; }

timeline.utils = (function(t) {
    return {
        hashCode: function(str) {
            var hash = 0;
            if (str.length == 0) return hash;
            for (i = 0; i < str.length; i++) {
                char = str.charCodeAt(i);
                hash = ((hash<<5)-hash)+char;
                hash = hash & hash; // Convert to 32bit integer
            }
            return hash;
        },

        extendDateRange: function(range, percentage) {
            var start = range[0];
            var finish = range[1];
            var delta = finish.getTime() - start.getTime();
            return [new Date(start.getTime() - delta * percentage), new Date(finish.getTime() + delta * percentage)];
        },
    }
})(timeline);
