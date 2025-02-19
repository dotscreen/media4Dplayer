var checkPositionVideo;

var Media = {
	audiosList:[],
	subtitlesList:[],
	audioDescriptions:[],
	ls:[],
	url:null,

	audioEnabled:true,
	subtitleEnabled:true,
	audioDescriptionEnabled:true,
	LSFEnabled:true,

	currentLSFIndex:0,
	currentAudioIndex:0,
	currentSubtitleIndex:0,
	currentAudioDescriptionIndex:0
};

var Player = {
	alreadyInit:false,
	onClose:null,
	waaAlreadyInit:false,// Ne doit être fait qu'une fois par session
	videoMain: document.getElementById('videoPlayerMain'),
	videoPip: document.getElementById('videoPlayerPip'),
    videoAudio: document.getElementById('videoPlayerAudio'),
	audioFiveDotOne:document.getElementById('playerAudioFiveDotOne'),
	audioFiveDotOne2:document.getElementById('playerAudioFiveDotOne-2'),
	ttmlDiv: document.getElementById('video-caption'),

	playerManager:{
    	playerMain: null,
    	playerPip: null,
    	playerAudio: null,
		playerAudioFiveDotOne:null,
		playerAudioFiveDotOne2:null,
    	controller: null,
    	audioContext: null,
    	optionSigne: true,
    	optionDescription: true,
    	optionSub: true
    },

	isPlaying:false,
	currentPipMode:null,
	pipControlTimeout:null,
	checkPositionVideo:null,
	positionForSeek:0,

	mode:"5.1",
	spatializationMode:"binaural",
	spatializationModes:["binaural","transaural"],
	commentsAzim:0,
	commentsElevationLevel:0,
	commentsDistance:1,
	azimRadius:180,
	distanceRange:[0.5, 10],
	elevationRange:[-40, 90],
	binauralEQ:false,
	catalogue:[],
	selectedProfil:null,
	defaultSampleRate:48000,
	config:null,
	attackTime:10,
	releaseTime:150,
	gainOffset:2,
	dialogsEnhanced:0
};

/**
 * @author Johny EUGENE (DOTSCREEN)
 * @description Generates the parental rating rubric of the settings section
 * @param {String} name The user's name
 * @param {Object} userDetails The user's data
 * @param {Array} thresholds Thresholds list
 * @param {Object} callbackList Contains a success and error callback
 */

Player.load = function(videoData, callback, onClose){

	this.onClose = onClose;

	this.spatializationMode = getHtmlStorage("spatializationMode") || this.spatializationMode;
	this.commentsElevationLevel = getHtmlStorage("commentsElevationLevel") || this.commentsElevationLevel;
	this.commentsDistance = getHtmlStorage("commentsDistance") || this.commentsDistance;
	this.commentsAzim = getHtmlStorage("commentsAzim") || this.commentsAzim;
	this.dialogsEnhanced = this.getDialogsEnhancedState();

	if(!this.alreadyInit || (videoData.links.dataMain.url !== Media.links.dataMain.url)){

		Media = videoData;
		Main.profilsLoaded = [];

		/*if(isEmpty(Media.links.dataMain) || isEmpty(Media.links.dataEA) || isEmpty(Media.links.dataAD) || isEmpty(Media.links.dataDI)){
			log("Lecture annulée car il n'y a pas tout flux audio (isEmpty(Media.links.dataMain)="+isEmpty(Media.links.dataMain)+"; isEmpty(Media.links.dataEA)="+isEmpty(Media.links.dataEA)+";isEmpty(Media.links.dataAD)="+isEmpty(Media.links.dataAD)+";)");
			return;
		}*/

		Media.LSFEnabled = !getHtmlStorage("LSFDisabled") && Media.links.dataLS && Media.links.dataLS.url ? true : false;
		Media.audioEnabled = !getHtmlStorage("audioDisabled") && Media.links.dataMain && Media.links.dataMain.url ? true : false;
		Media.subtitleEnabled = !getHtmlStorage("subtitlesDisabled") && typeOf(Media.subtitlesList) === "array" && Media.subtitlesList.length ? true : false;
		Media.audioDescriptionEnabled = !getHtmlStorage("audioDescriptionDisabled") && Media.links.dataAD && Media.links.dataAD.url ? true : false;

		this.mode = Media.audiosList[1] ? "5.1" : "stereo";
		Media.currentAudioIndex = this.mode === "5.1" && Media.audiosList[1] ? 1 : 0;
		Media.currentAudioDescriptionIndex = 0;
		Media.currentLSFIndex = 0;
		Media.currentSubtitleIndex = 0;

		//LANCEMENT DU PLAYER ATTENTION CODE TOUCHY
		this.launch();

		InfoBanner.load();
	}

	var urlMain 			= Media.links.dataMain.url;
	var urlPip 				= Media.links.dataLS.url;
	var urlAudioDescription	= Media.links.dataAD.url;

	// Doit privilégier EA3 + DI, sinon EA1
	var urlAudioFiveDotOne, urlAudioFiveDotOne2;
	if(videoData.hasEA3DIStream){
		urlAudioFiveDotOne 	= Media.links.dataEA.url;
		urlAudioFiveDotOne2	= Media.links.dataDI.url;

	}else{
		urlAudioFiveDotOne 	= Media.links.dataMC.url;
	}

	this.playerManager.playerMain.attachView(this.videoMain);
	this.playerManager.playerMain.attachSource(urlMain);
	if(Media.LSFEnabled){
		this.playerManager.playerPip.attachView(this.videoPip);
		this.playerManager.playerPip.attachSource(urlPip);
	}
	if(urlAudioFiveDotOne){
		this.playerManager.playerAudioFiveDotOne.attachView(this.audioFiveDotOne);
		this.playerManager.playerAudioFiveDotOne.attachSource(urlAudioFiveDotOne);
	}
	if(urlAudioFiveDotOne2){
		this.playerManager.playerAudioFiveDotOne2.attachView(this.audioFiveDotOne2);
		this.playerManager.playerAudioFiveDotOne2.attachSource(urlAudioFiveDotOne2);
	}
	if(urlAudioDescription){
		this.playerManager.playerAudio.attachView(this.videoAudio);
		this.playerManager.playerAudio.attachSource(urlAudioDescription);
	}

	// Add HTML-rendered TTML subtitles
	this.playerManager.playerMain.attachTTMLRenderingDiv(this.ttmlDiv);

	this.updateActiveStreams();

	if(this.dialogsEnhanced){
		InfoBanner.initADVolumeSlider();
	}

	//Gestion du PIP
	this.setPIP();

	this.initSubtitlesParams();

	this.onChangeEqualization();
	if(this.mode === "5.1"){
		this.onChangeAzim();
		this.onChangeElevation();
		this.onChangeDistance();
	}


	// update the WAA connections
	this.updateWAAConnections();

	// prepare the sofa catalog of HRTF
	this.prepareSofaCatalog();

	this.onChangeSpatilisationMode();

	InfoBanner.show();

	if(Main.profilsLoaded.indexOf(Player.selectedProfil) === -1){
		Player.showLoader();
	}

	if(typeOf(callback) === "function"){
		callback();
	}
};

/**
 * @author Johny EUGENE (DOTSCREEN)
 * @description Generates the parental rating rubric of the settings section
 * @param {String} name The user's name
 * @param {Object} userDetails The user's data
 * @param {Array} thresholds Thresholds list
 * @param {Object} callbackList Contains a success and error callback
 */

Player.launch = function(){

	var context = new Dash.di.DashContext();

	//==============================================================================
	this.playerManager.playerMain = new MediaPlayer(context);
	this.playerManager.playerMain.startup();
	this.playerManager.playerMain.setAutoPlay(false);

	this.playerManager.playerPip = new MediaPlayer(context);
	this.playerManager.playerPip.startup();
	this.playerManager.playerPip.setAutoPlay(false);

	this.playerManager.playerAudioFiveDotOne = new MediaPlayer(context);
	this.playerManager.playerAudioFiveDotOne.startup();
	this.playerManager.playerAudioFiveDotOne.setAutoPlay(false);

	this.playerManager.playerAudioFiveDotOne2 = new MediaPlayer(context);
	this.playerManager.playerAudioFiveDotOne2.startup();
	this.playerManager.playerAudioFiveDotOne2.setAutoPlay(false);

	this.playerManager.playerAudio = new MediaPlayer(context);
	this.playerManager.playerAudio.startup();
	this.playerManager.playerAudio.setAutoPlay(false);

	// remove Dash.js logs
	this.disableLogs();

	this.initWAA();

	var playersToLaunch = 1;
	var players = ["#" + this.videoMain.id, "#" + this.audioFiveDotOne.id, "#" + this.audioFiveDotOne2.id, "#" + this.videoAudio.id, "#" + this.videoPip.id];
	videos = {
		a:Popcorn(players[0])
	};
	if(Media.hasEA3DIStream){
		videos.b = Popcorn(players[1]);
		videos.c = Popcorn(players[2]);
		playersToLaunch+=2;

	}else if(Media.links.dataMC.url){
		videos.b = Popcorn(players[1]);
		playersToLaunch++;
	}
	if(Media.links.dataAD.url){
		videos.d = Popcorn(players[3]);
		playersToLaunch++;
	}
	if(Media.LSFEnabled){
		videos.e = Popcorn(players[4]);
		playersToLaunch++;
	}

	videos.a.on('playing', function() {
		Player.onPlay();
		if(videos.b){
			videos.b.play();
		}
		if(videos.c){
			videos.c.play();
		}
		if(videos.d){
			videos.d.play();
		}
		if(videos.e){
			videos.e.play();
		}
	});

	this.playerManager.playerMain.addEventListener(MediaPlayer.events.TEXT_TRACKS_ADDED, function(){
		log("MediaPlayer.events.TEXT_TRACKS_ADDED");
		if(getHtmlStorage("subtitlesDisabled")){
			Player.playerManager.playerMain.setTextTrack(-1);
		}else{
			Player.playerManager.playerMain.setTextTrack(Media.currentSubtitleIndex);
		}

		/*var yPos = getHtmlStorage("subtitlePositionY");
		if(yPos !== "undefined"){
			$(Player.ttmlDiv).css({top:Math.round(yPos) + "%"});
		}*/
	});
	var updateCurrentTime = function(media, cTime){
		if(media){
			media.currentTime(cTime);
		}
	},
		resyncCurrentTime = function(media, cTime){
		if(media && media.media.readyState === 4){
			var cTime2 = media.currentTime(), diff = Math.abs(cTime-cTime2), id = media.media.id;
			if (diff > 0.1) {
				//log("-----------------------------------------------Recalage nécessaire ("+diff+">0.1) pour "+id);
				updateCurrentTime(media, cTime);
			}else{
				//log("Recalage pas nécessaire ("+diff+"<0.1) pour "+id);
			}
		}
	},
		emitTimetableEvent = function(media){
		if(media){
			media.emit("timeupdate");
		}
	},
		emitPauseEvent = function(media){
		if(media){
			media.pause();
		}
	};

	loadCount = 0;
	events = ("pause ended timeupdate seeking seeked play").split(/\s+/g);

	// iterate both media sources
	Popcorn.forEach(videos, function (media, type) {

		// when each is ready...
		media.on("canplayall", function () {

			// trigger a custom "sync" event
			this.emit("sync");

			// set the max value of the "scrubber"
			//scrub.attr("max", this.duration());

			// Listen for the custom sync event...
		}).on("sync", function () {

			// Once both items are loaded, sync events
			if (++loadCount === playersToLaunch) {

				// Iterate all events and trigger them on the video B
				// whenever they occur on the video A
				events.forEach(function (event) {

					videos.a.on(event, function () {
						log("event name = " + event+"------------------------------------------------");
						// Avoid overkill events, trigger timeupdate manually

						var cTime = this.currentTime();
						switch(event){

							case "timeupdate":

								if (!this.media.paused) {
									requestAnimationFrame(function(){});

									resyncCurrentTime(videos.b, cTime);
									resyncCurrentTime(videos.c, cTime);
									resyncCurrentTime(videos.d, cTime);
									resyncCurrentTime(videos.e, cTime);
									return;
								}

								emitTimetableEvent(videos.b);
								emitTimetableEvent(videos.c);
								emitTimetableEvent(videos.d);
								emitTimetableEvent(videos.e);
								break;

							case "seeking":
								emitPauseEvent(videos.b);
								emitPauseEvent(videos.c);
								emitPauseEvent(videos.d);
								emitPauseEvent(videos.e);
								console.warn("event seeking");
								Player.showLoader();
								break;

							case "seeked":
								updateCurrentTime(videos.b, cTime);
								updateCurrentTime(videos.c, cTime);
								updateCurrentTime(videos.d, cTime);
								updateCurrentTime(videos.e, cTime);
								Player.hideLoader();
								break;

							case "pause":
								Player.onPause();

								emitPauseEvent(videos.b);
								emitPauseEvent(videos.c);
								emitPauseEvent(videos.d);
								emitPauseEvent(videos.e);
								break;

							case "ended":
								Player.alreadyInit = false;
								Player.validClose();
								break;

							case "play":
								console.warn("event play");
								Player.hideLoader();
								break;

							default:
								log("évènement "+event+" non géré");
								break;
						}
					});
				});

				if(Main.profilsLoaded.indexOf(Player.selectedProfil) !== -1){
					Player.launchPlaying();
				}
			}
		});
	});
};

/**
 * @author Johny EUGENE (DOTSCREEN)
 * @description Generates the parental rating rubric of the settings section
 * @param {String} name The user's name
 * @param {Object} userDetails The user's data
 * @param {Array} thresholds Thresholds list
 * @param {Object} callbackList Contains a success and error callback
 */

Player.initWAA = function(){

	var mainData = JSON.parse(JSON.stringify(Media.links.dataMain));
	var eaData = JSON.parse(JSON.stringify(Media.links.dataEA));
	var adData = JSON.parse(JSON.stringify(Media.links.dataAD));
	var diData = JSON.parse(JSON.stringify(Media.links.dataDI));
	var mcData = JSON.parse(JSON.stringify(Media.links.dataMC));

	/// Workaround when all the streams are not in the EBU Core
	if(!Media.links.dataEA.type){
		eaData.type = "MultiWithLFE";
	}
	if(!Media.links.dataAD.type){
		adData.type = "Mono";
	}
	if(!Media.links.dataDI.type){
		diData.type = "Mono";
	}
	if(!Media.links.dataMC.type){
		mcData.type = "MultiWithLFE";
	}

	//==============================================================================
	var isTrue = function(prop){
		return prop === "true" || prop === true;
	};

	if(!this.waaAlreadyInit){
		this.playerManager.audioContext = new(window.AudioContext || window.webkitAudioContext)();

		//==============================================================================
		var audioSourceMain 	 	= this.playerManager.audioContext.createMediaElementSource( this.videoMain );
		var audioSourceFiveDotOne  	= this.playerManager.audioContext.createMediaElementSource( this.audioFiveDotOne );
		var audioSourceFiveDotOne2 	= this.playerManager.audioContext.createMediaElementSource( this.audioFiveDotOne2 );
		var audioSourceDescription	= this.playerManager.audioContext.createMediaElementSource(this.videoAudio);

		/// create a 10-channel stream containing all audio materials
		var channelMerger = this.playerManager.audioContext.createChannelMerger(10);

		var channelSplitterMain 		= this.playerManager.audioContext.createChannelSplitter( 2 );
		var channelSplitterFiveDotOne	= this.playerManager.audioContext.createChannelSplitter( 6 );
		var channelSplitterFiveDotOne2	= this.playerManager.audioContext.createChannelSplitter( 1 );
		var channelSplitterDescription 	= this.playerManager.audioContext.createChannelSplitter( 1 );

		audioSourceMain.connect( channelSplitterMain );
		audioSourceFiveDotOne.connect( channelSplitterFiveDotOne );
		audioSourceFiveDotOne2.connect( channelSplitterFiveDotOne2 );
		audioSourceDescription.connect( channelSplitterDescription );

		channelSplitterMain.connect( channelMerger, 0, 0 );
		channelSplitterMain.connect( channelMerger, 1, 1 );

		channelSplitterFiveDotOne.connect( channelMerger, 0, 2 );
		channelSplitterFiveDotOne.connect( channelMerger, 1, 3 );
		channelSplitterFiveDotOne.connect( channelMerger, 2, 4 );
		channelSplitterFiveDotOne.connect( channelMerger, 3, 5 );
		channelSplitterFiveDotOne.connect( channelMerger, 4, 6 );
		channelSplitterFiveDotOne.connect( channelMerger, 5, 7 );

		channelSplitterDescription.connect( channelMerger, 0, 8 );

		channelSplitterFiveDotOne2.connect( channelMerger, 0, 9 );

		// Son principal
		mainAudioASD = new M4DPAudioModules.AudioStreamDescription(
				mainData.type,
				this.mode === "stereo" && Media.audioEnabled,
				parseFloat(mainData.loudness,10),
				parseFloat(mainData.maxTruePeak,10),
				isTrue(mainData.dialog),
				isTrue(mainData.ambiance),
				isTrue(mainData.commentary));

		if(Media.hasEA3DIStream){

			// Ambiance (pour le 5.1) / Ambiance + dialogues (pour le 5.1 multicanal)
			extendedAmbienceASD = new M4DPAudioModules.AudioStreamDescription(
					eaData.type,
					typeof( Media.links.dataEA.type ) !== "undefined" && this.mode === "5.1" && Media.audioEnabled,
					parseFloat(eaData.loudness,10),
					parseFloat(eaData.maxTruePeak,10),
					isTrue(eaData.dialog),
					isTrue(eaData.ambiance),
					isTrue(eaData.commentary));

			// Dialogue (pour le 5.1)
			extendedDialogsASD = new M4DPAudioModules.AudioStreamDescription(
					diData.type,
					typeof( Media.links.dataDI.type ) !== "undefined" && this.mode === "5.1" && Media.audioEnabled,
					parseFloat(diData.loudness,10),
					parseFloat(diData.maxTruePeak,10),
					isTrue(diData.dialog),
					isTrue(diData.ambiance),
					isTrue(diData.commentary));

		}else{

			// Ambiance (pour le 5.1) / Ambiance + dialogues (pour le 5.1 multicanal)
			extendedAmbienceASD = new M4DPAudioModules.AudioStreamDescription(
					mcData.type,
					typeof( Media.links.dataMC.type ) !== "undefined" && this.mode === "5.1" && Media.audioEnabled,
					parseFloat(mcData.loudness,10),
					parseFloat(mcData.maxTruePeak,10),
					isTrue(mcData.dialog),
					isTrue(mcData.ambiance),
					isTrue(mcData.commentary));

			// Dialogue (pour le 5.1)
			extendedDialogsASD = new M4DPAudioModules.AudioStreamDescription(diData.type);
		}

		// Commentaires
		extendedCommentsASD = new M4DPAudioModules.AudioStreamDescription(
				adData.type,
				Media.audioDescriptionEnabled,
				parseFloat(adData.loudness,10),
				parseFloat(adData.maxTruePeak,10),
				isTrue(adData.dialog),
				isTrue(adData.ambiance),
				isTrue(adData.commentary));

		var asdc = new M4DPAudioModules.AudioStreamDescriptionCollection(
				[mainAudioASD, extendedAmbienceASD, extendedCommentsASD, extendedDialogsASD]
		);

		//==============================================================================
		// M4DPAudioModules

		/// connect either the multichannel spatializer or the object spatializer
		ModulesConfiguration = {
			kMultichannelSpatialiser : 0,
			kObjectSpatialiserAndMixer : 1
		};

		streamSelector = new M4DPAudioModules.StreamSelector( this.playerManager.audioContext, asdc );
		smartFader = new M4DPAudioModules.SmartFader( this.playerManager.audioContext, asdc );
		dialogEnhancement = new M4DPAudioModules.DialogEnhancement( this.playerManager.audioContext, asdc );
		receiverMix = new M4DPAudioModules.ReceiverMix( this.playerManager.audioContext, asdc );
		//var noiseAdaptation = new M4DPAudioModules.NoiseAdaptation(this.playerManager.audioContext);
		multichannelSpatialiser = new M4DPAudioModules.MultichannelSpatialiser( this.playerManager.audioContext, asdc, this.spatializationMode );
		objectSpatialiserAndMixer = new M4DPAudioModules.ObjectSpatialiserAndMixer( this.playerManager.audioContext, asdc, this.spatializationMode );

		{
			///@bug : the channelSplitterMain MUST be connected to the AudioContext,
			/// otherwise the video wont read.
			/// so as a workaround, we just add a dummuy node, with 0 gain,
			/// to connect the channelSplitterMain
			var uselessGain = this.playerManager.audioContext.createGain();
			channelSplitterMain.connect( uselessGain, 0, 0 );
			uselessGain.gain.value = 0;

			uselessGain.connect( this.playerManager.audioContext.destination, 0, 0 );
		}

		/// WAA connections
		{
			/// receives 4 ADSC with 10 channels in total
			channelMerger.connect( streamSelector._input );

			/// mute or unmute the inactive streams
			/// (process 10 channels in total)
			streamSelector.connect( smartFader._input );
		}

		smartFader.setAttackTimeFromGui( {value:this.attackTime, min:0,max:100} );
		smartFader.setReleaseTimeFromGui( {value:this.releaseTime, min:0,max:100} );
		multichannelSpatialiser.offsetGain = this.gainOffset;
		objectSpatialiserAndMixer.offsetGain = this.gainOffset;
		this.waaAlreadyInit = true;

	}else{
		mainAudioASD.type = mainData.type;
		mainAudioASD.active = this.mode === "stereo" && Media.audioEnabled;
		mainAudioASD.loudness = parseFloat(mainData.loudness);
		mainAudioASD.maxTruePeak = parseFloat(mainData.maxTruePeak);
		mainAudioASD.dialog = isTrue(mainData.dialog);
		mainAudioASD.ambiance = isTrue(mainData.ambiance);
		mainAudioASD.commentary = isTrue(mainData.commentary);

		if(Media.hasEA3DIStream){
			extendedAmbienceASD.type = eaData.type;
			extendedAmbienceASD.active = typeof( Media.links.dataEA.type ) !== "undefined" && this.mode === "5.1" && Media.audioEnabled;
			extendedAmbienceASD.loudness = parseFloat(eaData.loudness);
			extendedAmbienceASD.maxTruePeak = parseFloat(eaData.maxTruePeak);
			extendedAmbienceASD.dialog = isTrue(eaData.dialog);
			extendedAmbienceASD.ambiance = isTrue(eaData.ambiance);
			extendedAmbienceASD.commentary = isTrue(eaData.commentary);

			extendedDialogsASD.type = diData.type;
			extendedDialogsASD.active = typeof( Media.links.dataDI.type ) !== "undefined" && this.mode === "5.1" && Media.audioEnabled;
			extendedDialogsASD.loudness = parseFloat(diData.loudness);
			extendedDialogsASD.maxTruePeak = parseFloat(diData.maxTruePeak);
			extendedDialogsASD.dialog = isTrue(diData.dialog);
			extendedDialogsASD.ambiance = isTrue(diData.ambiance);
			extendedDialogsASD.commentary = isTrue(diData.commentary);

		}else{

			extendedAmbienceASD.type = mcData.type;
			extendedAmbienceASD.active = typeof( Media.links.dataMC.type ) !== "undefined" && this.mode === "5.1" && Media.audioEnabled;
			extendedAmbienceASD.loudness = parseFloat(mcData.loudness);
			extendedAmbienceASD.maxTruePeak = parseFloat(mcData.maxTruePeak);
			extendedAmbienceASD.dialog = isTrue(mcData.dialog);
			extendedAmbienceASD.ambiance = isTrue(mcData.ambiance);
			extendedAmbienceASD.commentary = isTrue(mcData.commentary);

			extendedDialogsASD.active = false;
			extendedDialogsASD.loudness = false;
			extendedDialogsASD.maxTruePeak = false;
			extendedDialogsASD.dialog = false;
			extendedDialogsASD.ambiance = false;
			extendedDialogsASD.commentary = false;
		}

		extendedCommentsASD.type = adData.type;
		extendedCommentsASD.active = Media.audioDescriptionEnabled;
		extendedCommentsASD.loudness = parseFloat(adData.loudness);
		extendedCommentsASD.maxTruePeak = parseFloat(adData.maxTruePeak);
		extendedCommentsASD.dialog = isTrue(adData.dialog);
		extendedCommentsASD.ambiance = isTrue(adData.ambiance);
		extendedCommentsASD.commentary = isTrue(adData.commentary);
	}

	this.config = this.mode === "5.1" ? ModulesConfiguration.kObjectSpatialiserAndMixer : ModulesConfiguration.kMultichannelSpatialiser;

	log(mainAudioASD);
	log(extendedAmbienceASD);
	log(extendedDialogsASD);
	log(extendedCommentsASD);
};

/**
 * @author Johny EUGENE (DOTSCREEN)
 * @description Generates the parental rating rubric of the settings section
 * @param {String} name The user's name
 * @param {Object} userDetails The user's data
 * @param {Array} thresholds Thresholds list
 * @param {Object} callbackList Contains a success and error callback
 */

Player.launchPlaying = function(){

	this.hideLoader();
	if(videos.a){
		if(this.positionForSeek){

			this.doSeek(this.positionForSeek);
			videos.a.play();
			this.positionForSeek = 0;

		}else if(Media.subWordPos){
			var arrayTime = Media.subWordPos.capBegin.replace(/\.[0-9]+/, "").split(":");
			this.doSeek(getDurationInSec(arrayTime));
			videos.a.play();
		}else{
			videos.a.play();
		}
	}
};

/**
 * @author Johny EUGENE (DOTSCREEN)
 * @description Generates the parental rating rubric of the settings section
 * @param {String} name The user's name
 * @param {Object} userDetails The user's data
 * @param {Array} thresholds Thresholds list
 * @param {Object} callbackList Contains a success and error callback
 */

Player.setVolume = function(volume){

	var minFader = 0;
	var maxFader = 100;

	var minValue = -60;
	var maxValue = 8;

	/// scale from GUI to DSP
	var value = M4DPAudioModules.utilities.scale( volume, minFader, maxFader, minValue, maxValue );

	log('Smart Fader = ' + Math.round(value).toString() + ' dB');

	/// sets the smart fader dB gain
	smartFader.dB = value;
};

/**
 * @author Johny EUGENE (DOTSCREEN)
 * @description Generates the parental rating rubric of the settings section
 * @param {String} name The user's name
 * @param {Object} userDetails The user's data
 * @param {Array} thresholds Thresholds list
 * @param {Object} callbackList Contains a success and error callback
 */

Player.setMute = function(){
	this.setVolume(0);
	setHtmlStorage("volumeValue", 0);
	setHtmlStorage("muteEnabled", 1);
	$('.volume').css('background-position', '0 0');
};

/**
 * @author Johny EUGENE (DOTSCREEN)
 * @description Generates the parental rating rubric of the settings section
 * @param {String} name The user's name
 * @param {Object} userDetails The user's data
 * @param {Array} thresholds Thresholds list
 * @param {Object} callbackList Contains a success and error callback
 */

Player.onPause = function() {
	this.isPlaying = false;
	InfoBanner.hidePauseBtn();
	this.stopCheckVideoPosition();
};

/**
 * @author Johny EUGENE (DOTSCREEN)
 * @description Generates the parental rating rubric of the settings section
 * @param {String} name The user's name
 * @param {Object} userDetails The user's data
 * @param {Array} thresholds Thresholds list
 * @param {Object} callbackList Contains a success and error callback
 */

Player.onPlay = function() {
	this.isPlaying = true;
	this.launchCheckPositionVideo();
	InfoBanner.showPauseBtn();
};

/**
 * @author Johny EUGENE (DOTSCREEN)
 * @description Generates the parental rating rubric of the settings section
 * @param {String} name The user's name
 * @param {Object} userDetails The user's data
 * @param {Array} thresholds Thresholds list
 * @param {Object} callbackList Contains a success and error callback
 */

Player.validClose = function() {
	this.resetPlayers();

	InfoBanner.progressBar.reset();

	if(typeOf(this.onClose) === "function"){
		this.onClose();
	}

	Navigation.goBack();
};

/**
 * @author Johny EUGENE (DOTSCREEN)
 * @description Generates the parental rating rubric of the settings section
 * @param {String} name The user's name
 * @param {Object} userDetails The user's data
 * @param {Array} thresholds Thresholds list
 * @param {Object} callbackList Contains a success and error callback
 */

Player.resetPlayers = function(){

	videos.a.destroy();
	videos.a = null;
	if(videos.b){
		videos.b.destroy();
		videos.b = null;
	}
	if(videos.c){
		videos.c.destroy();
		videos.c = null;
	}
	if(videos.d){
		videos.d.destroy();
		videos.d = null;
	}
	if(videos.e){
		videos.e.destroy();
		videos.e = null;
	}

	this.playerManager.playerMain.reset();
	this.playerManager.playerPip.reset();
	this.playerManager.playerAudio.reset();
	this.playerManager.playerAudioFiveDotOne.reset();
	this.playerManager.playerAudioFiveDotOne2.reset();
};

Player.setPIP = function(){

	var $ctn = $(document.getElementById("pipContainer")),
		$pipVideo = $(document.getElementById("pipVideo")),
		appearPipControls = function(){

		if(Player.pipControlTimeout){
			clearInterval(Player.pipControlTimeout);
		}
		Player.pipControlTimeout = setTimeout(function(){

			$ctn.css("border-style","hidden");
			$pipVideo.css("border-style","hidden");
			$pipVideo.children(".ui-icon").hide();

		}, Config.timeoutHidePIP *1000);

		$ctn.css("border-style","solid");
		$pipVideo.css("border-style","solid").children(".ui-icon").show();
	};

	$pipVideo.css("left", (getHtmlStorage("LSFPip_position_x") || Settings.defaultLSPIPCoordonates.x) + "%" )
		.css("top", (getHtmlStorage("LSFPip_position_y") || Settings.defaultLSPIPCoordonates.y) + "%" )
		.css("width", (getHtmlStorage("LSFPip_size_width") || Settings.defaultLSPIPCoordonates.w) + "%" )
		.css("height", (getHtmlStorage("LSFPip_size_height") || Settings.defaultLSPIPCoordonates.h) + "%" )
		.draggable({
			containment: $ctn.parent(),
			scroll:false,
			handle:".ui-icon-gripsmall-center",
			stop: function() {
				appearPipControls();
				Settings.saveLSPIPPosition($( this ).draggable( "option", "containment" ), $(this));
			},
			start: function() {
				clearInterval(Player.pipControlTimeout);
				$ctn.css("border-style","solid");
				$(this).css("border-style","solid");
			}
		}).resizable({
			containment: "parent",
			handles: 'all',
			minWidth: 100,
			aspectRatio: true,
			stop: function() {
				var $containment = $( this ).draggable( "option", "containment" );
				Settings.saveLSPIPSize($containment, $(this));
				Settings.saveLSPIPPosition($containment, $(this));
			}
		}).click( function() {
			if(InfoBanner.isDisplayed()){
				InfoBanner.hide();
			}else if(Media.LSFEnabled){
				appearPipControls();
			}
		});

	$('.ui-resizable-nw').addClass('ui-icon ui-icon-gripsmall-diagonal-nw');
	$('.ui-resizable-ne').addClass('ui-icon ui-icon-gripsmall-diagonal-ne');
	$('.ui-resizable-sw').addClass('ui-icon ui-icon-gripsmall-diagonal-sw');
	$('.ui-resizable-se').addClass('ui-icon ui-icon-gripsmall-diagonal-se');
	$pipVideo.children(".ui-icon").hide();
};

Player.initSubtitlesParams = function(){

	// subtitles
	var $container = $(this.ttmlDiv).removeClass("Arial OpenDyslexic Andika Helvetica Verdana");
	var selectedFont = getHtmlStorage("subtitleFont") || Settings.defaultFont;
	if(selectedFont){
		$container.addClass(selectedFont);
	}

	// color
	$container.removeClass("transparentColor whiteColor yellowColor blueColor");
	var selectedFontColor = getHtmlStorage("subtitleFontColor") || Settings.defaultSubtitlesColor;
	if(selectedFontColor){
		$container.addClass(selectedFontColor+"Color");
	}

	// background color
	$container.removeClass("blackBGColor whiteBGColor");
	var selectedFontBGColor = getHtmlStorage("subtitleBGColor") || Settings.defaultSubtitlesBGColor;
	if(selectedFontBGColor){
		$container.addClass(selectedFontBGColor+"BGColor");
	}

	// Opacité du background
	$container.removeClass("opacity_0 opacity_025 opacity_05 opacity_075 opacity_1");
	var selectedFontBGColor = getHtmlStorage("subtitleBackgroundOpacity") || Settings.minOpacity;
	if(selectedFontBGColor){
		$container.addClass("opacity_"+selectedFontBGColor.replace(".",""));
	}

	// font-size
	$container.css("font-size", "inherit");
	var selectedFontSize = getHtmlStorage("subtitleFontSize") || Settings.minSubtitlesSize;
	if(selectedFontSize){
		$container.css("font-size", selectedFontSize+"px");
	}

	var yPos = getHtmlStorage("subtitlePositionY") || Settings.subtitlesDefaultPosition;
	if(yPos !== "undefined"){
		var s = selectedFontSize * 4.7;
		var newY = (100 * (yPos - 0.5) * (720 - s)) / (720 * 68.5);
		$container.css({top: newY + "%"});
	}
};

Player.updateWAAConnections = function(){

    smartFader.disconnect();
	dialogEnhancement.disconnect();
	receiverMix.disconnect();
    multichannelSpatialiser.disconnect();
    objectSpatialiserAndMixer.disconnect();

    var processor;

    if( this.config === ModulesConfiguration.kMultichannelSpatialiser ){
        processor = multichannelSpatialiser;

    }else if( this.config === ModulesConfiguration.kObjectSpatialiserAndMixer ){
        processor = objectSpatialiserAndMixer;

    }else{
        throw new Error( "Invalid configuration" );
    }

    smartFader.connect( dialogEnhancement._input );

    dialogEnhancement.connect( receiverMix._input );

	receiverMix.connect( processor._input );

    /// apply the multichannel spatialiser
    processor.connect( this.playerManager.audioContext.destination );

	Player.onChangeProfil();
};

Player.prepareSofaCatalog = function(callback){

	if(this.catalogue.length){
		Player.onChangeProfil();

		if(typeOf(callback) === "object" && callback.onSuccess){
			callback.onSuccess();
		}
		return;
	}

	var _callback = function(list){
		Settings.init.audio.audioProfil.setAudioProfil(list);
		Player.onChangeProfil();

		if(typeOf(callback) === "object" && callback.onSuccess){
			callback.onSuccess();
		}
	};

	getSofaCatalogue(Player.playerManager.audioContext.sampleRate, _callback);
};

Player.onChangeProfil = function(){

	var url = this.selectedProfil;
	if(url){

        var currentProcessor;
        if( this.config === ModulesConfiguration.kMultichannelSpatialiser ){
            currentProcessor = multichannelSpatialiser;
        }
        else{
            currentProcessor = objectSpatialiserAndMixer;
        }

        /// load the URL in the spatialiser
		currentProcessor.loadHrtfSet( url )
		.then( function(){
			objectSpatialiserAndMixer._updateCommentaryPosition();
		});
	}else{
		log("Il n'y pas d'url de profil");
	}
};

Player.onChangeEqualization = function(){
	multichannelSpatialiser.eqPreset = "eq1";
	objectSpatialiserAndMixer.eqPreset = "eq1";

	if (this.binauralEQ) {
		multichannelSpatialiser.bypassHeadphoneEqualization( false );
        objectSpatialiserAndMixer.bypassHeadphoneEqualization( false );
	} else {
		multichannelSpatialiser.bypassHeadphoneEqualization( true );
		objectSpatialiserAndMixer.bypassHeadphoneEqualization( true );
	}
};

Player.onChangeAzim = function(){
	objectSpatialiserAndMixer.setCommentaryAzimuth( parseFloat( this.commentsAzim ) );
};

Player.onChangeElevation = function(){
	objectSpatialiserAndMixer.setCommentaryElevation( parseFloat( this.commentsElevationLevel ) );
};

Player.onChangeDistance = function(){
	objectSpatialiserAndMixer.setCommentaryDistance( parseFloat( this.commentsDistance ) );
};

Player.onChangeSpatilisationMode = function(){
	multichannelSpatialiser.outputType = this.spatializationMode;
	objectSpatialiserAndMixer.outputType = this.spatializationMode;
};

Player.onChangeADVolume = function(value){

	dialogEnhancement.balance = value;
	//setHtmlStorage("dialogEnhancementBalance", value);
};
																								/********************************
																								*	GESTION DE LA PROGRESSBAR	*
																								********************************/

/**
 * @author Johny EUGENE (DOTSCREEN)
 * @description Launches the progress bar updating
 */

Player.launchCheckPositionVideo = function(){
	this.stopCheckVideoPosition();
	this.checkPositionVideo = setInterval(function(){
		InfoBanner.progressBar.update(videos.a.currentTime(), videos.a.duration());

		var upVol = document.getElementById('up-volume');
		var isCompressed = smartFader.dynamicCompressionState;
		if( isCompressed === true){
			console.error("compressed at "+ videos.a.currentTime());
			upVol.style.backgroundColor = "rgba(255, 0, 0, 0.7)";

		}else{
			upVol.style.backgroundColor = "rgba(0, 0, 0, 0)";
		}
	}, 500);
};

/**
 * @author Johny EUGENE (DOTSCREEN)
 * @description Stop the progress bar updating
 */

Player.stopCheckVideoPosition = function(){
	clearInterval(this.checkPositionVideo);
};

																								/****************************
																								*	GESTION DU TRICK MODE	*
																								****************************/

/**
 * @author Johny EUGENE (DOTSCREEN)
 * @description Updates the progress bar
 * @param {Integer} time The current position inside the video (in milliseconds)
 * @param {Integer} tT Total time of the video (in milliseconds)
 */

Player.rw = function(){

	var totalTimeSecond =  videos.a.duration();
	var saut = Math.round(totalTimeSecond*(5/100));
	var currentPosition = videos.a.currentTime();
	var newCurrentPosition = currentPosition - saut;
	if (newCurrentPosition < 0) {
		newCurrentPosition = 0;
	}

	// check if the new position is seekable
	this.doSeek(newCurrentPosition);
};

/**
 * @author Johny EUGENE (DOTSCREEN)
 * @description Updates the progress bar
 * @param {Integer} time The current position inside the video (in milliseconds)
 * @param {Integer} tT Total time of the video (in milliseconds)
 */

Player.ff = function(){

	var totalTimeSecond =  videos.a.duration();
	var saut = Math.round(totalTimeSecond*(5/100));
	var currentPosition = videos.a.currentTime();
	var newCurrentPosition = currentPosition + saut;

	// check if the new position is seekable
	this.doSeek(newCurrentPosition);
};

/**
 * @author Johny EUGENE (DOTSCREEN)
 * @description Updates the progress bar
 * @param {Integer} time The current position inside the video (in milliseconds)
 * @param {Integer} tT Total time of the video (in milliseconds)
 */

Player.doSeek = function(position){
	log("doSeek() : position to seek  = "+position);

	var i, l = videos.a.seekable().length;
	for (i=0; i<l; i++) {

		if (videos.a.seekable().start(i) <= position && position <= videos.a.seekable().end(i)) {
			videos.a.currentTime(position);
			InfoBanner.launchMaskingAfterDelay();
			break;
		}
	}
};

/**
 * @author Johny EUGENE (DOTSCREEN)
 * @description Updates the progress bar
 * @param {Integer} time The current position inside the video (in milliseconds)
 * @param {Integer} tT Total time of the video (in milliseconds)
 */

Player.playPause = function() {

	if(this.isPlaying) {
		this.pause();

	}else{
		this.play();
	}

	InfoBanner.launchMaskingAfterDelay();
};

/**
 * @author Johny EUGENE (DOTSCREEN)
 * @description Updates the progress bar
 * @param {Integer} time The current position inside the video (in milliseconds)
 * @param {Integer} tT Total time of the video (in milliseconds)
 */

Player.play = function() {
	videos.a.play();
};

/**
 * @author Johny EUGENE (DOTSCREEN)
 * @description Updates the progress bar
 * @param {Integer} time The current position inside the video (in milliseconds)
 * @param {Integer} tT Total time of the video (in milliseconds)
 */

Player.pause = function() {
	videos.a.pause();
};

/**
 * @author Johny EUGENE (DOTSCREEN)
 * @description Updates the progress bar
 * @param {Integer} time The current position inside the video (in milliseconds)
 * @param {Integer} tT Total time of the video (in milliseconds)
 */

Player.activeOptionSigne = function(index) {

	var $textContent = $(document.getElementById("playerOptionSigneCurrentValue"));

	var playerPIP, playerMain;
	playerPIP = this.playerManager.playerPip;
	playerMain = this.playerManager.playerMain;

	if(index !== Media.ls.length){

		playerPIP.startup();
		playerPIP.setAutoPlay(false);
		playerPIP.attachView(this.videoPip);
		playerPIP.attachSource(Media.links.dataLS.url);

		videos.e = Popcorn("#" + this.videoPip.id);

		Media.currentLSFIndex = index;
		Media.LSFEnabled = true;
		removeHtmlStorage("LSFDisabled");
		$textContent.html(Media.ls[index]);

	}else{
		if(videos.e){
			videos.e.destroy();
			videos.e = null;
		}
		this.videoPip.controller = null;
		playerPIP.reset();

		Media.LSFEnabled = false;
		setHtmlStorage("LSFDisabled", 1);
		$textContent.html("Aucun");
	}
};

/**
 * @author Johny EUGENE (DOTSCREEN)
 * @description Updates the progress bar
 * @param {Integer} time The current position inside the video (in milliseconds)
 * @param {Integer} tT Total time of the video (in milliseconds)
 */

Player.activeOptionSub = function(index) {

	var $textContent = $(document.getElementById("playerOptionSubCurrentValue"));
	if(index !== Media.subtitlesList.length){
		this.playerManager.playerMain.setTextTrack(index);

		Media.currentSubtitleIndex = index;
		Media.subtitleEnabled = true;
		removeHtmlStorage("subtitlesDisabled");
		$textContent.html(Media.subtitlesList[index] + '<img src="ressources/img/sourd.png" height="100%" style="vertical-align:top;margin-left:10px;"/>');

	}else{
		this.playerManager.playerMain.setTextTrack(-1);

		Media.subtitleEnabled = false;
		Media.currentSubtitleIndex = 0;
		setHtmlStorage("subtitlesDisabled", 1);
		$textContent.html("Aucun");
	}
};

/**
 * @author Johny EUGENE (DOTSCREEN)
 * @description Updates the progress bar
 * @param {Integer} time The current position inside the video (in milliseconds)
 * @param {Integer} tT Total time of the video (in milliseconds)
 */

Player.activeOptionDescription = function(index) {

	var $textContent = $(document.getElementById("playerOptionDescriptionCurrentValue"));

	if(index !== Media.audioDescriptions.length){
		extendedCommentsASD.active = true;

		Media.currentAudioDescriptionIndex = index;
		Media.audioDescriptionEnabled = true;
		removeHtmlStorage("audioDescriptionDisabled");
		$textContent.html(Media.audioDescriptions[index].lang);

		var value = parseFloat(getHtmlStorage("dialogEnhancementBalance")) || Settings.defaultDialogEnhancementBalance;
		$( document.getElementById("ad-volume-slider") ).slider("value", value);

	}else{

		extendedCommentsASD.active = false;

		Media.audioDescriptionEnabled = false;
		setHtmlStorage("audioDescriptionDisabled", 1);
		$textContent.html("Aucun");
	}

	this.updateActiveStreams();
};

/**
 * @author Johny EUGENE (DOTSCREEN)
 * @description Updates the progress bar
 * @param {Integer} time The current position inside the video (in milliseconds)
 * @param {Integer} tT Total time of the video (in milliseconds)
 */

Player.activeOptionAudio = function(index) {

	var $textContent = $(document.getElementById("playerOptionAudioCurrentValue"));

	Media.currentAudioIndex = index;
	if(index !== Media.audiosList.length){
		Media.audioEnabled = true;
		removeHtmlStorage("audioDisabled");

		if(Media.audiosList[index].search("5.1") !== -1){
			Player.mode = "5.1";
			mainAudioASD.active = false;
		}else{
			Player.mode = "stereo";
			extendedAmbienceASD.active = false;
			extendedDialogsASD.active = false;
		}

		if(Player.mode === "5.1"){
			extendedAmbienceASD.active = true;
			extendedDialogsASD.active = true;
		}else{
			mainAudioASD.active = true;
		}

		$textContent.html(Media.audiosList[index]);

	}else{
		Media.audioEnabled = false;
		setHtmlStorage("audioDisabled", 1);
		$(document.getElementById("playerOptionAudioCurrentValue")).html("Aucun");
		if(Player.mode === "5.1"){
			extendedAmbienceASD.active = false;
			extendedDialogsASD.active = false;
		}else{
			mainAudioASD.active = false;
		}
	}
	this.updateActiveStreams();
};

Player.updateActiveStreams = function(){

	extendedCommentsASD.trim = Math.round(M4DPAudioModules.utilities.scale(parseInt(getHtmlStorage("extendedADVolume"), 10) || 0, 0, 100, -60, 30));

	/// notify the modification of active streams
	streamSelector.streamsTrimChanged();
	streamSelector.activeStreamsChanged();
	smartFader.activeStreamsChanged();
    dialogEnhancement.activeStreamsChanged();
	receiverMix.activeStreamsChanged();
	multichannelSpatialiser.activeStreamsChanged();
	objectSpatialiserAndMixer.activeStreamsChanged();

	if(dialogEnhancement.mode === 3){
		dialogEnhancement.balance = 0;
	}else if([1,2].indexOf(dialogEnhancement.mode) !== -1){
		dialogEnhancement.balance = Settings.defaultDialogEnhancementBalance;
	}else{
		log("Je n'ai pas encore le mode");
	}

	if(this.dialogsEnhanced){
		InfoBanner.initADVolumeSlider();
	}
};

Player.getDialogsEnhancedState = function(){
	return parseInt(getHtmlStorage("dialogsEnhanced"),10) || 0;
};

Player.disableLogs = function(){
	this.playerManager.playerMain.getDebug().setLogToBrowserConsole(false);
	this.playerManager.playerPip.getDebug().setLogToBrowserConsole(false);
	this.playerManager.playerAudioFiveDotOne.getDebug().setLogToBrowserConsole(false);
	this.playerManager.playerAudioFiveDotOne2.getDebug().setLogToBrowserConsole(false);
	this.playerManager.playerAudio.getDebug().setLogToBrowserConsole(false);
};

Player.showLoader = function(){
	document.getElementById("player-loader").style.display = "block";
};

Player.hideLoader = function(){
	document.getElementById("player-loader").style.display = "none";
};