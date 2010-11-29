var eh_current_filename = '### INIT VALUE ###';
var eh_current_duration = 0;
var eh_request_refresh_playlist = false;
var eh_request_refresh_id = Math.floor(Math.random() * 1000);
var eh_request_refresh_window = new Array();
var eh_data_loading = '<span id="loading"><img class="loading" src="img/loading.gif" alt="Loading..."/></span>';
var eh_data_playing = '<img src="img/btn-play.png" alt="Playing..." title="Now Playing"/>';

var eh_tag_current = 1;
var eh_capture_seek = false;
var eh_tag = new Array();
var eh_tag_filename = new Array();
var eh_is_paused = false;
var eh_is_playing = false;
var eh_is_pause_display = false;
var eh_playlist = false;
var eh_progress = 0;

var eh_pref_default_artist = '1';
var eh_pref_default_album = '1';
var eh_pref_default_genre = '0';
var eh_pref_default_duration = '1';
var eh_pref_default_rating = '0';

// Create a shortcut
var Dom = YAHOO.util.Dom;

// Globals for Data Source and Auto Complete
var playlistDataSource = false;
var playlistSchema = {
    metaFields: [],
    resultNode: 'track',
    fields: [
        { key: 'filename' },
        { key: 'title' },
        { key: 'artist' },
        { key: 'album' },
        { key: 'bitrate' },
        { key: 'rating', parser: 'number' },
        { key: 'len' },
        { key: 'disc' },
        { key: 'genre' },
        { key: 'duration', parser: 'number' },
   ]
};
var songAutoCompKeys = [{key:'title'},
			{key:'artist'},
			{key:'album'}
			];
var filteredSongs = [];

function vd(el, name) {
    var e = el.getElementsByTagName(name);
    if (!e)
        return '';
    e = e[0];
    if (!e)
        return '';
    if (!e.firstChild)
        return '';
    if (e.firstChild.textContent)
        return e.firstChild.textContent;
    return e.firstChild.text;
}

function v(xh, name) {
    return vd(xh.responseXML, name);
}

function x(page, callback) {
    var xmlhttp = new Ajax.Request(page, {
        method: 'get',
        onSuccess: function(transport) {
            if (callback != false)
                callback(page, transport);
        }
    });
}

function format_hms_time(seconds) {
    // Format seconds as h:mm:ss format
    var hours = parseInt(Math.floor(seconds / 3600));
    var mins = parseInt(Math.floor((seconds % 3600) / 60));
    var secs = parseInt(seconds % 60);
    if (secs < 10) {
        secs = '0' + secs;
    }
    var hms =  mins + ':' + secs;
    if (hours > 0) {
    if (mins < 10) {
        hms  = '0' + hms;
    }
        hms = hours + ':' + hms;
    }
    return hms;
}

function formatRowFileBinding(elCell, oRecord, oColumn, oData) {
    var tag = eh_tag_current++;
    var data = oRecord.getData();
    var filename = escape(data.filename);
    var contents = '<input type="hidden" name="tag" value="' + tag + '" />';
    eh_tag[filename] = tag;
    eh_tag_filename[''+tag] = filename;
    contents += '<div id="tag-' + tag + '" style="padding: 0px; width: 26px;"></div>';
    elCell.innerHTML = contents;
    eh_tag_set(eh_current_filename, eh_data_playing);
}

function formatPlaylistRow(elTr, oRecord) {
    // add striping
    if ( eh_tag_current % 2 == 0 ) {
	Dom.addClass(elTr, 'striped');
    }
    return true;
}

function formatSongSearchResult(oResultData, sQuery, sResultMatch) {
    var title = oResultData.title;
    var artist = oResultData.artist;
    var album = oResultData.album;
    var filename = oResultData.filename;

    // Bold matching portions of fields with query
    var aMarkup = [];

    // title
    var titleIndex = title.toLowerCase().indexOf(sQuery.toLowerCase());
    if (titleIndex >= 0) {
	// before
	aMarkup.push(title.substring(0, titleIndex));
	aMarkup.push("<b>");
	// matching portion
	aMarkup.push(title.substring(titleIndex, titleIndex + sQuery.length));
	aMarkup.push("</b>");
	// remainder
	aMarkup.push(title.substring(titleIndex + sQuery.length));
    } else {
	aMarkup.push(title);
    }

    aMarkup.push(' - ');

    // artist
    var artistIndex = artist.toLowerCase().indexOf(sQuery.toLowerCase());
    if (artistIndex >= 0) {
	// before
	aMarkup.push(artist.substring(0, artistIndex));
	aMarkup.push("<b>");
	// matching portion
	aMarkup.push(artist.substring(artistIndex, artistIndex + sQuery.length));
	aMarkup.push("</b>");
	// remainder
	aMarkup.push(artist.substring(artistIndex + sQuery.length));
    } else {
	aMarkup.push(artist);
    }

    aMarkup.push(' - ');

    // album
    var albumIndex = album.toLowerCase().indexOf(sQuery.toLowerCase());
    if (albumIndex >= 0) {
	// before
	aMarkup.push(album.substring(0, albumIndex));
	aMarkup.push("<b>");
	// matching portion
	aMarkup.push(album.substring(albumIndex, albumIndex + sQuery.length));
	aMarkup.push("</b>");
	// remainder
	aMarkup.push(album.substring(albumIndex + sQuery.length));
    } else {
	aMarkup.push(album);
    }
    //return aMarkup.join("");
    return "";
}

function filterSongSearchResults(sQuery, oFullResponse, oParsedResponse, oCallback) {
    // If AC has passed a query string value back to itself, grab it
    if(oCallback && oCallback.argument && oCallback.argument.query) {
        sQuery = oCallback.argument.query;
    }

    // Only if a query string is available to match against
    if(sQuery && sQuery !== "") {
        // First make a copy of the oParseResponse
        oParsedResponse = YAHOO.widget.AutoComplete._cloneObject(oParsedResponse);
        
        var oAC = oCallback.scope;
	var oDS = this;
	var allResults = oParsedResponse.results; // the array of results
	filteredSongs = []; // container for filtered results, reset
	var bMatchCase = (oDS.queryMatchCase || oAC.queryMatchCase); // backward compat
	var bMatchContains = (oDS.queryMatchContains || oAC.queryMatchContains); // backward compat
            
        // Loop through each result object...
        for(var i=0, len=allResults.length; i<len; i++) {
	    var oResult = allResults[i];

	    // Grab the data to match against from the result object...
	    var sResults = [];
	    // use all responseSchema fields to match
	    //var fields = this.responseSchema.fields;
	    // Or use only specific fields
	    var fields = songAutoCompKeys;
	    for (var j=0, fieldLen = fields.length; j < fieldLen; ++j) {
		var key = fields[j].key;
		sResults.push(oResult[key]);
	    }
	    var matched = false;
	    for (var j=0, resultLen = sResults.length; j < resultLen && !matched; ++j) {
		var sResult = sResults[j];
		var sKeyIndex = (bMatchCase) ?
		    sResult.indexOf(decodeURIComponent(sQuery)) :
		    sResult.toLowerCase().indexOf(decodeURIComponent(sQuery).toLowerCase());

		// A STARTSWITH match is when the query is found at the beginning of the key string...
		if((!bMatchContains && (sKeyIndex === 0)) ||
		   // A CONTAINS match is when the query is found anywhere within the key string...
		   (bMatchContains && (sKeyIndex > -1))) {
		    // Stash the match
		    filteredSongs.push(oResult);
		    matched = true;
		}
	    }
        }
        oParsedResponse.results = filteredSongs;
        YAHOO.log("Filtered " + filteredSongs.length + " results against query \""  + sQuery + "\": " + YAHOO.lang.dump(filteredSongs), "info", this.toString());
    } else {
	// No query, return everything
	filteredSongs = oParsedResponse.results;
    }
    eh_playlist_build();
    return oParsedResponse;
}


function eh_cookie_set(name, value, expires, path, domain, secure) {
    var today = new Date();
    today.setTime(today.getTime());
    if (expires)
        expires = expires * 1000 * 60 * 60 * 24;
    var expires_date = new Date( today.getTime() + (expires) );
    document.cookie = name + '=' +escape( value ) +
        (( expires ) ? ';expires=' + expires_date.toGMTString() : '' ) +
        (( path ) ? ';path=' + path : '' ) +
        (( domain ) ? ';domain=' + domain : '' ) +
        (( secure ) ? ';secure' : '' );
}

function eh_cookie_get(name, defval) {
    var start = document.cookie.indexOf(name + '=');
    var len = start + name.length + 1;
    if ((!start) && (name != document.cookie.substring(0, name.length)))
        return defval;
    if (start == -1)
        return defval;
    var end = document.cookie.indexOf(';', len);
    if (end == -1)
        end = document.cookie.length;
    return unescape(document.cookie.substring(len, end));
}

function eh_show(id) {
    $(id).style.display = 'block';
}

function eh_hide(id) {
    $(id).style.display = 'none';
}

function eh_pref(el) {
    var id = el.id;
    var val = false;
    if (el.tagName == 'SELECT') {
        val = el.value;
    } else if (el.tagName == 'INPUT') {
        if (el.type == 'checkbox')
            val = el.checked ? '1' : '0';
        else
            val = el.value;
    }
    eh_cookie_set(id, val, '', '/', '', '' );

    if (id.indexOf('eh_pref_playlist_') >= 0)
        eh_playlist_build();
}

function eh_track_current_callback(page, xh) {
    var request_id = v(xh, 'request_id');
    var duration;
    var duration_min;
    var text;
    if (eh_request_refresh_window['_' + request_id]) {
	// delete this request id from the acceptable window and older ids
	for (var key in eh_request_refresh_window) {
	    if (key < request_id) {
		delete eh_request_refresh_window[key];
	    }
	}
	delete eh_request_refresh_window[request_id];
	// continue processing
	if (!xh.responseXML)
	    return;
	eh_is_playing = false;
	if (v(xh, 'is_playing') == 'True')
	    eh_is_playing = true;
	eh_is_paused = false;
	if (v(xh, 'is_paused') == 'True')
	    eh_is_paused = true;
	if (v(xh, 'filename') != eh_current_filename) {
	    eh_tag_set(eh_current_filename, '');
	    eh_current_filename = escape(v(xh, 'filename'));
	    eh_tag_set(eh_current_filename, eh_data_playing);
	    $('trackcover').innerHTML =
		'<img src="image/cover/current?'+eh_current_filename+'"/>';
	    $('ti_artist').innerHTML = v(xh, 'artist');
	    $('ti_album').innerHTML = v(xh, 'album');
	    $('ti_title').innerHTML = v(xh, 'title');
	    document.title = v(xh, 'title') + ' - Exaile';
	}

	$('ti_position').style.width = '' + 100 * parseFloat(v(xh, 'position')) + '%';

	eh_current_duration = parseInt(v(xh, 'duration'));

	if (eh_is_playing && !eh_is_paused) {
	    var progress_secs = parseInt(v(xh, 'duration')) * parseFloat(v(xh, 'position'));
	    var hms_progress = format_hms_time(progress_secs);
	    text = '' + hms_progress + ' / ' + v(xh, 'len');
	    if ($('ti_len').innerHTML != text)
		$('ti_len').innerHTML = text;
	} else if (!eh_is_playing && !eh_is_paused) {
	    text = '0:00 / 0:00';
	    if ($('ti_len').innerHTML != text)
		$('ti_len').innerHTML = text;
	}

	/* Do not hide pause button
	if (eh_is_playing) {
	    if (!eh_is_paused) {
		if (!eh_is_pause_display) {
		    eh_is_pause_display = true;
		    $('action-pause').style.display = 'block';
		    $('action-play').style.display = 'none';
		}
	    } else {
		if (eh_is_pause_display) {
		    eh_is_pause_display = false;
		    $('action-pause').style.display = 'none';
		    $('action-play').style.display = 'block';
		}
	    }
	} else {
	    if (eh_is_pause_display) {
		eh_is_pause_display = false;
		$('action-pause').style.display = 'none';
		$('action-play').style.display = 'block';
	    }
	}
	*/
    }
}

function eh_tag_set(filename, data) {
    var tag = eh_tag[filename];
    if (!tag || tag <= 0)
        return;
    var el = $('tag-' + tag);
    if (!el)
        return;
    el.innerHTML = data;
    el = $('tagth-' + tag);
    if (!el)
        return;
    if (data == '')
        el.className = '';
    else
        el.className = 'playing';
}

function eh_playlist_list_callback(page, xh) {
    eh_request_refresh_playlist = false;
    eh_playlist = xh.responseXML;
    filteredSongs = eh_playlist;
    playlistDataSource = new YAHOO.util.LocalDataSource( eh_playlist );
    playlistDataSource.responseSchema = playlistSchema
    eh_songfilter_build();
    eh_playlist_build();
}

function eh_songfilter_build() {
    var songAutoComp = new YAHOO.widget.AutoComplete('songSearch', 'songContainer', playlistDataSource);
    // Autocomplete Widget Behavior
    songAutoComp.maxResultsDisplayed = 1; // limit display results to minimum
    songAutoComp.alwaysShowContainer = false;
    songAutoComp.minQueryLength = 0;
    songAutoComp.queryDelay = 0.5;
    songAutoComp.forceSelection = false; // do not force selection or clear
    songAutoComp.typeAhead = false;
    songAutoComp.allowBrowserAutocomplete = false;
    // Result Filtering
    songAutoComp.filterResults = filterSongSearchResults;
    // Result Format
    songAutoComp.resultTypeList = false; // allow object-literal
    songAutoComp.formatResult = formatSongSearchResult;
}

function eh_playlist_build() {
    // Data Source is bound to autocomplete
    var oDS = new YAHOO.util.LocalDataSource(filteredSongs);
    oDS.responseSchema = playlistSchema;
    // Column Definitions
    var playlistColumns = Array();
    playlistColumns.push( { label:'Playing', formatter: formatRowFileBinding, width:'26px', resizeable: false } );
    playlistColumns.push( { key:'title', label:'Title', sortable: true } );
    if (parseInt(eh_cookie_get('eh_pref_playlist_artist', eh_pref_default_artist))) {
	playlistColumns.push( { key:'artist', label:'Artist', width:'20%', sortable: true } );
    }
    if (parseInt(eh_cookie_get('eh_pref_playlist_album', eh_pref_default_album))) {
	playlistColumns.push( { key:'album', label:'Album', width:'20%', sortable: true } );
    }
    if (parseInt(eh_cookie_get('eh_pref_playlist_genre', eh_pref_default_genre))) {
	playlistColumns.push( { key:'genre', label:'Genre', width:'100px', sortable: true } );
    }
    if (parseInt(eh_cookie_get('eh_pref_playlist_duration', eh_pref_default_duration))) {
	playlistColumns.push( { key:'len', label:'Duration', width:'30px', sortable: true, sortOptions: { field: 'duration' } } );
    }
    if (parseInt(eh_cookie_get('eh_pref_playlist_rating', eh_pref_default_rating))) {
	playlistColumns.push( { key:'rating', label:'Rating', width:'100px', sortable: true } );
    }

    var dataTableOptions = { formatRow: formatPlaylistRow,
			     draggableColumns: true,
			     renderLoopSize: 150,
			     selectionMode: 'single',
			     MSG_LOADING: 'Playlist loading...',
			     MSG_EMPTY: 'There are no songs are on the playlist.',
			     MSG_ERROR: 'Error: Could not load playlist.',
    };
    var playlistDataTable = new YAHOO.widget.DataTable('playlistcontent', playlistColumns, oDS, dataTableOptions);
    playlistDataTable.subscribe('rowClickEvent', eh_playtrack);
}

function eh_playtrack(oArgs) {
    // oArgs has target, event
    var t = oArgs.target;
    var inputs = t.getElementsByTagName('input');
    for (var i=0; i < inputs.length; ++i) {
	if (inputs[i].name == 'tag') {
	    var tag = inputs[i].value;
	    var filename = eh_tag_filename[''+tag];
	    x('rpc/action/play?f=' + filename, false);
	    break;
	}
    }
}

function eh_refresh() {
    // Adding a delay for more unanswered requests makes more sense
    // Rather than completely blocking until a request has been answered.
    // This prevents a request never getting answered, and the app getting stuck
    var interval = 1000 * parseInt(''+eh_cookie_get('eh_pref_refreshtime', 1));
    var delay = interval * eh_request_refresh_window.length;
    // Add the request_id to the response window
    eh_request_refresh_window['_' + eh_request_refresh_id] = true;
    // Make request
    x('rpc/current?id=' + eh_request_refresh_id, eh_track_current_callback);
    setTimeout('eh_refresh()', interval + delay);
    eh_request_refresh_id++;
}

function eh_refresh_playlist() {
    if (eh_request_refresh_playlist == true)
        return;
    eh_request_refresh_playlist = true;
    $('playlistcontent').innerHTML = eh_data_loading;
    x('rpc/playlist/list', eh_playlist_list_callback);
}

function eh_action_play() {
    x('rpc/action/play', false);
}

function eh_action_pause() {
    x('rpc/action/pause', false);
}

function eh_action_stop() {
    x('rpc/action/stop', false);
}

function eh_action_next() {
    x('rpc/action/next', false);
}

function eh_action_previous() {
    x('rpc/action/previous', false);
}

function eh_action_repeat() {
    x('rpc/action/repeat', false);
}

function eh_action_shuffle() {
    x('rpc/action/shuffle', false);
}

function eh_action_dynamic() {
    x('rpc/action/dynamic', false);
}

function eh_trackbar_observe() {
    Event.observe($('trackprogressbar'), 'mouseover', function (ev) {
            if (!eh_is_playing && !eh_is_paused)
                return;
            eh_capture_seek = true;
            eh_show($('ti_positionmove'));
        });
    Event.observe($('trackprogressbar'), 'mouseout', function (ev) {
            eh_hide($('ti_positionmove'));
            eh_progress = 0;
            eh_capture_seek = false;
        });
    Event.observe($('trackprogressbar'), 'mousemove', function (ev) {
            if (!eh_capture_seek)
                return;
            var px = Event.pointerX(ev);
            var el = $('trackprogressbar');
            var elx = Position.cumulativeOffset(el)[0];
            var d = Element.getDimensions(el);
            px = px - elx;
            if (px < 0)
                return;
            px = px * 100 / d['width'];
            $('ti_positionmove').style.width = '' + px + '%';
            eh_progress = px;
        });

    Event.observe($('trackprogressbar'), 'click', function (ev) {
            if (!eh_capture_seek)
                return;
            x('rpc/action/seek?s=' + parseInt((eh_progress * eh_current_duration / 100)), false);
        });
}

function eh_init() {
    //$('action-pause').style.display = 'none';

    eh_playlist = false;
    $('eh_pref_playlist_artist').checked =
        parseInt(eh_cookie_get('eh_pref_playlist_artist', eh_pref_default_artist));
    $('eh_pref_playlist_album').checked =
        parseInt(eh_cookie_get('eh_pref_playlist_album', eh_pref_default_album));
    $('eh_pref_playlist_genre').checked =
        parseInt(eh_cookie_get('eh_pref_playlist_genre', eh_pref_default_genre));
    $('eh_pref_playlist_duration').checked =
        parseInt(eh_cookie_get('eh_pref_playlist_duration', eh_pref_default_duration));
    $('eh_pref_playlist_rating').checked =
        parseInt(eh_cookie_get('eh_pref_playlist_rating', eh_pref_default_rating));

    eh_refresh();
    eh_trackbar_observe();
}
