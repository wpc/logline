if (typeof(timeline) === 'undefined') { timeline = function() {}; }

timeline.events = (function(t) {
    function startAt(datum) {
        return t.utils.toUTC(new Date(datum.start_at));
    }

    function finishAt(datum) {
        return datum.finish_at ? t.utils.toUTC(new Date(datum.finish_at)) : null;
    }

    function isDuration(datum) {
        return datum.start_at !== undefined;
    }

    function isTransient(datum) {
        return datum.at !== undefined;
    }


    return {
        'startAt': startAt,
        'finishAt': finishAt,
        'isTransient': isTransient,
        'isDuration': isDuration,

        duration: function(datum, scale) {
            var endtime = finishAt(datum);
            var endpoint = endtime ?  scale(endtime) : d3.last(scale.range());
            return Math.max(endpoint - scale(startAt(datum)), 1);
        },

        at: function(datum) {
            return t.utils.toUTC(new Date(datum.at));
        },

        id: function(datum) {
            return t.identifier;
        },

        description: function(datum) {
            return datum.description;
        },

        color: function(datum) {
            return datum.color;
        }
    };

})(timeline);


timeline.event_slots = (function(t) {
    function findSlot(slots, d) {
        for (var i = 0; i < slots.length; i++) {
            var slot = slots[i];
            var last = slot[slot.length - 1];
            if (!last) {
                return slot;
            }

            if (t.events.finishAt(last) && t.events.finishAt(last) < t.events.startAt(d)) {
                return slot;
            }
        }
        return null;
    }

    function pushToSlot(slot, d) {
        slot.push(d);
        d.slotIndex = slot.slotIndex;
    }

    function newslot(slots) {
        var newslot = [];
        newslot.slotIndex = slots.length;
        slots.push(newslot);
        return newslot;
    }

    return {
        assign: function(data) {
            var slots = [];
            for(var i=0; i<data.length; i++) {
                var d = data[i];
                var slot = findSlot(slots, d);
                if (!slot) {
                    slot = newslot(slots)
                }
                pushToSlot(slot, d)
            }
        }
    }
})(timeline);
