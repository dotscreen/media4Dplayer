/**
 * The copyright in this software is being made available under the BSD License,
 * included below. This software may be subject to other third party and contributor
 * rights, including patent rights, and no such rights are granted under this license.
 *
 * Copyright (c) 2013, Dash Industry Forum.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification,
 * are permitted provided that the following conditions are met:
 *  * Redistributions of source code must retain the above copyright notice, this
 *  list of conditions and the following disclaimer.
 *  * Redistributions in binary form must reproduce the above copyright notice,
 *  this list of conditions and the following disclaimer in the documentation and/or
 *  other materials provided with the distribution.
 *  * Neither the name of Dash Industry Forum nor the names of its
 *  contributors may be used to endorse or promote products derived from this software
 *  without specific prior written permission.
 *
 *  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS AS IS AND ANY
 *  EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 *  WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED.
 *  IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT,
 *  INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT
 *  NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 *  PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
 *  WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 *  ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 *  POSSIBILITY OF SUCH DAMAGE.
 */
MediaPlayer.dependencies.SourceBufferExtensions = function () {
    "use strict";
    this.system = undefined;
    this.notify = undefined;
    this.subscribe = undefined;
    this.unsubscribe = undefined;
    this.manifestExt = undefined;
};

MediaPlayer.dependencies.SourceBufferExtensions.prototype = {

    constructor: MediaPlayer.dependencies.SourceBufferExtensions,

    createSourceBuffer: function (mediaSource, mediaInfo) {
        "use strict";
        var self = this,
            codec = mediaInfo.codec,
            buffer = null;

        try {
            // Safari claims to support anything starting 'application/mp4'.
            // it definitely doesn't understand 'application/mp4;codecs="stpp"'
            // - currently no browser does, so check for it and use our own
            // implementation.
            if (codec.match(/application\/mp4;\s*codecs="stpp"/i)) {
                throw new Error("not really supported");
            }

            buffer = mediaSource.addSourceBuffer(codec);

        } catch (ex) {
            if ((mediaInfo.isText) || (codec.indexOf('codecs="stpp"') !== -1)) {
                buffer = self.system.getObject("textSourceBuffer");
            } else {
                throw ex;
            }
        }

        return buffer;
    },

    removeSourceBuffer: function (mediaSource, buffer) {
        "use strict";

        try {
            mediaSource.removeSourceBuffer(buffer);
        } catch(ex){
        }
    },

    getBufferRange: function (buffer, time, tolerance) {
        "use strict";

        var ranges = null,
            start = 0,
            end = 0,
            firstStart = null,
            lastEnd = null,
            gap = 0,
            toler = (tolerance || 0.15),
            len,
            i;

        try {
            ranges = buffer.buffered;
        } catch(ex) {
            return null;
        }

        if (ranges !== null && ranges !== undefined) {
            for (i = 0, len = ranges.length; i < len; i += 1) {
                start = ranges.start(i);
                end = ranges.end(i);
                if (firstStart === null) {
                    gap = Math.abs(start - time);
                    if (time >= start && time < end) {
                        // start the range
                        firstStart = start;
                        lastEnd = end;
                    } else if (gap <= toler) {
                        // start the range even though the buffer does not contain time 0
                        firstStart = start;
                        lastEnd = end;
                    }
                } else {
                    gap = start - lastEnd;
                    if (gap <= toler) {
                        // the discontinuity is smaller than the tolerance, combine the ranges
                        lastEnd = end;
                    } else {
                        break;
                    }
                }
            }

            if (firstStart !== null) {
                return {start: firstStart, end: lastEnd};
            }
        }

        return null;
    },

    getAllRanges: function(buffer) {
        var ranges = null;

        try{
            ranges = buffer.buffered;
            return ranges;
        } catch (ex) {
            return null;
        }
    },

    getTotalBufferedTime: function(buffer) {
        var ranges = this.getAllRanges(buffer),
            totalBufferedTime = 0,
            ln,
            i;

        if (!ranges) return totalBufferedTime;

        for (i = 0, ln = ranges.length; i < ln; i += 1) {
            totalBufferedTime += ranges.end(i) - ranges.start(i);
        }

        return totalBufferedTime;
    },

    getBufferLength: function (buffer, time, tolerance) {
        "use strict";

        var self = this,
            range,
            length;

        range = self.getBufferRange(buffer, time, tolerance);

        if (range === null) {
            length = 0;
        } else {
            length = range.end - time;
        }

        return length;
    },

    getRangeDifference: function(currentRanges, buffer) {
        if (!buffer) return null;

        //TODO we may need to look for a more elegant and robust method
        // The logic below checks that is the difference between currentRanges and actual SourceBuffer ranges

        var newRanges = this.getAllRanges(buffer),
            newStart,
            newEnd,
            equalStart,
            equalEnd,
            currentRange,
            nextCurrentRange,
            nextNewRange,
            hasRange,
            diff;

        if (!newRanges) return null;

        for (var i = 0, ln = newRanges.length; i < ln; i += 1) {
            hasRange = currentRanges.length > i;
            currentRange = hasRange ? {start: currentRanges.start(i), end: currentRanges.end(i)} : null;
            newStart = newRanges.start(i);
            newEnd = newRanges.end(i);

            // if there is no range with the same index it means that a new range has been added. This range is
            // the difference we are looking for
            // Example
            // current ranges
            // 0|---range1---|4  8|--range2--|12
            // new ranges
            // 0|---range1---|4| 8|--range2--|12  16|--range3--|20

            if (!currentRange) {
                diff = {start: newStart, end: newEnd};
                return diff;
            }

            equalStart = currentRange.start === newStart;
            equalEnd = currentRange.end === newEnd;

            // if ranges are equal do nothing here and go the next ranges
            if (equalStart && equalEnd) continue;

            // start or/and end of the range has been changed
            if (equalStart) {
                diff = {start: currentRange.end, end: newEnd};
            } else if (equalEnd) {
                diff = {start: newStart, end: currentRange.start};
            } else {
                // new range has been added before the current one
                diff = {start: newStart, end: newEnd};
                return diff;
            }

            // if there is next current range but no next new range (it it is not equal the next current range) it means
            // that the ranges have been merged
            // Example 1
            // current ranges
            // 0|---range1---|4  8|--range2--|12  16|---range3---|
            // new ranges
            // 0|-----------range1-----------|12  16|---range3--|
            nextCurrentRange = currentRanges.length > (i+1) ? {start: currentRanges.start(i+1), end: currentRanges.end(i+1)} : null;
            nextNewRange = (i+1) < ln ? {start: newRanges.start(i+1), end: newRanges.end(i+1)} : null;

            if (nextCurrentRange && (!nextNewRange || (nextNewRange.start !== nextCurrentRange.start || nextNewRange.end !== nextCurrentRange.end))) {
                diff.end = nextCurrentRange.start;
            }

            return diff;
        }

        return null;
    },

    waitForUpdateEnd: function(buffer, callback) {
        "use strict";
        var intervalId,
            CHECK_INTERVAL = 50,
            checkIsUpdateEnded = function() {
                // if undating is still in progress do nothing and wait for the next check again.
                if (buffer.updating) return;
                // updating is completed, now we can stop checking and resolve the promise
                clearInterval(intervalId);
                callback();
            },
            updateEndHandler = function() {
                if (buffer.updating) return;

                buffer.removeEventListener("updateend", updateEndHandler, false);
                callback();
            };

        if (!buffer.updating) {
            callback();
            return;
        }

        // use updateend event if possible
        if (typeof buffer.addEventListener === "function") {
            try {
                buffer.addEventListener("updateend", updateEndHandler, false);
            } catch (err) {
                // use setInterval to periodically check if updating has been completed
                intervalId = setInterval(checkIsUpdateEnded, CHECK_INTERVAL);
            }
        } else {
            // use setInterval to periodically check if updating has been completed
            intervalId = setInterval(checkIsUpdateEnded, CHECK_INTERVAL);
        }
    },

    append: function (buffer, chunk) {
        var self = this,
            bytes = chunk.bytes,
            appendMethod = ("append" in buffer) ? "append" : (("appendBuffer" in buffer) ? "appendBuffer" : null),
            // our user-defined sourcebuffer-like object has Object as its
            // prototype whereas built-in SourceBuffers will have something
            // more sensible. do not pass chunk to built-in append.
            acceptsChunk = Object.prototype.toString.call(buffer).slice(8, -1) === "Object";

        if (!appendMethod) return;

        try {
            self.waitForUpdateEnd(buffer, function() {
                if (acceptsChunk) {
                    // chunk.start is used in calculations by TextSourceBuffer
                    buffer[appendMethod](bytes, chunk);
                } else {
                    buffer[appendMethod](bytes);
                }
                // updating is in progress, we should wait for it to complete before signaling that this operation is done
                self.waitForUpdateEnd(buffer, function() {
                    self.notify(MediaPlayer.dependencies.SourceBufferExtensions.eventList.ENAME_SOURCEBUFFER_APPEND_COMPLETED, {buffer: buffer, bytes: bytes});
                });
            });
        } catch (err) {
            self.notify(MediaPlayer.dependencies.SourceBufferExtensions.eventList.ENAME_SOURCEBUFFER_APPEND_COMPLETED, {buffer: buffer, bytes: bytes}, new MediaPlayer.vo.Error(err.code, err.message, null));
        }
    },

    remove: function (buffer, start, end, mediaSource) {
        var self = this;

        try {
            // make sure that the given time range is correct. Otherwise we will get InvalidAccessError
            self.waitForUpdateEnd(buffer, function() {
                if ((start >= 0) && (end > start) && (mediaSource.readyState !== "ended")) {
                    buffer.remove(start, end);
                }
                // updating is in progress, we should wait for it to complete before signaling that this operation is done
                self.waitForUpdateEnd(buffer, function() {
                    self.notify(MediaPlayer.dependencies.SourceBufferExtensions.eventList.ENAME_SOURCEBUFFER_REMOVE_COMPLETED, {buffer: buffer, from: start, to: end});
                });
            });
        } catch (err) {
            self.notify(MediaPlayer.dependencies.SourceBufferExtensions.eventList.ENAME_SOURCEBUFFER_REMOVE_COMPLETED, {buffer: buffer, from: start, to: end}, new MediaPlayer.vo.Error(err.code, err.message, null));
        }
    },

    abort: function (mediaSource, buffer) {
		const alwaysReset = Object.prototype.toString.call(buffer).slice(8, -1) === 'Object';
        try {
            if (mediaSource.readyState === 'open' || alwaysReset) {
                buffer.abort();
            }
        } catch(ex){
        }
    }
};

MediaPlayer.dependencies.SourceBufferExtensions.QUOTA_EXCEEDED_ERROR_CODE = 22;

MediaPlayer.dependencies.SourceBufferExtensions.eventList = {
    ENAME_SOURCEBUFFER_REMOVE_COMPLETED: "sourceBufferRemoveCompleted",
    ENAME_SOURCEBUFFER_APPEND_COMPLETED: "sourceBufferAppendCompleted"
};
