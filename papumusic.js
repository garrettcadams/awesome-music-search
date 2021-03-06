// Do this when the page loads
$(document).ready(function() {
	
	var spotify = new iAPI('spotify', 'Spotify', 'http://www.spotify.com');

		spotify.canInstantPlay = function() { return true; };

		spotify.numResults = function(){
			return this.items.length;
		};
		
		spotify.endpoint = function() {
			return('http://ws.spotify.com/search/1/track.json?q=' + this.query);
		};
		
		spotify.parse = function() {
			var tracks = this.data.tracks;
			for(var i = 0; i < tracks.length; i++){
				var territories = tracks[i].album.availability.territories.split(' ');
				if($('#us').is(':checked')) {
					if ($.inArray("US", territories) == -1 && $.inArray("worldwide", territories) == -1) continue;
				}
				var artistString = '';
				for(var j = 0; j < tracks[i].artists.length; j++) {
					if(artistString.length > 0) artistString = artistString + ', ';
					artistString = artistString + tracks[i].artists[j].name;
				}
				this.items.push(new Track(
					artistString,
					tracks[i].name,
					tracks[i].album.name,
					tracks[i].href,
					'https://embed.spotify.com/?uri=' + tracks[i].href,
					this.apiName,
					tracks[i].popularity * 100
				));
			}
		};

		spotify.ensureSpotifyUri = function(url) {
			if(!url.match(/^spotify:/)) {
				throw new Error("Invalid Spotify track URI: " + url);
			}
		};
	
	var mog = new iAPI('mog', 'MOG', 'http://www.mog.com');
	
		mog.numResults = function() {
			return this.items.length;
		};

		mog.playCountCeiling = 400; // Who knows. Macklemore/Thrift Shop has 631.28.

		mog.playCountSkewness = 0.1; // Closer to log
	
		mog.endpoint = function() {
			// By default, MOG matches with a liberal soundex.
			// Quote every search term to avoid extra matches.
			// Oops, just quote single-word searches. MOG only matches the track name on quoted strings.
			var strictQuery;
			if (this.query.split(' ').length > 1) {
			  strictQuery = this.query;
			} else {
				strictQuery = this.strictQuotedQuery(this.query);
			}
			return('http://search.mog.com/v2/tracks/search.json?q=' + strictQuery + '&count=50&index=0&allow_nonstreamable_token=0');
		};
		
		mog.parse = function() {
			mogdata = this.data;
			console.log("MOG", this.data);
			var tracks = this.data.tracks;
			for(var i = 0; i < tracks.length; i++) {
				this.items.push(new Track(
					tracks[i].artist_name,
					tracks[i].track_name,
					tracks[i].album_name,
					"http://mog.com/tracks/mn" + tracks[i].track_id,
					null,
					this.apiName,
					this.getPopularity(tracks[i].popularity)
				));
			}
		};
		
	var soundcloud = new iAPI('soundcloud', 'SoundCloud', 'http://www.soundcloud.com');
	
	// Hello, curious hacker person. Wouldn't it be easy to steal this API key and do Evil Things?
	// Why yes, and it would also be fairly easy to burn your neighbor's house down. I trust that you won't do these things.
	// Music Smasher is fast because most of the API requests are sent directly to the service provider, instead of first
	// going through a proxy in order to hide an API key. Let's keep it that way!

	soundcloud.canInstantPlay = function() { return true; };

	soundcloud.endpoint = function() {
		return('http://api.soundcloud.com/tracks.json?q=' + this.query + '&client_id=f7def983532e3e44229d757cdab43cbe');
	};

	soundcloud.autoPlayUrl = function(id) {
		return "http://w.soundcloud.com/player/?url=http%3A%2F%2Fapi.soundcloud.com%2Ftracks%2F" +
			id + "&amp;color=ff6600&amp;auto_play=true&amp;show_artwork=true";
	};

	soundcloud.playCountCeiling = 400000;

	soundcloud.parse = function() {
			var tracks = this.data;
			for(var i = 0; i < tracks.length; i++) {
				// SouncCloud has some messy data.
				// Sometimes the track title includes the artist.
				// Use a simple rule; if the title has a hyphen,
				// assume it has the artist and don't display the username.
				var title = tracks[i].title;
				var username = tracks[i].user.username;
				var artist = title.match(/ [\-–]+ /) ? null : username;

				// Strip newlines, try to fill the album field with something
				var albumish;
				if (tracks[i].description) {
					albumish = tracks[i].description.replace('\n', '/');
				} else {
					albumish = tracks[i].label_name || '(No description)';
				}

				this.items.push(new Track(
					artist,
					title,
					albumish,
					tracks[i].permalink_url,
					this.autoPlayUrl(tracks[i].id),
					this.apiName,
					this.getPopularity(tracks[i].playback_count)
				));
			}
		};
		
	var bandcamp = new iAPI('bandcamp', 'Bandcamp', 'http://www.bandcamp.com');
	
		bandcamp.note = "Bandcamp will only match your search against full artist names.";
	
		bandcamp.numResults = function() {
			return this.items.length;
		};

		bandcamp.endpoint = function() {
			var ep = 'http://api.bandcamp.com/api/band/3/search?callback=?&name=' + this.query + '&key=drepradstrendirheinbryni';
			return(ep);
		};
		
		bandcamp.parse = function() {
			
			// The Bandcamp API could be better.

			var apikey = "drepradstrendirheinbryni";
			var ep = "http://api.bandcamp.com/api";
			var bands = this.data.results;
			var band_ids = [];
			for(var i = 0; i < bands.length; i++) {
				band_ids.push(bands[i].band_id);
			}
			band_ids.push(1);
			var band_string = band_ids.join(',');
			var url = ep + "/band/3/discography?callback=?&band_id=" + band_string + "&key=" + apikey;
			
			var self = this;
			
			var ajax = $.getJSON(url, function(data) {
				for(var artist_id in data) { // data is an object, not an array
          if (data.hasOwnProperty(artist_id) && data[artist_id].discography) {
            var albums = data[artist_id].discography;
            for(var key = 0; key < albums.length; key++) {
              var album_id = albums[key].album_id;

							// TODO: support track singles returned with album set, ex. Knife Party
							if (!album_id) {
								continue;
							}

              var artist = albums[key].artist;
              var artistUrl = albums[key].url.substr(0,albums[key].url.indexOf("/album/"));
              var url = ep + "/album/2/info?callback=?&album_id=" + album_id + "&key=" + apikey;

              var ajax = $.getJSON(url, function(data) {
                var album = data.title;
                for(var key = 0; key < data.tracks.length; key++) {
                  var track = data.tracks[key].title;
                  var url = artistUrl + data.tracks[key].url;
                  self.items.push(new Track(
                    artist,
                    track,
                    album,
                    url,
                    null,
										this.apiName
                  ));
                }
                self.updateDOM();
              });
            }
          }
				}
			});
		};
			
	var grooveshark = new iAPI('grooveshark', 'Grooveshark', 'http://www.grooveshark.com');
		
		//grooveshark.note = "Down for maintenance. Will be back by midnight PST.";
		grooveshark.note = "Grooveshark will return a maximum of 15 results.";

		grooveshark.canInstantPlay = function() { return true; };

		grooveshark.endpoint = function() {
			return('proxy.php?mode=native&url=' + encodeURIComponent('http://tinysong.com/s/' + encodeURIComponent(this.query) + '?format=json&limit=32'));
		};
		
		grooveshark.parse = function() {
			var tracks = this.data;
			for(var i = 0; i < tracks.length; i++) {
				this.items.push(new Track(
					tracks[i].ArtistName,
					tracks[i].SongName,
					tracks[i].AlbumName,
					tracks[i].Url,
					tracks[i].Url,
					this.apiName
				));
			}
		};
		
	var rdio = new iAPI('rdio', 'Rdio', 'http://www.rdio.com');
		
		rdio.numResults = function(){
			return this.items.length;
		};

		rdio.canInstantPlay = function() { return true; };

		rdio.endpoint = function() {
			// By default, Rdio matches prefixes; i.e. 'bax' matches 'baxter'.
			// Quote individual words in query to force whole-word match.
			var strictQuery = this.strictQuotedQuery(this.query);
			return('oauthproxy.php?api=rdio&query=' + strictQuery);
		};

		rdio.playCountCeiling = 500000; // 500k plays ~ 100% popularity for an Rdio track as of Jan 2013

		rdio.affiliateEmbedSuffix = '&linkshare_id=m9ZkWWoIR/Y&linkshare_subid=&linkshare_offerid=221756.1&linkshare_type=10&linkshare_tmpid=7950';

		rdio.affiliateLinkPrefix = 'http://click.linksynergy.com/fs-bin/click?id=m9ZkWWoIR/Y&subid=&offerid=221756.1&type=10&tmpid=7950&RD_PARM1=';

		rdio.parse = function() {
			var tracks = this.data.result.results;
			for(var i = 0; i < tracks.length; i++) {
				//Rdio search includes results that are unavailable for streaming. I don't show them.
				if(tracks[i].canDownload || tracks[i].canSample) {
					this.items.push(new Track(
						tracks[i].artist,
						tracks[i].name,
						tracks[i].album,
						this.affiliateLinkPrefix + encodeURI(tracks[i].shortUrl),
						tracks[i].embedUrl + '?autoplay' + this.affiliateEmbedSuffix,
						this.apiName,
						this.getPopularity(tracks[i].globalPlayCount)
					));
				}
			}
		};

var youtube = new iAPI('youtube', 'YouTube', 'http://www.youtube.com');

		youtube.embedHeight = '196px';

		youtube.maxResults = 50;

		youtube.note = "YouTube will return a maximum of " + youtube.maxResults + " results.";

		youtube.playCountCeiling = 250000000; // 250 million views = 100% popularity

		youtube.canInstantPlay = function() { return true; };

		youtube.numResults = function(){
			return this.items.length;
		};

		youtube.endpoint = function() {
			// prevent github key searches, at least
			return('https://www.googl' + 'eapis.com/yout' + 'ube/v3/search?order=viewCount' +
				'&part=snippet' +
				'&q=' + encodeURIComponent(this.query) +
				'&maxResults=' + this.maxResults +
				'&videoEmbeddable=true' +
				'&videoCategoryId=10' + // Music category
				'&type=video&ke' + 'y=AIzaSyCUnoqSe0hm1-xv_4Cqd1b2kHqMx4M3WRw' + (6 + 1) + 'djco8i_gcea0I');
		};

		youtube.parse = function() {
			var tracks = this.data.items;
			if (!tracks) return;
			for(var i = 0; i < tracks.length; i++) {
				//Filter out bad YouTube video results.
				var video = tracks[i];
				//if (!this.is_blocked(video) && !this.is_live(video) && this.is_music(video) && !this.is_cover_or_remix(video)) {
					var videoId = video.id.videoId;
					this.items.push(new MS.Track({
						track: video.snippet.title,
						album: video.snippet.description,
						url: 'http://www.youtube.com/watch?v=' + videoId,
						autoPlayUrl: 'http://www.youtube.com/embed/' + videoId + '?autoplay=1',
						apiName: this.apiName,
						popularity: this.getPopularity(10000) // TODO: get YouTube popularity http://stackoverflow.com/a/24348685/264970
					}));
				//}
			}
		};

		youtube.is_cover_or_remix = function (video) {
			var cover_or_remix = false;

			if (video.title.$t.toLowerCase().search("cover") != -1 || video.title.$t.toLowerCase().search("remix") != -1 || video.title.$t.toLowerCase().search("alternate") != -1) cover_or_remix = true;

			return cover_or_remix;
		};
	// Hook form submit action to each API
	$('#qform').submit(function(event) {
		event.preventDefault();
		
		var q = $('#q').val();
		
		// Clean up query - the following are Allowed Characters
		q = $.trim(q.replace(/[^\w\u00C0-\u017E\-!$]+/g,' ').substring(0,80));
		if(q === '') return false;
		
		// Wait 2.5 seconds before allowing another submission
		if (waiting === true) { console.log("wait!"); return false; }
		setTimeout(function(){ waiting = false; console.log("ready"); }, 2500);

		// Switch to full view
		$('body').removeClass('centered');
		$('body').addClass('resulting')

		// Don't duplicate search
		if(q == lastsearch && !instantListen.enabled) {
			console.log("cancelling repeat search");
			return false;
		}

		try {
			// TODO: iterate over registered services
			spotify.submit(q);
			rdio.submit(q);
			grooveshark.submit(q);
			soundcloud.submit(q);
			mog.submit(q);
			bandcamp.submit(q);
			youtube.submit(q);
			lastsearch = q;
			waiting = true;
			appRouter.navigate(q.replace(/[ -]+/g,"-") + (instantListen.enabled ? '/now' : '')); // query to URL (see below)

			// Log current route to analytics
			var fragment = Backbone.history.getFragment();
			if (!/^\//.test(fragment)) fragment = '/' + fragment;
			if (window._gaq !== undefined) {
				window._gaq.push(['_trackPageview', fragment]);
			}
		} catch(e) {
			console.log(e);
		}
		return false;
	});

	// Set cursor to search box
	$('#q').focus();

	// Create each service result container in DOM
	// TODO: each service should register itself
	// TODO: iterate over registered services
	soundcloud.addToDOM();
	
	$('#q').keydown(function(event) {
		if (event.keyCode == '13') {
			instantListen.enabled = event.shiftKey ? true : false;
			$('#qform').submit();
			event.stopPropagation();
		}
	});
	Player.init();

	// Define URL to Method routing
	var AppRouter = Backbone.Router.extend({
		
		routes: {
			":query": "search",
			":query/:instant":	"search"
		},
		
		search: function(query, instant) {
			instant = (instant + '').toLowerCase();
			instantListen.enabled = (instant === 'now');

			if(!query) {
				$('body').addClass('centered');
				$('body').removeClass('resulting');
			} else {
				$('body').removeClass('centered');
				$('bddy').addClass('resulting');
				query = query.replace(/[ -]+/g," "); // URL to query (see above)
				console.log("[Router] search:",query);
				$('#q').val(query);
				$('#qform').submit();
			}
		}
	});
	
	// Instantiate the router
	var appRouter = new AppRouter();
	
	// Start history and routing
	Backbone.history.start({ pushState: true, root: "/" });

});

function Track(artist, track, album, url, autoPlayUrl, apiName, popularity) {
	this.artist = artist || '';
	this.track = track || '';
	this.album = album || '';
	this.url = url || '';
	this.autoPlayUrl = autoPlayUrl || '';
	this.apiName = apiName;
	this.popularity = popularity;
}

function iAPI(name, nicename, url){
	// Properties
	this.apiNiceName = nicename;
	this.apiName = name;
	this.apiURL = url;
	this.items = []; //array of tracks
	// TODO: get rid of this.data; pass thru from callback to parse, use this.items for count
	this.data = [];  //JSON parsed data structure - not normalized, and different for every service
	this.query = "";
	this.note = "";
	this.busy = false;
	this.template = _.template($('#tpl-service').html());
	this.itemTemplate = _.template($('#tpl-track').html());
	this.embedHeight = '196px';
	this.maxTracksCompact = 15;
	this.trackRowHeight = 23;
}

iAPI.prototype.addToDOM = function() {
	var html = this.template(this);
	$('#services').append(html);

	var $el = $('#'+this.apiName);
	var $results = $el.find('.results');
	var $toggleMore = $el.find('.toggleMore');
	var compact = true;

	$el.find('.refresh').click($.proxy(function(event) {
		console.log(this.apiName + ' refresh');
		this.submit(this.query); // Reuse old query value
	}, this));

	$el.find('.toggleMore').click($.proxy(function(event) {
		if (compact) {
			$results.css('max-height', 'none');
			$toggleMore.text('Show Less');
			compact = false;
		} else {
			$results.css('max-height', this.maxTracksCompact * this.trackRowHeight + 'px');
			$toggleMore.text("Show " + (this.numResults() - this.maxTracksCompact) + " more results");
			compact = true;
		}
	}, this));

	// Initial state
	$toggleMore.text('Show All');
};

iAPI.prototype.submit = function(query){

	console.log(this.apiName + ' submit');
			
	this.query = query;
	
	instantListen.setQuery(query);

	this.items = [];
	var $el = $('#'+this.apiName);
	$el.find('.note').hide();
	$el.find('.loading').show();
	$el.find('.results').empty();
	$el.find('.num-results').empty();
	$el.find('.toggleMore').hide();
	if(this.busy === true) {
		console.log('hanging up on ajax call for '+this.apiName);
		this.ajax.abort();
	}
	//this.ajax = $.getJSON(this.endpoint(), $.proxy(this.callback, this)); // Enforce scope of callback with proxy

	this.ajax = $.ajax({
		dataType: 'json',
		url: this.endpoint(),
		success: $.proxy(this.callback, this),
		error:	$.proxy(function(jqxhr, jqstatus, jqerror) {
			var status = jqstatus;
			if (jqxhr.status >= 400) {
				status = 'HTTP ' + jqxhr.status;
			}
			status = '<a href="' + this.endpoint() + '" target="_blank">(' + status + ')</a>';
			$el.find('.results').html('<p>Service unavailable. ' + status + '</p>');
			console.log(this.apiName+' received error', jqxhr, jqstatus, jqerror);
		}, this),
		complete:$.proxy(function() {
			this.busy = false;
			$el.find('.loading').hide();
		}, this)
	});
	this.busy = true;
};

iAPI.prototype.numResults = function(){
	if (this.data === null || this.data === undefined) return 0;
	return this.data.length;
};

iAPI.prototype.callback = function(data){
	this.data = data;
	console.log(this.apiName+' received callback');
	//console.log(data);
	this.parse();
	if(this.numResults() === 0) {
		$('<p>No results found.</p>').appendTo('#'+this.apiName+' .results');
	} else {
		this.updateDOM();
		if (instantListen.enabled === true && this.canInstantPlay() === true) {
			// Notify the instant play manager that there is some new stuff to evaluate;
			// see if one of the tracks will be good enough to play immediately.
			instantListen.notify(this.items);
		}
	}
};

// Renders list of items
iAPI.prototype.updateDOM = function(){
	var $el = $('#'+this.apiName);
	var $results = $el.find('.results');
	var $toggleMore = $el.find('.toggleMore');

	$el.find('.num-results').html(this.numResults() + ' Results');

	var ul = $('<ul class="result-list"></ul>');
	for(var i = 0, length = this.items.length; i < length; i++) {
		var track = this.items[i];
		// create <li> node from template
		var li = $(this.itemTemplate(track));
		// add click handler
		var self = this;
		li.find('a').bind('click', function(track) {
			return function(event) {
				if(event && self.canInstantPlay()) {
					event.stopPropagation();
					event.preventDefault();
					Player.playTrack(track);
				}
			};
		}(track));
		// add to dom fragment
		ul.append(li);
	}
	$results.html(ul);
	if ($results.height() < this.trackRowHeight * this.maxTracksCompact) {
		$toggleMore.hide();
	} else {
		$results.css('max-height', this.trackRowHeight * this.maxTracksCompact);
		$toggleMore.show();
		$toggleMore.text("Show " + (this.numResults() - this.maxTracksCompact) + " more results");
	}
};

iAPI.prototype.strictQuotedQuery = function(query) {
	// This assumes quotes in the query have been stripped.
	var words = query.split(' ');
	var quotedQuery = '"' + words.join('" "') + '"';
	return quotedQuery;
};

iAPI.prototype.playCountCeiling = 500000;

iAPI.prototype.playCountSkewness = 0.5; // 0 = log, 1 = linear

iAPI.prototype.getPopularity = function(playCount) {
	var a = Math.min(Math.log(playCount + 1) / Math.log(this.playCountCeiling), 1);
	var b = Math.min((playCount + 1)/this.playCountCeiling, 1);
	var popularity = (100 * (this.playCountSkewness * b + (1 - this.playCountSkewness) * a));
	//console.log("playCount: %d, a: %f, b: %f, popularity: %f", playCount, a, b, popularity);
	return popularity;
};

iAPI.prototype.canInstantPlay = function(){};
iAPI.prototype.endpoint = function(){};
iAPI.prototype.parse = function(){};

// InstantListen manager singleton
var instantListen = {
	// For now, instant listening is a race.
	// the callbacks notify the instantListen guy when they come in,
	// and the first result to meet some criteria
	// (i.e. can be instant played and matches query in the artist + track title)
	// gets activated immediately.
	// If all the callbacks come in and no links qualify for instant play,
	// then fallback to less demanding criteria.
	_query: '',
	_allItems: [],
	_complete: false,
	enabled: false,

	setQuery: function(query) {
		this._complete = false;
		this._query = query;
		this._allItems = [];
	},

	notify: function(tracks) {
		// If already found a match, ignore subsequent callbacks until new query
		if (this._complete || !this.enabled) {
			return;
		}

		// store reference to all tracks for fallback mode
		this._allItems = this._allItems.concat(tracks);

		// TODO: replace all iterators with underscore shortcuts
		for(var i = 0; i < tracks.length; i++) {
			var track = tracks[i];
			if(this.isGreatMatch(track)) {
				Player.playTrack(track);
				this._complete = true;
				return;
			}
		}
	},

	notifyDone: function() {
		if (this._complete || !this.enabled) {
			return;
		}
		for(var i = 0; i < this._allItems.length; i++) {
			var track = this._allItems[i];
			if(this.isGoodMatch(track)) {
				Player.playTrack(track);
				this._complete = true;
				return;
			}
		}
	},

	isGreatMatch: function(item) {
		// All query words appear, in order, in the artist + track string
		var itemWords = (item.artist + ' ' + item.track).toLowerCase().replace(/[^a-z0-9 ]/gi,'').split(' ');
		var queryWords = this._query.toLowerCase().replace(/[^a-z0-9 ]/gi,'').split(' ');

		// Scan item words in order
		while (itemWords.length) {
			if (itemWords.shift().trim() === queryWords[0].trim()) {
				// Remove the matched query word
				queryWords.shift();
			}
			if (queryWords.length === 0) {
				// The query words have all been matched
				return true;
			}
		}
		return false;
	},

	isGoodMatch: function(item) {
		var itemWords = (item.artist + ' ' + item.track).toLowerCase().replace(/[^a-z0-9 ]/gi,'').split(' ');
		var queryWords = this._query.toLowerCase().replace(/[^a-z0-9 ]/gi,'').split(' ');

		// All query words appear in any order
		while (queryWords.length) {
			if (itemWords.indexOf(queryWords.shift()) === -1) {
				return false;
			}
		}
		return true;
	}
};
$(document).ajaxStop(instantListen.notifyDone.bind(instantListen));

// Underscore template setup: use Mustache.js {{ }} style templates
// http://underscorejs.org/#template
_.templateSettings = {
    interpolate : /\{\{(.+?)\}\}/g, // {{ }}
    escape: /\{#(.+?)#\}/g, // {# #}
    evaluate: /\{%(.+?)%\}/g // {% %}
};

// Evil global stuff
var waiting = false;
var lastsearch = '';
var doNothing = function() {};
var Player = {
	init: function() {
		$('.playContainer .closeButton').bind('click', function() {
			Player.unloadCurrentTrack();
			$('.playContainer').hide();
			$('.playFrame').replaceWith($('<iframe/>').addClass('playFrame'));
		});
		$('.playContainer .minimizeButton').bind('click', function() {
			$('.playContainer').toggleClass('minimized');
		});
		this.playheaderTemplate = _.template($('#tpl-playheader').html());
		this.$playContainer = $('.playContainer');
		this.$playHeaderInfo = $('.playHeader .info');
		this.$playContainerSpacer = $('.playContainerSpacer');
	},

	unloadCurrentTrack: doNothing,

	playTrack: function(track) {
		var embedHeight = '196px';

		if (track.apiName == 'spotify') {
			embedHeight = '113px';
			// Load the spotify URI in an iframe so it doesn't trigger onbeforeunload in Grooveshark embed
			$('.spotifyTarget')[0].src = track.url;
			Player.unloadCurrentTrack = function() {
				// Induce a track stop in the Spotify client by using a uri hash trick.
				// "spotify:track:abcdefg#1:45" seeks to 1:45.
				// Seek to 999:59 to end the song.
				Player.unloadCurrentTrack = doNothing;
				$('.spotifyTarget')[0].src = track.url + "%23999:59";
			};
		} else {
			setTimeout(Player.unloadCurrentTrack, 1500);
		}

		this.$playContainer.show();
		this.$playContainerSpacer.show();

		this.$playContainer.css('height', embedHeight);
		var playClass = (this.$playContainer.hasClass('minimized') && 'minimized ') + (track.apiName || '');
		this.$playContainer.attr('class', 'playContainer ' + playClass);
		this.$playHeaderInfo.html(this.playheaderTemplate(track));

		$('.playFrame').replaceWith($('<iframe/>').addClass('playFrame'));
		if (track.apiName == 'youtube') {
			// Youtube has a minimum embed height requirement. Workaround.
			$('.playFrame').css('height', '300px');
			setTimeout(function() { $('.playFrame').css('height', '165px'); }, 3000);
		}
		$('.playFrame').attr('src', track.autoPlayUrl);
	}
};

// Console shim
window.console||(window.console={log:function(){}}); //console.log bypass for older browsers

// Bind shim
(function bindShim() {
	if (!Function.prototype.bind) {
		Function.prototype.bind = function (oThis) {
			if (typeof this !== "function") {
				// closest thing possible to the ECMAScript 5 internal IsCallable function
				throw new TypeError("Function.prototype.bind - what is trying to be bound is not callable");
			}

			var aArgs = Array.prototype.slice.call(arguments, 1),
					fToBind = this,
					fNOP = function () {},
					fBound = function () {
						return fToBind.apply(this instanceof fNOP && oThis ? this : oThis,
																 aArgs.concat(Array.prototype.slice.call(arguments)));
					};

			fNOP.prototype = this.prototype;
			fBound.prototype = new fNOP();

			return fBound;
		};
	}
})();

// IE8/9 CORS cross-domain requests compatibility
// https://github.com/jaubourg/ajaxHooks/blob/master/src/ajax/xdr.js
(function( jQuery ) {

if ( window.XDomainRequest ) {
	jQuery.ajaxTransport(function( s ) {
		if ( s.crossDomain && s.async ) {
			if ( s.timeout ) {
				s.xdrTimeout = s.timeout;
				delete s.timeout;
			}
			var xdr;
			return {
				send: function( _, complete ) {
					function callback( status, statusText, responses, responseHeaders ) {
						xdr.onload = xdr.onerror = xdr.ontimeout = jQuery.noop;
						xdr = undefined;
						complete( status, statusText, responses, responseHeaders );
					}
					xdr = new XDomainRequest();
					xdr.open( s.type, s.url );
					xdr.onload = function() {
						callback( 200, "OK", { text: xdr.responseText }, "Content-Type: " + xdr.contentType );
					};
					xdr.onerror = function() {
						callback( 404, "Not Found" );
					};
					if ( s.xdrTimeout ) {
						xdr.ontimeout = function() {
							callback( 0, "timeout" );
						};
						xdr.timeout = s.xdrTimeout;
					}
					xdr.send( ( s.hasContent && s.data ) || null );
				},
				abort: function() {
					if ( xdr ) {
						xdr.onerror = jQuery.noop();
						xdr.abort();
					}
				}
			};
		}
	});
}
})( jQuery );
